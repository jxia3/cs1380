
const store = function(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || global.distribution.util.id.naiveHash;
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

module.exports = store;
