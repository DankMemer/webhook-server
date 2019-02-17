const { validatePayPalIdentity, logErrors, decodeJWT, sendWebhook } = require('../util');
const { addLootbox } = require('../db');
const axios = require('axios').default;
const config = require('../config.json');
const auth = Buffer.from(`${config.paypalID}:${config.paypalSecret}`).toString('base64');

const MAXIMUM_DISCOUNT = 1.50;
const MINIMUM_PURCHASE_AMOUNT = 1.95;
const Prices = {
  'Normie Box': '0.49',
  'Dank Box': '3.99',
  'Meme Box': '1.99'
};

module.exports = (app, config) =>
  app.post('/paypal', async (req, res) => {
    const body = JSON.parse(req.body);
    const validity = await validatePayPalIdentity(req, body);
    if (
      !validity ||
      validity.verification_status !== 'SUCCESS'
    ) {
      return res.status(401).send({ status: 401 });
    }

    const paymentData = await axios.get(
      body.resource.links.find(link => link.rel === 'parent_payment').href, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    )
      .then(r => r.data)
      .catch(logErrors);

    if (!paymentData) {
      return res.status(500).send({ status: 500 });
    }

    const transaction = paymentData.transactions[0];
    const item = transaction.item_list.items[0];
    const total = Number(transaction.amount.total);
    const subtotal = Number(transaction.amount.details.subtotal);
    const theoreticalTotal = item.quantity * Number(item.price);

    if (
      theoreticalTotal !== subtotal ||
      (subtotal - total) > MAXIMUM_DISCOUNT ||
      Prices[item.name] !== item.price ||
      total < MINIMUM_PURCHASE_AMOUNT
    ) {
      return res.status(401).send({ status: 401 });
    }

    const decodedJWT = await decodeJWT(transaction.custom).catch(logErrors);
    if (!decodedJWT) {
      return res.status(401).send({ status: 401 });
    }

    await addLootbox(decodedJWT.id, item.name.split(' ')[0].toLowerCase()).catch(logErrors);
    sendWebhook({
      title: 'Meme Box Purchase',
      color: 0x169BD7,
      discordID: decodedJWT.id,
      user: paymentData.payer.payer_info,
      isPatreon: false,
      field: {
        name: 'Purchase',
        value: `${item.quantity} ${item.name}${item.quantity > 1 ? 'es' : ''} ($${total} total)`
      }
    });

    res.status(200).send({ status: 200 });
  });