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
    await addVote(body.user, 40000, 'gift', 'normie', 2, false);
    await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`2 Gift for a Friend, 2 Normie Boxes, and 40k coins`** for voting on top.gg!');
  } else {
    ddog.increment(`webhooks.topgg.memer`);
    await addVote(body.user, 20000, 'gift', 'normie', 1, false);
    await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`1 Gift for a Friend, 1 Normie Box, and 20k coins`** for voting on top.gg!');
  }
}
