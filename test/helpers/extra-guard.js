beforeAll(() => {
  if (!globalThis.distribution) {
    return;
  }

  let lib;
  try {
    lib = require('@brown-ds/distribution');
  } catch (error) {
    return;
  }

  const usingOverrides =
    globalThis.distribution.util.wire.createRPC === lib.util.wire.createRPC ||
    globalThis.distribution.local.routes.get === lib.local.routes.get ||
    globalThis.distribution.local.status.spawn === lib.local.status.spawn ||
    globalThis.distribution.local.status.stop === lib.local.status.stop;

  if (usingOverrides) {
    throw new Error(
        'Extra credit tests are disabled when library overrides are enabled.',
    );
  }
});
