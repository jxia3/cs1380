const distribution = require("./distribution.js");

const util = distribution.util;

const mutex = util.sync.createMutex();

setInterval(() => {
  mutex.lock(() => {
    console.log("locked in interval");
    mutex.unlock(() => {
      console.log("unlocked in interval");
    });
  });
}, 1000);

setTimeout(() => {
  mutex.lock(() => {
    console.log("locked in timeout");
    setTimeout(() => {
      mutex.unlock(() => {
        console.log("unlocked in timeout");
      });
    }, 2000);
  });
}, 3000);
