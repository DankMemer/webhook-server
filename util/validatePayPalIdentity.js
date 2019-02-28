const axios = require('axios').default;
const crc32 = require('buffer-crc32');
const { logErrors } = require('../util');
const config = require('../config.json');
const { createVerify } = require('crypto');

module.exports = async (req, body) => {
  if (req.headers['paypal-auth-algo'] !== 'SHA256withRSA') {
    return {
      isValid: false,
      reason: `Unsupported algorithm \`${req.headers['paypal-auth-algo']}\``
    };
  }

  const cert = await axios(req.headers['paypal-cert-url'])
    .then(r => r.data)
    .catch(logErrors);
  if (!cert) {
    return {
      isValid: false,
      reason: `Failed to GET certificate ${req.headers['paypal-cert-url']}`
    };
  }

  const input = [
    req.headers['paypal-transmission-id'],
    req.headers['paypal-transmission-time'],
    config.paypalWebhookID,
    crc32.unsigned(req.body)
  ].join('|');

  const isValid = createVerify('sha256WithRSAEncryption')
    .update(input)
    .end()
    .verify(cert, req.headers['paypal-transmission-sig'], 'base64');

  return {
    isValid,
    ...(isValid || { reason: 'Failed signature validation' })
  };
};
