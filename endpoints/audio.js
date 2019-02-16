const { join } = require('path');
const { logErrors } = require('../util');

const customPath = join(process.cwd(), '..', 'Dank-Memer', 'src', 'assets', 'audio', 'custom');

module.exports = (app, config) =>
  app.get('/audio/custom/:id/:file', (req, res) => {
    if (
      !req.query.token ||
      req.query.token !== config.memer_secret
    ) {
      return res.status(401).send({ status: 401 });
    }

    const filePath = join(customPath, req.params.id, `${req.params.file}.opus`);
    try {
      return res.status(200).sendFile(filePath);
    } catch (err) {
      logErrors(err);
      return res.status(500).send({ status: 500 });
    }
  });
