const axios = require('axios').default;
const logErrors = require('./logErrors.js');
const config = require('../config.json');

module.exports = ({ title, color, field, user, discordID }) => {
  return axios.post(
    `${config.discord_baseURL}/webhooks/${config.patreon_webhookID}/${config.patreon_webhook_token}?wait=true`, {
      title,
      color,
      fields: [ {
        name: 'User',
        value: user.attributes.full_name,
        inline: true
      }, {
        name: 'Discord ID / Patreon ID',
        value: `${discordID || '`null`'} / ${user.id}`,
        inline: true
      },
      field ]
    },
    { headers: { 'Content-Type': 'application/json' } }
  ).catch(logErrors);
};
