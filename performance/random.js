/* A seeded PRNG for test reproducibility. */

const FACTOR = 16807;
const MOD = 2147483647;

let state = Math.floor(Math.random() * 1_000_000);

function next() {
  state = (state * FACTOR) % MOD;
  return state / (MOD - 1);
}

function chance(threshold) {
  const entropy = next();
  return entropy < threshold;
}

module.exports = {
  setSeed: (seed) => state = seed,
  next,
  chance,
}
