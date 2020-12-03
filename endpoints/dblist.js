const { addVote, sendNotification, mongo } = require('../db');
const { StatsD } = require('node-dogstatsd');
const ddog = new StatsD();

module.exports = (app, config) =>
  app.post('/dblistwebhook', async (req, res) => {
    const [ auth, timestamp ] = req.headers['x-dbl-signature']
      ? req.headers['x-dbl-signature'].split(/\s+/)
      : [ null ];

    if (
      auth === config.dblcom_webhook_secret &&
      (Date.now() - 1000 * 120) < timestamp
    ) {
      const body = JSON.parse(req.body);
  
      await addVote(body.id, 2500, 'banknote', 'normie', 2, true);
      await sendNotification(body.id, 'vote', 'Thank you for voting!', 'You just got your **`2 normie boxes, 2 bank notes, and 2.5k coins`** for voting on discordbotlist.com!');
      ddog.increment(`webhooks.dblcom`);
      res.status(200).send({ status: 200 });
    } else {
      res.status(401).send({ status: 401 });
    }
  });
