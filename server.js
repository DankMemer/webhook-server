process.env.NODE_ENV = process.argv.includes('--development')
  ? 'development'
  : 'production';

const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.json');
const sentry = require('@sentry/node');
const createMongoConnection = require('./db/mongo');

sentry.init({
  dsn: config.sentry.dsn,
  environment: config.sentry.environment,
  sampleRate: 1,
  tracesSampleRate: 0.1,
  maxValueLength: 512,
  normalizeDepth: 8,
  integrations: (integrations) =>
    integrations.filter(i => ![ 'Http', 'Console' ].includes(i.name))
});

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
