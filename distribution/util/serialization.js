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
  return resolveReferences(value);
}

/* Converts a serialized string or JSON value to an object. */
function decode(object) {
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

  } else if (object.type === ObjectType.Array) {

  } else if (object.type === ObjectType.Object) {

  } else if (object.type === ObjectType.Reference) {

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

/* Resolves cyclic references in a value object. */
function resolveReferences(value) {
  return value;
}

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};
