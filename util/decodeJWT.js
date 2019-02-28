const { createDecipheriv } = require('crypto');
const { cryptKeys } = require('../config.json');

const [
  key,

  // TODO: make initVector unique per boot, share with dankmemer.lol over Redis
  initVector
] = cryptKeys.map(key => Buffer.from(key, 'base64'));

const crypt = (cipher, data, inputType, outputType) =>
  Buffer.concat([
    cipher.update(data, inputType),
    cipher.final()
  ]).toString(outputType);

module.exports = (data, inputType = 'base64', outputType = 'utf8') => {
  try {
    const result = crypt(
      createDecipheriv('aes-256-ctr', key, initVector),
      data,
      inputType,
      outputType
    );
    return !isNaN(result) && result.length > 16 && result;
  } catch (e) {
    return false;
  }
};
