const axios = require('axios').default;
const logErrors = require('./logErrors.js');
const config = require('../config.json');

module.exports = (content) => {
  const body = typeof content === 'object'
    ? { embeds: [content] }
    : { content };

  return axios.post(
    `${config.discord_baseURL}/webhooks/${config.patreon_webhookID}/${config.patreon_webhook_token}?wait=true`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  ).catch(logErrors);
};
