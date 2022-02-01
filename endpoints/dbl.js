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
      await addVote(body.user, 20000, 'adventureticket', 'daily', 2, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`2 Adventure Tickets, 1 Daily box, and 20k coins`** for voting on top.gg!');
    } else {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 10000, 'adventureticket', 'daily', 1, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`Adventure Ticket, Daily box, and 10k coins`** for voting on top.gg!');
    }
}
