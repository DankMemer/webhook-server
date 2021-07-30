const { addVote, sendNotification, mongo } = require('../db');
const { StatsD } = require('node-dogstatsd');
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
    handleWebhook(body).catch(err => {
      sentry.captureException(err, {
        contexts: {
          user: { id: body.id }
        }
      })
    });
  });


async function handleWebhook(body) {
  await addVote(body.id, 30000, 'banknote', 'daily', 3, true);
      await sendNotification(body.id, 'vote', 'Thank you for voting!', 'You just got your **`3 Banknotes, 1 Daily box, and 50k coins`** for voting on discordbotlist.com!');
  ddog.increment(`webhooks.dblcom`);
}
