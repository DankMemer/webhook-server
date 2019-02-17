const { verify } = require('jsonwebtoken');
const { promisify } = require('util');
const config = require('../config.json');

const verifyAsync = promisify(verify);

module.exports = (jwt) =>
  verifyAsync(jwt, config.secret, {
    algorithms: [ 'HS512' ]
  });
