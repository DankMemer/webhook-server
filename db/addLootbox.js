const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');

module.exports = async function addLootbox (id, type = 'normie', amount = 1) {
  return _saveQuery(_fetchUserQuery(id).merge({
    inventory: {
      [type]: r.row('inventory').default({}).getField(type).default(0).add(amount)
    },
    ...(type === 'normie' && amount === 1
      ? { upvoted: true }
      : { purchasedBox: Date.now() }
    )
  })).run();
};
