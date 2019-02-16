const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.json');
const endpoints = require('./endpoints');

const app = express();

app.use(bodyParser.text({ type: '*/*' }));

for (const endpoint of endpoints) {
  endpoint(app, config);
}

app.listen(8585, () =>
  console.log('Server started on port 8585, pid:', process.pid)
);
