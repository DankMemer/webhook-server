const { addVote, sendNotification } = require('../db');
const { StatsD } = require('node-dogstatsd');
const axios = require('axios').default;
const ddog = new StatsD();
const sentry = require('@sentry/node');

module.exports = (app, config) =>
  app.post('/dblistwebhook', async (req, res) => {
    const [ auth, timestamp ] = req.headers['x-dbl-signature']
      ? req.headers['x-dbl-signature'].split(/\s+/)
      : [ null ];

    if (auth !== config.dblcom_webhook_secret || (Date.now() - 1000 * 120) < timestamp) {
      res.status(401).send({ status: 401 });
    }

    const body = JSON.parse(req.body);
    handleWebhook(body, config).catch(err => {
      sentry.captureException(err, {
        contexts: {
          user: { id: body.id }
        }
      });
    });
  });

async function handleWebhook (body, config) {
  await addVote(body.id, 25000, 'banknote', 'daily', 4, true);
  await sendNotification(body.id, 'vote', 'Thank you for voting!', 'You just got your **`4 Banknotes, 1 Daily box, and 25k coins`** for voting on discordbotlist.com!');
  ddog.increment(`webhooks.dblcom`);

  await axios.post(`${config.rewrite_proxy_url}/dblcom`, body, {
    headers: config.rewrite_proxy_headers
  });
}
