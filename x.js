/* eslint-disable */
/*
ATTENTION: This is an obfuscated file. You do not need to understand it.
Do NOT edit this file directly. Use it as a black box.

If you notice any issues with using this file, please contact the TAs.
*/
const distribution = require("../../distribution");
const id = distribution.util.id;
function mr(_0x91efe5) {
  const context = {
    'gid': _0x91efe5.gid || 'all'
  };
  function exec(config, callback) {
    const opId = id.getID(config);
    const workerService = {
      'mapper': config.map,
      'reducer': config.reduce,
      'map': function (keys, groupId, opId, callback) {
        if (keys.length == 0) {
          callback(null, []);
          return;
        } else {
          const results = [];
          let counter = 0;
          keys.forEach(key => {
            distribution[groupId].store.get(key, (_0x21bc0c, _0x33ac07) => {
              counter++;
              const _0x1f8fac = this.mapper(key, _0x33ac07);
              if (Array.isArray(_0x1f8fac)) {
                results.push(..._0x1f8fac);
              } else {
                results.push(_0x1f8fac);
              }
              if (counter == keys.length) {
                distribution.local.store.put(results, opId + '_map', (_0x3778ef, _0x31bc78) => {
                  callback(_0x3778ef, results);
                });
              }
            });
          });
        }
      },
      'shuffle': function (_0x31a211, _0x3b7dda, _0x492d22) {
        distribution.local.store.get(_0x3b7dda + '_map', (_0x21b907, _0x4a1fa9) => {
          if (!_0x21b907) {
            let _0xc8e54a = 0;
            _0x4a1fa9.forEach(_0x18e867 => {
              const [_0x2f98d3] = Object.keys(_0x18e867);
              distribution[_0x31a211].mem.put(_0x18e867[_0x2f98d3], {
                'key': _0x2f98d3,
                'action': 'append'
              }, (_0x468c9f, _0x331470) => {
                _0xc8e54a++;
                if (_0xc8e54a == _0x4a1fa9.length) {
                  _0x492d22(null, _0x4a1fa9);
                }
              });
            });
          } else {
            _0x492d22(_0x21b907, {});
          }
        });
      },
      'reduce': function (_0x4e0ddb, _0xaeaeb1, _0x52b618) {
        distribution.local.mem.get({
          'key': null,
          'gid': _0x4e0ddb
        }, (_0x272c7d, _0x504820) => {
          let _0x46c073 = [];
          let _0x347a9c = 0;
          if (_0x504820.length == 0) {
            _0x52b618(null, null);
          }
          _0x504820.forEach(_0x5522b7 => distribution.local.mem.get({
            'key': _0x5522b7,
            'gid': _0x4e0ddb
          }, (_0x175794, _0x462b8c) => {
            const _0xb7dd39 = this.reducer(_0x5522b7, _0x462b8c);
            _0x46c073 = _0x46c073.concat(_0xb7dd39);
            _0x347a9c++;
            if (_0x347a9c == _0x504820.length) {
              _0x52b618(null, _0x46c073);
            }
          }));
        });
      }
    };
    const partitionKeys = function (keys, group) {
      const partition = {};
      Object.keys(group).forEach(nodeSID => {
        partition[nodeSID] = [];
      });
      keys.forEach(key => {
        const _0x47c661 = id.getID(key);
        const _0x517d5f = id.naiveHash(_0x47c661, Object.keys(group));
        partition[_0x517d5f].push(key);
      });
      return partition;
    };
    distribution[context.gid].routes.put(workerService, 'mr-' + opId, (_0x56d927, _0x185dc6) => {
      distribution.local.groups.get(context.gid, (_0x3eaf6d, group) => {
        const _0x162883 = partitionKeys(config.keys, group);
        let _0x5eb0c1 = 0;
        const _0x509059 = Object.keys(group).length;
        const _0x23a9b9 = {
          'service': 'mr-' + opId,
          'method': 'map'
        };
        for (const _0x2064db in group) {
          const _0x448872 = [_0x162883[_0x2064db], context.gid, opId];
          distribution.local.comm.send(_0x448872, {
            'node': group[_0x2064db],
            ..._0x23a9b9
          }, (_0x1d5911, _0x328b27) => {
            ++_0x5eb0c1;
            if (_0x5eb0c1 == _0x509059) {
              const _0x23db66 = {
                'service': 'mr-' + opId,
                'method': 'shuffle'
              };
              distribution[context.gid].comm.send([context.gid, opId], _0x23db66, (_0x2d1def, _0xc57f5c) => {
                const _0x5c226c = {
                  'service': 'mr-' + opId,
                  'method': 'reduce'
                };
                distribution[context.gid].comm.send([context.gid, opId], _0x5c226c, (_0x1751aa, _0x33a63e) => {
                  let _0x5283f9 = [];
                  for (const _0x3f0c1a of Object.values(_0x33a63e)) {
                    if (_0x3f0c1a !== null) {
                      _0x5283f9 = _0x5283f9.concat(_0x3f0c1a);
                    }
                  }
                  callback(null, _0x5283f9);
                  return;
                });
              });
            }
          });
        }
      });
    });
  }
  return {
    'exec': exec
  };
}
;
module.exports = mr;
/* eslint-enable */
