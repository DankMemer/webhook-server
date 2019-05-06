const r = require('./r.js');
const { sendWebhook } = require('../util');
let mongo = require('./mongo.js');
if (mongo instanceof Promise) {
  mongo.then(res => (mongo = res));
}

module.exports = async function updateDonor (body) {
  const user = body.included.find(inc => inc.type === 'user');
  const discordID = user.attributes.social_connections &&
    user.attributes.social_connections.discord &&
    user.attributes.social_connections.discord.user_id;

  const { donor } = discordID
    ? await r.table('users').get(discordID).run()
    : await r.table('users').filter(doc =>
      doc.hasFields('donor').and(doc('donor')('patreonID').eq(user.id))
    ).run().then(users => users[0]);

  // Reset redeemed guilds if the patron decreased the amount they pledge and they don't meet the requirements anymore
  if (
    (donor.guilds.length > 3 && body.data.attributes.currently_entitled_amount_cents < 2000) ||
    (donor.guilds.length > 0 && body.data.attributes.currently_entitled_amount_cents < 500)
  ) {
    donor.guilds = [];
    donor.guildRedeems = 0;
  }

  await mongo.collection('patreonLogs').insertOne({
    type: 'members:pledge:update',
    before: donor.donorAmount,
    after: body.data.attributes.currently_entitled_amount_cents / 100,
    user: {
      name: user.attributes.full_name,
      patreonID: user.id,
      discordID: discordID || null
    }
  });

  donor.donorAmount = body.data.attributes.currently_entitled_amount_cents / 100;

  return r
    .table('users')
    .get(donor.id)
    .update({ donor })
    .run();
};
