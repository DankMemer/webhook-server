const { addLootbox, mongo } = require('../db');
const { logErrors } = require('../util');
const recentlyReceived = new Set();
const { StatsD } = require('node-dogstatsd');
const ddog = new StatsD();

module.exports = (app, config) =>
  app.post('/bfd', async (req, res) => {
    if (
      !req.headers.authorization ||
      req.headers.authorization !== config.bfd_webhook_secret
    ) {
      return res.status(401).send({ status: 401 });
    }

    const body = JSON.parse(req.body);

    if (body.type !== 'vote') {
      res.status(400).send({ status: 400, message: `Unknown type ${body.type}` });
      return logErrors(new Error(`[BFD Webhook] Unknown payload type "${body.type}"`));
    }

    if (body.bot === '201503408652419073') {
      ddog.increment(`webhooks.bfd.octave`);
    } else {
      ddog.increment(`webhooks.bfd.memer`);
    }

    await addLootbox(body.user, 'meme', 1, true);
    res.status(200).send({ status: 200 });
  });
