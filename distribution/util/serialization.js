/* A module for serializing and deserializing JavaScript objects. All items in the
   checklist are supported:
   1. Serialize strings
   2. Serialize numbers
   3. Serialize booleans
   4. Serialize (non-circular) Objects
   5. Serialize (non-circular) Arrays
   6. Serialize undefined and null
   7. Serialize Date, Error objects
   8. Serialize (non-native) functions
   9. Serialize circular objects and arrays
   10. Serialize native functions */

// Enable global object discovery
const ENABLE_GLOBAL = true;
const EXCLUDED_GLOBAL = ["sys", "wasi"];
// Enable native object discovery
const ENABLE_NATIVE = false;
const EXCLUDED_NATIVE = ["sys", "wasi", "_stream_wrap"];
// Enable optimized type flags
const OPTIMIZE_FLAGS = true;
// Indicates if an object is a path reference
const REFERENCE_MARKER = "_ref_5cc4ec3fb84a7c34";

// Marker flags that indicate structure
const Marker = {
  Type: OPTIMIZE_FLAGS ? "t" : "type",
  Value: OPTIMIZE_FLAGS ? "v" : "value",
};

// Tag at the beginning of leaf type serializations
const LeafTag = {
  Undefined: OPTIMIZE_FLAGS ? "u" : "undefined",
  Null: OPTIMIZE_FLAGS ? "l" : "null",
  Number: OPTIMIZE_FLAGS ? "n" : "num",
  Boolean: OPTIMIZE_FLAGS ? "b" : "bool",
  String: OPTIMIZE_FLAGS ? "s" : "str",
  Date: OPTIMIZE_FLAGS ? "d" : "date",
  Native: OPTIMIZE_FLAGS ? "i" : "native",
};

// Non-leaf type flags
const ObjectType = {
  Function: OPTIMIZE_FLAGS ? "f" : "function",
  Error: OPTIMIZE_FLAGS ? "e" : "error",
  Array: OPTIMIZE_FLAGS ? "a" : "array",
  Object: OPTIMIZE_FLAGS ? "o" : "object",
  Reference: OPTIMIZE_FLAGS ? "r" : "reference",
};

// Discover native objects
const nativeIds = new Map();
const nativeObjects = {};

if (ENABLE_GLOBAL) {
  nativeIds.set(global, "global");
  nativeObjects["global"] = global;
  const path = ["global"];
  for (const property of Object.getOwnPropertyNames(global)) {
    if (EXCLUDED_GLOBAL.includes(property)) {
      continue;
    }
    if (typeof global[property] === "function" || typeof global[property] === "object") {
      path.push(property);
      exploreNative(global[property], path);
      path.pop();
    }
  }
}

if (ENABLE_NATIVE) {
  const path = [];
  for (const item in process.binding("natives")) {
    try {
      if (EXCLUDED_NATIVE.includes(item)) {
        continue;
      }
      const module = require(item);
      path.push(item);
      exploreNative(module, path);
      path.pop();
    } catch {}
  }
}

/**
 * Traverses a native object to discover native functionality.
 */
function exploreNative(object, path) {
  if (nativeIds.has(object)) {
    return;
  }
  const id = path.join(".");
  if (id === "global.process.mainModule") {
    return;
  }
  nativeIds.set(object, id);
  nativeObjects[id] = object;

  for (const property in object) {
    if (typeof object[property] === "function" || typeof object[property] === "object") {
      path.push(property);
      exploreNative(object[property], path);
      path.pop();
    }
  }
}

/**
 * Serializes a JavaScript object as a string. Cyclical references to functions, errors,
 * arrays, and objects are supported. Other reference types are not explicitly supported.
 */
function serialize(object) {
  const path = [];
  const seen = new Map();
  const result = encode(object, path, seen);
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result);
}

/**
 * Converts an object to a string or serializable JSON value.
 */
function encode(object, path, seen) {
  // Encode leaf types
  if (object === undefined) {
    return LeafTag.Undefined;
  } else if (object === null) {
    return LeafTag.Null;
  } else if (typeof object === "number") {
    return encodeNumber(object);
  } else if (typeof object === "boolean") {
    return encodeBoolean(object);
  } else if (typeof object === "string") {
    return encodeString(object);
  } else if (object instanceof Date) {
    return encodeDate(object);
  } else if (nativeIds.has(object)) {
    return encodeNative(object);
  }

  // Encode reference types
  if (typeof object === "function") {
    return encodeFunction(object, path, seen);
  } else if (object instanceof Error) {
    return encodeError(object, path, seen);
  } else if (object instanceof Array) {
    return encodeArray(object, path, seen);
  }
  return encodeObject(object, path, seen);
}

/**
 * Encodes a number as its leaf tag and string representation.
 */
function encodeNumber(num) {
  return LeafTag.Number + "_" + num.toString();
}

/**
 * Encodes a boolean as its leaf tag and string representation.
 */
function encodeBoolean(bool) {
  if (bool) {
    return LeafTag.Boolean + "_t";
  } else {
    return LeafTag.Boolean + "_f";
  }
}

/**
 * Encodes a string as its leaf tag and content.
 */
function encodeString(str) {
  return LeafTag.String + "_" + str;
}

/**
 * Encodes a date as its leaf tag and epoch timestamp.
 */
function encodeDate(date) {
  return LeafTag.Date + "_" + date.valueOf().toString();
}

/**
 * Encodes a native object as its discovered ID.
 */
function encodeNative(object) {
  return LeafTag.Native + "_" + nativeIds.get(object);
}

/**
 * Encodes a function as its string body or a reference to an existing function.
 */
function encodeFunction(fn, path, seen) {
  // Create reference to existing function
  if (seen.has(fn)) {
    return {
      [Marker.Type]: ObjectType.Reference,
      [Marker.Value]: seen.get(fn),
    };
  }

  // Add path to seen and convert function body to string
  seen.set(fn, [...path]);
  return {
    [Marker.Type]: ObjectType.Function,
    [Marker.Value]: fn.toString(),
  };
}

/**
 * Encodes an error as its name, message, and cause or a reference to an existing error.
 */
function encodeError(error, path, seen) {
  // Create reference to existing error
  if (seen.has(error)) {
    return {
      [Marker.Type]: ObjectType.Reference,
      [Marker.Value]: seen.get(error),
    };
  }

  // Add path to seen and encode error fields
  seen.set(error, [...path]);
  path.push("name");
  const name = encode(error.name, path, seen);
  path.pop();
  path.push("message");
  const message = encode(error.message, path, seen);
  path.pop();
  path.push("cause");
  const cause = encode(error.cause, path, seen);
  path.pop();

  return {
    [Marker.Type]: ObjectType.Error,
    [Marker.Value]: {name, message, cause},
  };
}

/**
 * Encodes each element in an array or creates a reference to an existing array.
 */
function encodeArray(array, path, seen) {
  // Create reference to existing array
  if (seen.has(array)) {
    return {
      [Marker.Type]: ObjectType.Reference,
      [Marker.Value]: seen.get(array),
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
    [Marker.Type]: ObjectType.Array,
    [Marker.Value]: elements,
  };
}

/**
 * Encodes each property of an object or creates a reference to an existing object.
 */
function encodeObject(object, path, seen) {
  // Create reference to existing object
  if (seen.has(object)) {
    return {
      [Marker.Type]: ObjectType.Reference,
      [Marker.Value]: seen.get(object),
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
    [Marker.Type]: ObjectType.Object,
    [Marker.Value]: properties,
  };
}

/**
 * Deserializes a string into a JavaScript object. The resulting object may contain
 * cyclical references in child functions, errors, arrays, and objects.
 */
function deserialize(string) {
  // Decode leaf type encoded as a string
  if (!string.startsWith("{")) {
    return decode(string);
  }

  // Decode JSON value and resolve references
  let object;
  try {
    object = JSON.parse(string);
  } catch (error) {
    throw new Error("Cannot deserialize invalid JSON: " + string);
  }
  const value = decode(object);
  return resolveReferences(value, value);
}

/**
 * Converts a serialized string or JSON value to an object.
 */
function decode(object) {
  if (typeof object !== "string" && typeof object !== "object") {
    throw new Error("Cannot deserialize malformed object: " + object.toString());
  }

  // Decode leaf types
  if (typeof object === "string") {
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
    } else if (object.startsWith(LeafTag.Native)) {
      return decodeNative(object);
    }
    throw new Error("Cannot deserialize invalid leaf object: " + object);
  }

  // Decode reference types
  if (object[Marker.Type] === ObjectType.Function) {
    return decodeFunction(object[Marker.Value]);
  } else if (object[Marker.Type] === ObjectType.Error) {
    return decodeError(object[Marker.Value]);
  } else if (object[Marker.Type] === ObjectType.Array) {
    return decodeArray(object[Marker.Value]);
  } else if (object[Marker.Type] === ObjectType.Object) {
    return decodeObject(object[Marker.Value]);
  } else if (object[Marker.Type] === ObjectType.Reference) {
    return decodeReference(object[Marker.Value]);
  }

  if (Marker.Type in object) {
    throw new Error("Cannot deserialize invalid type: " + object[Marker.Type].toString());
  }
  throw new Error("Cannot deserialize invalid object: " + object.toString());
}

/**
 * Decodes a serialized number string as a number.
 */
function decodeNumber(str) {
  // Check for special numbers
  const content = str.slice(LeafTag.Number.length + 1);
  if (content === "Infinity") {
    return Infinity;
  } else if (content === "NaN") {
    return NaN;
  }

  // Ensure regular number is not NaN
  const num = +content;
  if (isNaN(num)) {
    throw new Error("Cannot deserialize invalid number: " + content);
  }
  return num;
}

/**
 * Decodes a serialized boolean string as a boolean.
 */
function decodeBoolean(str) {
  const content = str.slice(LeafTag.Boolean.length + 1);
  if (content === "t") {
    return true;
  } else if (content === "f") {
    return false;
  }
  throw new Error("Cannot deserialize invalid boolean: " + content);
}

/**
 * Decodes a serialized string.
 */
function decodeString(str) {
  return str.slice(LeafTag.String.length + 1);
}

/**
 * Decodes a serialized date as a date object.
 */
function decodeDate(str) {
  const timestamp = +str.slice(LeafTag.Date.length + 1);
  if (isNaN(timestamp)) {
    throw new Error("Cannot deserialize invalid date: " + str.slice(LeafTag.Date.length + 1));
  }
  return new Date(timestamp);
}

/**
 * Decodes a serialized native object.
 */
function decodeNative(str) {
  const id = str.slice(LeafTag.Native.length + 1);
  if (!(id in nativeObjects)) {
    throw new Error("Cannot deserialize invalid native object: " + id);
  }
  return nativeObjects[id];
}

/**
 * Decodes a serialized function body as a function.
 */
function decodeFunction(body) {
  if (typeof body !== "string") {
    throw new Error("Cannot deserialize invalid function body: " + body.toString());
  }
  return (new Function("return " + body))();
}

/**
 * Decodes a serialized error as an error object.
 */
function decodeError({name, message, cause}) {
  if (typeof name !== "string" && typeof name !== "object") {
    throw new Error("Cannot deserialize invalid error name: " + name.toString());
  }
  if (typeof name !== "string" && typeof message !== "object") {
    throw new Error("Cannot deserialize invalid error message: " + message.toString());
  }
  if (typeof name !== "string" && typeof cause !== "object") {
    throw new Error("Cannot deserialize invalid error cause: " + cause.toString());
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

/**
 * Decodes serialized array elements as an array.
 */
function decodeArray(elements) {
  if (!(elements instanceof Array)) {
    throw new Error("Cannot deserialize invalid array: " + elements.toString());
  }
  return elements.map(decode);
}

/**
 * Decodes serialized object properties as an object.
 */
function decodeObject(properties) {
  if (typeof properties !== "object") {
    throw new Error("Cannot deserialize invalid object: " + properties.toString());
  }
  const object = {};
  for (const property in properties) {
    object[property] = decode(properties[property]);
  }
  return object;
}

/**
 * Converts a serialized reference path to an intermediate path object.
 */
function decodeReference(path) {
  if (!(path instanceof Array)) {
    throw new Error("Cannot deserialize invalid reference: " + path.toString());
  }
  return {[REFERENCE_MARKER]: path};
}

/**
 * Resolves cyclic references in a value object.
 */
function resolveReferences(root, value) {
  if (typeof value === "object" && value[REFERENCE_MARKER] !== undefined) {
    return resolvePath(root, value[REFERENCE_MARKER]);
  } else if (value instanceof Error) {
    value.name = resolveReferences(root, value.name);
    value.cause = resolveReferences(root, value.cause);
  } else if (value instanceof Array) {
    for (let e = 0; e < value.length; e += 1) {
      value[e] = resolveReferences(root, value[e]);
    }
  } else if (typeof value === "object") {
    for (const property in value) {
      value[property] = resolveReferences(root, value[property]);
    }
  }
  return value;
}

/**
 * Resolves a path of properties in an object.
 */
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
