const axios = require('axios').default;
const logErrors = require('./logErrors.js');
const config = require('../config.json');
const auth = Buffer.from(`${config.paypalID}:${config.paypalSecret}`).toString('base64');

module.exports = (req, body) =>
  axios.post(
    config.paypalVerifyURL, {
      auth_algo: req.headers['paypal-auth-algo'],
      cert_url: req.headers['paypal-cert-url'],
      transmission_id: req.headers['paypal-transmission-id'],
      transmission_sig: req.headers['paypal-transmission-sig'],
      transmission_time: req.headers['paypal-transmission-time'],
      webhook_id: config.paypalWebhookID,
      webhook_event: body
    }, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  ).then(r => r.data).catch(logErrors);
