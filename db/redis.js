const { redisString } = require('../config.json');

const Redis = require('ioredis');
module.exports = new Redis(redisString);
