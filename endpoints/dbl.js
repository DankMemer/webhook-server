const { addLootbox } = require('../db');
const { logErrors } = require('../util');

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
      res.status(400).send({ status: 401, message: `Unknown type ${body.type}` });
      return logErrors(new Error(`[DBL Webhook] Unknown payload type "${body.type}"`));
    }

    await addLootbox(body.user);
    res.status(200).send({ status: 200 });
  });
