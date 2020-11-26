const _saveQuery = require('./_saveQuery.js');
const _fetchUserQuery = require('./_fetchUserQuery.js');
const r = require('./r.js');
const redis = require('./redis');

module.exports = async function addVote (id, coins = 1000, itemOne = 'pinkphallicobject', itemTwo = 'meme', itemAmount = 1, isDbl = false) {
  redis.hdel('user-entries', id);

  return _saveQuery(_fetchUserQuery(id).merge({
    voteReminderWaiting: true,
    pocket: r.row('pocket').default(500).add(coins),
    inventory: {
        [itemOne]: r.row('inventory').default({}).getField(itemOne).default(0).add(itemAmount),
        [itemTwo]: r.row('inventory').default({}).getField(itemTwo).default(0).add(itemAmount)
      },
    upvoted: true,
    ...(isDbl
        ? { lastDblVote: Date.now() }
        : { lastTopggVote: Date.now() }
      )
  })).run();
};
