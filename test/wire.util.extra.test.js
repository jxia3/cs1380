const distribution = require('../config.js');
const local = distribution.local;

test('(25 pts) rpc', (done) => {
  let n = 0;

  function addOne() {
    return ++n;
  }

  const addOneRPC = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(addOne));

  const addOneService = {
    addOne: addOneRPC,
  };

  const otherNode = {ip: '127.0.0.1', port: 9090};

  const stopOtherNode = (cb) => {
    const message = [];
    const remote = {node: otherNode, service: 'status', method: 'stop'};
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        done();
      } catch (error) {
        done(error);
      }
    });
  };

  const cleanup = (e, s) => {
    s.close();
    stopOtherNode();
    done(e);
  };

  const putService = (server) => {
    const message = [addOneService, 'addOne'];
    const remote = {node: otherNode, service: 'routes', method: 'put'};
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBe('addOne');
        callService(server);
      } catch (error) {
        cleanup(error, server);
      }
    });
  };

  const callService = (server) => {
    const message = [];
    const remote = {node: otherNode, service: 'addOne', method: 'addOne'};
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBe(1);
        expect(n).toBe(1);
        cleanup(undefined, server);
      } catch (error) {
        cleanup(error, server);
      }
    });
  };

  distribution.node.start((server) => {
    try {
      expect(server).toBeTruthy();
    } catch (error) {
      cleanup(error, server);
    }

    local.status.spawn(otherNode, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBeDefined();
        expect(v.ip).toBe(otherNode.ip);
        expect(v.port).toBe(otherNode.port);
        putService(server);
      } catch (error) {
        cleanup(error, server);
      }
    });
  });
});

test('(25 pts) rpc w/ arguments', (done) => {
  let localVar = 0;

  function addSth(n) {
    return localVar += n;
  }

  const addSthRPC = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(addSth));

  const addSthService = {
    addSth: addSthRPC,
  };

  const otherNode = {ip: '127.0.0.1', port: 9090};

  const stopOtherNode = (cb) => {
    const message = [];
    const remote = {node: otherNode, service: 'status', method: 'stop'};
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        done();
      } catch (error) {
        done(error);
      }
    });
  };

  const cleanup = (e, s) => {
    s.close();
    stopOtherNode();
    done(e);
  };

  const putService = (server) => {
    const message = [addSthService, 'addSth'];
    const remote = {node: otherNode, service: 'routes', method: 'put'};
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBe('addSth');
        callService(server);
      } catch (error) {
        cleanup(error);
      }
    });
  };

  const callService = (server) => {
    const message = [42];
    const remote = {node: otherNode, service: 'addSth', method: 'addSth'};
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBe(42);
        expect(localVar).toBe(42);
        cleanup(undefined, server);
      } catch (error) {
        cleanup(error, server);
      }
    });
  };

  distribution.node.start((server) => {
    try {
      expect(server).toBeTruthy();
    } catch (error) {
      cleanup(error, server);
    }

    local.status.spawn(otherNode, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBeDefined();
        expect(v.ip).toBe(otherNode.ip);
        expect(v.port).toBe(otherNode.port);
        putService(server);
      } catch (error) {
        cleanup(error, server);
      }
    });
  });
});
