const { dbs } = require('../config.json');

const Redis = require('ioredis');
module.exports = new Redis({
  host: dbs.host,
  password: dbs.redisPassword
});
