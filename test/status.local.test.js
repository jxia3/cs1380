const distribution = require('../config.js');
const local = distribution.local;
const id = distribution.util.id;

const config = distribution.node.config;

test('(2 pts) local.status.get(sid)', (done) => {
  local.status.get('sid', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBe(id.getSID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(ip)', (done) => {
  local.status.get('ip', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBe(config.ip);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(port)', (done) => {
  local.status.get('port', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBe(config.port);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(counts)', (done) => {
  local.status.get('counts', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBeDefined();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(random)', (done) => {
  local.status.get('random', (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(heapTotal)', (done) => {
  const heapTotal = process.memoryUsage().heapTotal;

  local.status.get('heapTotal', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBeGreaterThanOrEqual(heapTotal);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(heapUsed)', (done) => {
  const heapUsed = process.memoryUsage().heapUsed;

  local.status.get('heapUsed', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBeGreaterThanOrEqual(heapUsed);
      done();
    } catch (error) {
      done(error);
    }
  });
});
