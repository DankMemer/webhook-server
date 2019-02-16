const r = require('./r.js');

module.exports = function _saveQuery (data) {
  return r.table('users').insert(data, { conflict: 'update' });
};
