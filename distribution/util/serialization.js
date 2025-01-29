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

/* Converts an object to a serializable JSON representation. */
function encode(object, path, seen) {
  // Encode leaf types
  if (object === undefined) {
    return encodeUndefined();
  } else if (object === null) {
    return encodeNull();
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
  } else {
    return encodeObject(object, path, seen);
  }
}

/* Encodes an undefined object as its leaf tag. */
function encodeUndefined() {
  return LeafTag.Undefined;
}

/* Encodes a null object as its leaf tag. */
function encodeNull() {
  return LeafTag.Null;
}

/* Deserializes a string into a JavaScript object. The resulting object may contain
   cyclical references in child functions, errors, arrays, and objects. */
function deserialize(string) {
}

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};
