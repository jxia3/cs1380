
const status = function(config) {
  const context = {};
  context.gid = config.gid || "all";

  return {
    get: (config, callback) => {
    },

    spawn: (config, callback) => {
    },

    stop: (callback) => {
    },
  };
};

module.exports = status;
