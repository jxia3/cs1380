const groups = function(config) {
  const context = {};
  context.gid = config.gid || 'all';

  return {
    put: (config, group, callback) => {
    },

    del: (name, callback) => {
    },

    get: (name, callback) => {
    },

    add: (name, node, callback) => {
    },

    rem: (name, node, callback) => {
    },
  };
};

module.exports = groups;
