/*
    Checklist:

    1. Serialize strings
    2. Serialize numbers
    3. Serialize booleans
    4. Serialize (non-circular) Objects
    5. Serialize (non-circular) Arrays
    6. Serialize undefined and null
    7. Serialize Date, Error objects
    8. Serialize (non-native) functions
    9. Serialize circular objects and arrays
    10. Serialize native functions
*/

const LEAF_TAG_LEN = 1;

// Tag at the beginning of leaf type serializations
const LeafTag = {
  Undefined: 'u',
  Null: 'l',
  Number: 'n',
  Boolean: 'b',
  String: 's',
  Date: 'd',
};

// Non-leaf type flags
const ObjectType = {
  Function: 'function',
  Error: 'error',
  Array: 'array',
  Object: 'object',
  Reference: 'reference',
};

/* An internal type used to track reference nodes during deserialization. Since references
   are resolved after all owned properties have been resolved, this type is used as an
   intermediate representation for reference paths. */
class ReferencePath {
  constructor(path) {
    this.path = path;
  }
}

/* Serializes a JavaScript object as a string. Cyclical references to functions, errors,
   arrays, and objects are supported. Other reference types are not explicitly supported. */
function serialize(object) {
  const path = [];
  const seen = new Map();
  const result = encode(object, path, seen);
  if (typeof result === 'string') {
    return result;
  }
  return JSON.stringify(result);
}

/* Converts an object to a string or serializable JSON value. */
function encode(object, path, seen) {
  // Encode leaf types
  if (object === undefined) {
    return LeafTag.Undefined;
  } else if (object === null) {
    return LeafTag.Null;
  } else if (typeof object === 'number') {
    return encodeNumber(object);
  } else if (typeof object === 'boolean') {
    return encodeBoolean(object);
  } else if (typeof object === 'string') {
    return encodeString(object);
  } else if (object instanceof Date) {
    return encodeDate(object);
  }

  // Encode reference types
  if (object instanceof Function) {
    return encodeFunction(object, path, seen);
  } else if (object instanceof Error) {
    return encodeError(object, path, seen);
  } else if (object instanceof Array) {
    return encodeArray(object, path, seen);
  }
  return encodeObject(object, path, seen);
}

/* Encodes a number as its leaf tag and string representation. */
function encodeNumber(num) {
  return LeafTag.Number + '_' + num.toString();
}

/* Encodes a boolean as its leaf tag and string representation. */
function encodeBoolean(bool) {
  return LeafTag.Boolean + '_' + bool.toString();
}

/* Encodes a string as its leaf tag and content. */
function encodeString(str) {
  return LeafTag.String + '_' + str;
}

/* Encodes a date as its leaf tag and epoch timestamp. */
function encodeDate(date) {
  return LeafTag.Date + '_' + date.valueOf().toString();
}

/* Encodes a function as its string body or a reference to an existing function. */
function encodeFunction(fn, path, seen) {
  // Create reference to existing function
  if (seen.has(fn)) {
    return {
      type: ObjectType.Reference,
      value: seen.get(fn),
    };
  }

  // Add path to seen and convert function body to string
  seen.set(fn, [...path]);
  return {
    type: ObjectType.Function,
    value: fn.toString(),
  };
}

/* Encodes an error as its name, message, and cause or a reference to an existing error. */
function encodeError(error, path, seen) {
  // Create reference to existing error
  if (seen.has(error)) {
    return {
      type: ObjectType.Reference,
      value: seen.get(error),
    };
  }

  // Add path to seen and encode error fields
  seen.set(error, [...path]);
  path.push('name');
  const name = encode(error.name, path, seen);
  path.pop();
  path.push('message');
  const message = encode(error.message, path, seen);
  path.pop();
  path.push('cause');
  const cause = encode(error.cause, path, seen);
  path.pop();

  return {
    type: ObjectType.Error,
    value: {name, message, cause},
  };
}

/* Encodes each element in an array or creates a reference to an existing array. */
function encodeArray(array, path, seen) {
  // Create reference to existing array
  if (seen.has(array)) {
    return {
      type: ObjectType.Reference,
      value: seen.get(array),
    };
  }

  // Add path to seen and encode elements
  seen.set(array, [...path]);
  const elements = [];
  for (let e = 0; e < array.length; e += 1) {
    path.push(e.toString());
    elements.push(encode(array[e], path, seen));
    path.pop();
  }

  return {
    type: ObjectType.Array,
    value: elements,
  };
}

/* Encodes each property of an object or creates a reference to an existing object. */
function encodeObject(object, path, seen) {
  // Create reference to existing object
  if (seen.has(object)) {
    return {
      type: ObjectType.Reference,
      value: seen.get(object),
    };
  }

  // Add path to seen and encode properties
  seen.set(object, [...path]);
  const properties = {};
  for (const property in object) {
    path.push(property);
    properties[property] = encode(object[property], path, seen);
    path.pop();
  }

  return {
    type: ObjectType.Object,
    value: properties,
  };
}

/* Deserializes a string into a JavaScript object. The resulting object may contain
   cyclical references in child functions, errors, arrays, and objects. */
function deserialize(string) {
  // Decode leaf type encoded as a string
  if (!string.startsWith('{')) {
    return decode(string);
  }

  // Decode JSON value and resolve references
  let object;
  try {
    object = JSON.parse(string);
  } catch (error) {
    throw new Error('Cannot deserialize invalid JSON: ' + string);
  }
  const value = decode(object);
  return resolveReferences(value, value);
}

/* Converts a serialized string or JSON value to an object. */
function decode(object) {
  if (typeof object !== 'string' && typeof object !== 'object') {
    throw new Error('Cannot deserialize malformed object: ' + object.toString());
  }

  // Decode leaf types
  if (typeof object === 'string') {
    if (object === LeafTag.Undefined) {
      return undefined;
    } else if (object === LeafTag.Null) {
      return null;
    } else if (object.startsWith(LeafTag.Number)) {
      return decodeNumber(object);
    } else if (object.startsWith(LeafTag.Boolean)) {
      return decodeBoolean(object);
    } else if (object.startsWith(LeafTag.String)) {
      return decodeString(object);
    } else if (object.startsWith(LeafTag.Date)) {
      return decodeDate(object);
    }
    throw new Error('Cannot deserialize invalid leaf object: ' + object);
  }

  // Decode reference types
  if (object.type === ObjectType.Function) {
    return decodeFunction(object.value);
  } else if (object.type === ObjectType.Error) {
    return decodeError(object.value);
  } else if (object.type === ObjectType.Array) {
    return decodeArray(object.value);
  } else if (object.type === ObjectType.Object) {
    return decodeObject(object.value);
  } else if (object.type === ObjectType.Reference) {
    return decodeReference(object.value);
  }

  if ('type' in object) {
    throw new Error('Cannot deserialize invalid type: ' + object.type.toString());
  }
  throw new Error('Cannot deserialize invalid object: ' + object.toString());
}

/* Decodes a serialized number string as a number. */
function decodeNumber(str) {
  // Check for special numbers
  const content = str.slice(LEAF_TAG_LEN + 1);
  if (content === 'Infinity') {
    return Infinity;
  } else if (content === 'NaN') {
    return NaN;
  }

  // Ensure regular number is not NaN
  const num = +content;
  if (isNaN(num)) {
    throw new Error('Cannot deserialize invalid number: ' + content);
  }
  return num;
}

/* Decodes a serialized boolean string as a boolean. */
function decodeBoolean(str) {
  const content = str.slice(LEAF_TAG_LEN + 1);
  if (content === 'true') {
    return true;
  } else if (content === 'false') {
    return false;
  }
  throw new Error('Cannot deserialize invalid boolean: ' + content);
}

/* Decodes a serialized string. */
function decodeString(str) {
  return str.slice(LEAF_TAG_LEN + 1);
}

/* Decodes a serialized date as a date object. */
function decodeDate(str) {
  const timestamp = +str.slice(LEAF_TAG_LEN + 1);
  if (isNaN(timestamp)) {
    throw new Error('Cannot deserialize invalid date: ' + str.slice(2));
  }
  return new Date(timestamp);
}

/* Decodes a serialized function body as a function. */
function decodeFunction(body) {
  if (typeof body !== 'string') {
    throw new Error('Cannot deserialize invalid function body: ' + body.toString());
  }
  return (new Function('return ' + body))();
}

/* Decodes a serialized error as an error object. */
function decodeError({name, message, cause}) {
  if (typeof name !== 'string' && typeof name !== 'object') {
    throw new Error('Cannot deserialize invalid error name: ' + name.toString());
  }
  if (typeof name !== 'string' && typeof message !== 'object') {
    throw new Error('Cannot deserialize invalid error message: ' + message.toString());
  }
  if (typeof name !== 'string' && typeof cause !== 'object') {
    throw new Error('Cannot deserialize invalid error cause: ' + cause.toString());
  }

  // Decode error components
  const errorName = decode(name);
  const errorMessage = decode(message);
  const errorCause = decode(cause);

  // Create error object
  let error;
  if (errorCause === undefined) {
    error = new Error(errorMessage);
  } else {
    error = new Error(errorMessage, {cause: errorCause});
  }
  error.name = errorName;

  return error;
}

/* Decodes serialized array elements as an array. */
function decodeArray(elements) {
  if (!(elements instanceof Array)) {
    throw new Error('Cannot deserialize invalid array: ' + elements.toString());
  }
  return elements.map(decode);
}

/* Decodes serialized object properties as an object. */
function decodeObject(properties) {
  if (typeof properties !== 'object') {
    throw new Error('Cannot deserialize invalid object: ' + properties.toString());
  }
  const object = {};
  for (const property in properties) {
    object[property] = decode(properties[property]);
  }
  return object;
}

/* Converts a serialized reference path to an intermediate path object. */
function decodeReference(path) {
  if (!(path instanceof Array)) {
    throw new Error('Cannot deserialize invalid reference: ' + path.toString());
  }
  return new ReferencePath(path);
}

/* Resolves cyclic references in a value object. */
function resolveReferences(root, value) {
  if (value instanceof ReferencePath) {
    return resolvePath(root, value.path);
  } else if (value instanceof Error) {
    value.name = resolveReferences(root, value.name);
    value.cause = resolveReferences(root, value.cause);
  } else if (value instanceof Array) {
    for (let e = 0; e < value.length; e += 1) {
      value[e] = resolveReferences(root, value[e]);
    }
  } else if (typeof value === 'object') {
    for (const property in value) {
      value[property] = resolveReferences(root, value[property]);
    }
  }
  return value;
}

/* Resolves a path of properties in an object. */
function resolvePath(object, path) {
  let value = object;
  for (const property of path) {
    value = value[property];
  }
  return value;
}

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};
