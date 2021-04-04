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

    res.status(200).send({ status: 200 });
  });

async function handleWebhook(body) {
 if (body.isWeekend) {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 50000, 'banknote', 'alcohol', 6, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`6 Banknotes, 6 Alcohol, and 50k coins`** for voting on top.gg!');
    } else {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 25000, 'banknote', 'alcohol', 3, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`3 Banknotes, 3 Alcohol, and 25k coins`** for voting on top.gg!');
    }
}
