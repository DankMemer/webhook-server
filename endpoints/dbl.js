const { addVote, sendNotification, mongo } = require('../db');
const { logErrors } = require('../util');
const { StatsD } = require('node-dogstatsd');
const ddog = new StatsD();
const sentry = require('@sentry/node');

module.exports = (app, config) =>
  app.post('/dblwebhook', async (req, res) => {
    if (
      !req.headers.authorization ||
      req.headers.authorization !== config.dblorg_webhook_secret
    ) {
      return res.status(401).send({ status: 401 });
    }

    const body = JSON.parse(req.body);

    if (body.type !== 'upvote') {
      res.status(400).send({ status: 400, message: `Unknown type ${body.type}` });
      return logErrors(new Error(`[DBL Webhook] Unknown payload type "${body.type}"`));
    }

    handleWebhook(body).catch(err => {
      sentry.captureException(err, {
        contexts: {
          user: { id: body.user }
        }
      })
    });

    res.status(200).send({ status: 200 });
  });

async function handleWebhook(body) {
 if (body.isWeekend) {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 50000, 'banknote', 'daily', 8, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`8 Banknotes, 1 Daily box, and 50k coins`** for voting on top.gg!');
    } else {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 25000, 'banknote', 'daily', 4, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`4 Banknotes, 1 Daily box, and 25k coins`** for voting on top.gg!');
    }
}
