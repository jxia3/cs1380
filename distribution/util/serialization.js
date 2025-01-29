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
};

/* Serializes a JavaScript object as a string. Cyclical references to functions, errors,
   arrays, and objects are supported. Other reference types are not explicitly supported. */
function serialize(object) {
  const path = [];
  const seen = new Map();
  const result = encode(object, path, seen);
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

  throw Error('unsupported');
  /*
  // Encode reference types
  if (object instanceof Function) {
    return encodeFunction(object, path, seen);
  } else if (object instanceof Error) {
    return encodeError(object, path, seen);
  } else if (object instanceof Array) {
    return encodeArray(object, path, seen);
  } else {
    return encodeObject(object, path, seen);
  }*/
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
  } catch {
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

  } else if (object.type == ObjectType.Error) {

  } else if (object.type === ObjectType.Array) {

  } else if (object.type == ObjectType.Object) {

  }

  if ('type' in object) {
    throw new Error('Cannot deserialize invalid type: ' + object.type.toString());
  }
  throw new Error('Cannot deserialize invalid object: ' + object.toString());
}

/* Decodes a serialized number string as a number. */
function decodeNumber(str) {
  // Check for special numbers
  const content = str.slice(2);
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

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};
