const config = require('../config.json')

module.exports = require('rethinkdbdash')({
  servers: [ {
    host: config.dbs.host,
    password: config.dbs.rethinkPassword
  } ],
   buffer: 5,
   max: 20,
   timeout: 30
});
