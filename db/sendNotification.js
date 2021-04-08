const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');
const redis = require('./redis');

let currentRedisChannel = 0;
const getRedisChannel = () => {
  const channel = ++currentRedisChannel;
  if (channel > 35) {
    currentRedisChannel = 0;
  }

  return channel;
}

module.exports = async function sendNotification (id, type, title, message) {
  const notification = {
    type,
    title,
    message,
    timestamp: Date.now()
  };

  await redis.publish(
    `changes:user:${getRedisChannel()}:notification`,
    JSON.stringify({
      id,
      data: notification
    })
  );

  return _saveQuery(_fetchUserQuery(id).merge({
    notifications: r.row('notifications')
      .default([])
      .append(notification)
  })).run();
};
