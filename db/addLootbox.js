const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');

module.exports = async function addLootbox (id) {
  return _saveQuery(_fetchUserQuery(id).merge({
    inventory: {
      normie: r.row('inventory').default({}).getField('normie').default(0).add(1)
    },
    upvoted: true
  })).run();
};
