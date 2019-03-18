const axios = require('axios').default;
const host = process.env.NODE_ENV === 'production'
  ? 'https://dankmemer.lol'
  : 'http://localhost';

module.exports = () =>
  axios.get(`${host}/api/boxes`)
    .then(res => res.data);
