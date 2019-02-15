const r = require('./r.js');
const getUser = require('./getUser.js');

module.exports = function _fetchUserQuery (id) {
  return r.table('users').get(id).default(getUser(id));
};
