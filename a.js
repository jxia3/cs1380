(_0x1a4792, _0x1807e0) => {
  _0x1807e0 = _0x1807e0 || function() {};
  global.distribution.local.status.spawn(_0x1a4792, (_0x1b39e2, _0x5e57a4) => {
    if (_0x1b39e2) {
      _0x1807e0(_0x1b39e2);
    } else {
      global.distribution.local.groups.add(_0x53485f.gid, _0x1a4792, () => {
        _0x1807e0(null, _0x5e57a4);
      });
    }
    global.distribution[_0x53485f.gid].comm.send([_0x53485f.gid, _0x1a4792], {
      "service": "groups",
      "method": "add",
    }, () => {});
  });
};
