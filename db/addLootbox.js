const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');
const redis = require('./redis');

module.exports = async function addLootbox (id, type = 'meme', amount = 1, isVote = false) {
  redis.hdel('user-entries', id);

  return _saveQuery(_fetchUserQuery(id).merge({
    inventory: {
      [type]: r.row('inventory').default({}).getField(type).default(0).add(amount)
    },
    ...(isVote
      ? { upvoted: true }
      : { purchasedBox: Date.now() }
    )
  })).run();
};
