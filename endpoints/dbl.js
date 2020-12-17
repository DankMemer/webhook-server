const { addVote, sendNotification, mongo } = require('../db');
const { logErrors } = require('../util');
const recentlyReceived = new Set();
const { StatsD } = require('node-dogstatsd');
const ddog = new StatsD();

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

    if (body.isWeekend) {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 10000, 'gift', 'normie', 4, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`4 normie boxes, 4 gifts, and 10k coins`** for voting on top.gg!');
    } else {
      ddog.increment(`webhooks.topgg.memer`);
      await addVote(body.user, 5000, 'gift', 'normie', 2, false);
      await sendNotification(body.user, 'vote', 'Thank you for voting!', 'You just got your **`2 normie boxes, 2 gifts, and 5k coins`** for voting on top.gg!');
    }

    res.status(200).send({ status: 200 });
  });
