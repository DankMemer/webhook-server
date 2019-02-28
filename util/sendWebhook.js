const axios = require('axios').default;
const logErrors = require('./logErrors.js');
const config = require('../config.json');

module.exports = ({
  raw, title, color, fields, user, discordID, isPatreon = true
}) => {
  return axios.post(
    `${config.discord_baseURL}/webhooks/${config.donor_webhookID}/${config.donor_webhook_token}?wait=true`, {
      embeds: [ raw || {
        title,
        color,
        fields: [ {
          name: 'User',
          value: isPatreon
            ? user.attributes.full_name
            : `${user.name.given_name} ${user.name.surname}`,
          inline: true
        }, {
          name: `Discord ID / ${isPatreon ? 'Patreon' : 'PayPal'} ID`,
          value: `${discordID || '`null`'} / ${user[isPatreon ? 'id' : 'payer_id']}`,
          inline: true
        },
        ...fields ]
      } ]
    }, {
      headers: { 'Content-Type': 'application/json' }
    }
  ).catch(e => logErrors(e.response.data));
};
