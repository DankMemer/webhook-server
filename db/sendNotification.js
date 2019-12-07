const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');

module.exports = async function sendNotification (id, type, title, message) {
  return _saveQuery(_fetchUserQuery(id).merge({
    notifications: r.row('notifications')
      .default([])
      .append({ type, title, message, timestamp: Date.now() })
  })).run();
};
