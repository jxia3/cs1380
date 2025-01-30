/* A seeded PRNG for test reproducibility. */

const FACTOR = 16807;
const MOD = 2147483647;

let state = Math.floor(Math.random() * 1_000_000);

function next() {
  /* Returns a random number between 0 and 1 and advances the PRNG. */
  state = (state * FACTOR) % MOD;
  return state / (MOD - 1);
}

function chance(threshold) {
  /* Returns true with a random chance and advances the PRNG. */
  const entropy = next();
  return entropy < threshold;
}

module.exports = {
  setSeed: (seed) => state = seed,
  next,
  chance,
}
