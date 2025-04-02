const distribution = require("./distribution.js");

const lock = distribution.util.sync.createRwLock();

setInterval(() => {
  lock.lockRead(() => {
    console.log("locked in interval");
    lock.unlockRead();
  });
}, 1000);

setTimeout(() => {
  lock.lockWrite(() => {
    console.log("locked in timeout");
    setTimeout(lock.unlockWrite, 2000);
  });
}, 3000);

/* distribution.node.start(() => {
  distribution.local.index._start(true, () => {
    setTimeout(() => {
      distribution.local.index.queuePage("https://stripe.com", () => {});
    }, 1000);
  });
});*/
