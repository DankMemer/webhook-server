const { sendPatreonWebhook, getNextMonthUTC } = require('../util');
const r = require('./r.js');

module.exports = function removeDonor (body) {
  const user = body.included.find(inc => inc.type === 'user');
  const discordID = user.attributes.social_connections &&
    user.attributes.social_connections.discord &&
    user.attributes.social_connections.discord.user_id;

  sendPatreonWebhook({
    title: 'Pledge Delete',
    color: 0xf73a33,
    fields: [ {
      name: 'User',
      value: user.attributes.full_name,
      inline: true
    }, {
      name: 'Discord ID / Patreon ID',
      value: `${discordID || '`null`'} / ${user.id}`,
      inline: true
    }, {
      name: 'Total Amount Pledged',
      value: `$${body.data.attributes.lifetime_support_cents / 100}`
    } ]
  });

  return r
    .table('users')
    .getAll(user.id, { index: 'patreonID' })
    .nth(0)
    .update({
      perksExpireAt: getNextMonthUTC()
    })
    .run();
};
