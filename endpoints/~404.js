module.exports = (app, config) =>
  app.use(function (req, res, next) {
    res.status(404).send({ error: '404: You in the wrong part of town, boi.' });
  });
