const { setTimeout } = require('timers/promises');

(async () => {
  await setTimeout(10000)
  console.log("Test")
})();
