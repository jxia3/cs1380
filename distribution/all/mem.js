
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || global.distribution.util.id.naiveHash;

  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get: (config, callback) => {
    },

    put: (state, config, callback) => {
    },

    del: (config, callback) => {
    },

    reconf: (config, callback) => {
    },
  };
};

module.exports = mem;
