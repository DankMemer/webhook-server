const { validatePatreonIdentity, logErrors } = require('../util');
const { addDonor, removeDonor, updateDonor } = require('../db');

module.exports = (app, config) =>
  app.post('/patreonwebhook', async (req, res) => {
    if (!validatePatreonIdentity(req.body, config.patreon_webhook_secret)) {
      return res.status(401).send({ status: 401 });
    }

    const body = JSON.parse(req.body);

    switch (req.headers[ 'x-patreon-event' ]) {
      case 'members:pledge:create':
        await addDonor(body).catch(logErrors);
        break;

      case 'members:pledge:delete':
        await removeDonor(body).catch(logErrors);
        break;

      case 'members:pledge:update':
        await updateDonor(body).catch(logErrors);
        break;
    }

    res.status(200).send({ status: 200 });
  });
