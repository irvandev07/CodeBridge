/** Small example app intentionally free from external dependencies. */
export function add(a, b) {
  if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError("Inputs must be finite numbers");
  }
  return a + b;
}
