const config = require('../config.json');
const raven = require('raven');

raven
  .config(config.sentry)
  .install();

module.exports = function logErrors (err) {
  // May add webhooks to discord for this later, undecided right now
  raven.captureException(err);
  console.log(err);
};
