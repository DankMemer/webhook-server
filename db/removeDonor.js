const { sendWebhook, getNextMonthUTC } = require('../util');
const r = require('./r.js');
let mongo = require('./mongo.js');
if (mongo instanceof Promise) {
  mongo.then(res => (mongo = res));
}

module.exports = async function removeDonor (body) {
  const user = body.included.find(inc => inc.type === 'user');
  const discordID = user.attributes.social_connections &&
    user.attributes.social_connections.discord &&
    user.attributes.social_connections.discord.user_id;

  await mongo.collection('patreonLogs').insertOne({
    type: 'members:pledge:delete',
    user: {
      name: user.attributes.full_name,
      patreonID: user.id,
      discordID: discordID || null
    },
    total: body.data.attributes.lifetime_support_cents / 100
  })

  return r
    .table('users')
    .getAll(user.id, { index: 'patreonID' })
    .nth(0)
    .update({
      perksExpireAt: getNextMonthUTC()
    })
    .run();
};
