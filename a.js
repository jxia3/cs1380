(config, callback) => {
  global.distribution[this.gid].mem.get(null, (error, currentKeys) => {
    global.distribution[this.gid].status.get("nid", (error, currentNodeIds) => {
      const _0x52e00a = Object.values(currentNodeIds);
      const _0xfb18b0 = Object.values(config).map((_0x183043) => global.distribution.util.id.getNID(_0x183043));
      log("[mem.reconf\\x20received\\x20" + currentKeys.length + "\\x20keys\\x20from\\x20" + currentNodeIds.length + "\\x20nodes");
      let _0x256f9b = 0;
      const _0xcd0d46 = () => {
        if (_0x256f9b === currentKeys.length) {
          callback();
        }
      };
      if (currentKeys.length === 0) {
        callback();
        return;
      }
      for (const _0x254dff of currentKeys) {
        const _0x604a18 = global.distribution.util.id.getID(_0x254dff);
        const _0x5d4fa8 = this.hash(_0x604a18, _0xfb18b0);
        const _0x4ec856 = this.hash(_0x604a18, _0x52e00a);
        log("[mem.reconf]\\x20old\\x20nid:\\x20" + _0x5d4fa8 + "\\x20new\\x20nid:\\x20" + _0x4ec856);
        if (_0x5d4fa8 === _0x4ec856) {
          _0x256f9b++;
          _0xcd0d46();
          continue;
        }
        const _0x41f7eb = config[_0x5d4fa8.substring(0, 5)];
        const _0x4229ee = [{
          "key": _0x254dff,
          "gid": this.gid,
        }];
        const _0x1e063b = {
          "service": "mem",
          "method": "del",
          "node": _0x41f7eb,
        };
        log("[mem.reconf]\\x20deleting\\x20key\\x20" + _0x254dff + "\\x20from\\x20" + JSON.stringify(_0x1e063b));
        global.distribution.local.comm.send(_0x4229ee, _0x1e063b, (_0x418360, _0x1009ce) => {
          global.distribution[this.gid].mem.put(_0x1009ce, _0x254dff, (_0x641d25, _0x96fc42) => {
            _0x256f9b++;
            _0xcd0d46();
          });
        });
      }
    });
  });
};
