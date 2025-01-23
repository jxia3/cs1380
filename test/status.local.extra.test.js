const distribution = require('../config.js');
const local = distribution.local;
const comm = distribution.local.comm;

test('(10 pts) local.status.spawn/stop using local.comm', (done) => {
  try {
    expect(local.status.spawn).toBeDefined();
    expect(local.status.stop).toBeDefined();
    expect(local.comm).toBeDefined();
    expect(local.comm.send).toBeDefined();
  } catch (error) {
    done(error);
  }

  const node = {
    ip: '127.0.0.1',
    port: 9090,
  };

  const config = {
    ip: node.ip,
    port: node.port,
    onStart: () => {
      console.log('Node is started!');
    },
  };

  const cleanup = (server, done) => {
    comm.send([], {service: 'status', method: 'stop', node: node}, (e, v) => {
      server.close();
      try {
        expect(e).toBeFalsy();
        expect(v.ip).toBe(node.ip);
        expect(v.port).toBe(node.port);
        done();
      } catch (error) {
        done(error);
      }
    });
  };

  const spawnNode = (server) => {
    local.status.spawn(config, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBeDefined();
        cleanup(server, done);
      } catch (error) {
        cleanup(server, done);
      }
    });
  };

  distribution.node.start((server) => {
    spawnNode(server);
  });
});
