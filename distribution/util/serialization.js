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
  Error: 'e',
};

// Non-leaf type flags
const ObjectType = {
  Function: 'function',
  Array: 'array',
  Object: 'object',
};

/* Serializes a JavaScript object as a string. */
function serialize(object) {
}

/* Deserializes a string into a JavaScript object. */
function deserialize(string) {
}

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};
