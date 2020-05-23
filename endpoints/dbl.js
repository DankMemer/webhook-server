const { addLootbox, mongo } = require('../db');
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

    if (body.bot === '201503408652419073') {
      ddog.increment(`webhooks.topgg.octave`);
    } else if (body.bot === '702604525529202749') {
      ddog.increment(`webhooks.topgg.apex`);
    } else {
      ddog.increment(`webhooks.topgg.memer`);
      await addLootbox(body.user);
    }
    res.status(200).send({ status: 200 });
  });
