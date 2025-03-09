/* A module for dynamically compiling JavaScript functions with arbitrary data. */

const QUOTE_SYMBOLS = ["\"", "'", "`"];

/**
 * Replaces identifier strings in a function with JavaScript values.
 */
function compile(fn, values) {
  let fnText = fn.toString();
  for (const key in values) {
    const value = typeof values[key] === "function" ? values[key].toString() : JSON.stringify(values[key]);
    for (const quote of QUOTE_SYMBOLS) {
      fnText = fnText.replaceAll(`${quote}${key}${quote}`, value);
    }
  }
  return (new Function(`return ${fnText}`))();
}

module.exports = compile;
