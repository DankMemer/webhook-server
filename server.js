const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.json');
const endpoints = require('./endpoints');

process.env.NODE_ENV = 'development';

const app = express();

app.use(bodyParser.text({ type: '*/*' }));

for (const endpoint of endpoints) {
  endpoint(app, config);
}

app.listen(config.port, () =>
  console.log('Server started on port', config.port, 'pid:', process.pid)
);
