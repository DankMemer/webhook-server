const config = require('../config.json');
const sentry = require('@sentry/node');

module.exports = function logErrors (err) {
  // May add webhooks to discord for this later, undecided right now
  sentry.captureException(err);
  console.log(err);
  return null; // implicit null return for .catch clauses
};
