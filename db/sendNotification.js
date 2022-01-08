const { Kafka } = require('kafkajs');
const { kafkaConfig } = require('../config.json');
const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');

const kafka = new Kafka(kafkaConfig);
let connected = false;
const producer = kafka.producer({ allowAutoTopicCreation: false });

module.exports = async function sendNotification (id, type, title, message) {
  if (!connected) {
    connected = true;
    await producer.connect();
  }

  const notification = {
    type,
    title,
    message,
    timestamp: Date.now()
  };

  try {
    await producer.send({
      topic: 'user-notifications',
      messages: [
        {
          value: JSON.stringify({ id, data: notification })
        }
      ]
    });
  } catch (err) {
    console.error(err);
  }

  return _saveQuery(_fetchUserQuery(id).merge({
    notifications: r.row('notifications')
      .default([])
      .append(notification)
  })).run();
};
