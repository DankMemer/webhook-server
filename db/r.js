const config = require('../config.json')

module.exports = require('rethinkdbdash')({
  servers: [ {
    host: config.dbs.host,
    password: config.dbs.rethinkPassword
  } ]
});
