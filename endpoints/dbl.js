const { addLootbox, mongo } = require('../db');
const { logErrors } = require('../util');
const recentlyReceived = new Set();

module.exports = (app, config) =>
  app.post('/dblwebhook', async (req, res) => {
    if (
      !req.headers.authorization ||
      req.headers.authorization !== config.dblorg_webhook_secret
    ) {
      return res.status(401).send({ status: 401 });
    }

    const body = JSON.parse(req.body);

    if (recentlyReceived.has(body.user)) {
      mongo.collection('duplicates').insertOne({ user: body.user, name: 'discordbots.org' });
      return res.status(425).send({ status: 425 });
    }

    if (body.type !== 'upvote') {
      res.status(400).send({ status: 400, message: `Unknown type ${body.type}` });
      return logErrors(new Error(`[DBL Webhook] Unknown payload type "${body.type}"`));
    }

    recentlyReceived.add(body.user);
    setTimeout(() => {
      recentlyReceived.remove(body.user);
    }, 60 * 60 * 1000);

    await addLootbox(body.user);
    res.status(200).send({ status: 200 });
  });
