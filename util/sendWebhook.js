const axios = require('axios').default;
const logErrors = require('./logErrors.js');
const config = require('../config.json');

module.exports = ({
  title, color, field, user, discordID, isPatreon = true
}) => {
  return axios.post(
    `${config.discord_baseURL}/webhooks/${config.donor_webhookID}/${config.donor_webhook_token}?wait=true`, { embeds: [ {
      title,
      color,
      fields: [ {
        name: 'User',
        value: isPatreon
          ? user.attributes.full_name
          : `${user.first_name} ${user.last_name}`,
        inline: true
      }, {
        name: `Discord ID / ${isPatreon ? 'Patreon' : 'PayPal'} ID`,
        value: `${discordID || '`null`'} / ${user[isPatreon ? 'id' : 'payer_id']}`,
        inline: true
      },
      field ]
    } ] }, {
      headers: { 'Content-Type': 'application/json' }
    }
  ).catch(logErrors);
};
