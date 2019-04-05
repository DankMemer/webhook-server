process.env.NODE_ENV = process.argv.includes('--development')
  ? 'development'
  : 'production';

const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.json');
const createMongoConnection = require('./db/mongo');

const app = express();

app.use(bodyParser.text({ type: '*/*' }));

createMongoConnection().then(() => {
  const endpoints = require('./endpoints');

  for (const endpoint of endpoints) {
    endpoint(app, config);
  }
});

app.listen(config.port, () =>
  console.log('Server started on port', config.port, 'pid:', process.pid)
);
