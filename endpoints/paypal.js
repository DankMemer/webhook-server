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

const sendFailWebhook = (data) => sendWebhook({
  raw: {
    color: 0xFF0000,
    title: 'Received illegitimate webhook',
    ...data
  }
});

module.exports = (app, config) =>
  app.post('/paypal', async (req, res) => {
    const body = JSON.parse(req.body);
    const validity = await validatePayPalIdentity(req, body);
    if (!validity.isValid) {
      sendFailWebhook({
        description: `\`\`\`json\n${JSON.stringify(body).slice(0, 2048)}\n\`\`\``,
        fields: [ {
          name: 'Validity',
          value: `\`\`\`json\n${JSON.stringify(validity, '', '  ')}\n\`\`\``
        } ]
      });
      return res.status(200).send({ status: 200 });
    }

    const paymentData = await axios.get(
      body.resource.links.find(link => link.rel === 'up').href, {
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

    const transaction = paymentData.purchase_units[0];
    const item = transaction.items[0];
    const total = Number(transaction.amount.value);
    const subtotal = Number(transaction.amount.breakdown.item_total.value);
    const theoreticalTotal = Number(item.quantity) * Number(item.unit_amount.value);

    const failConditions = [ {
      cond: theoreticalTotal.toFixed(2) !== subtotal.toFixed(2),
      name: 'Theoretical total did not match provided total',
      data: { theoreticalTotal, subtotal }
    }, {
      cond: (subtotal - total) > MAXIMUM_DISCOUNT,
      name: 'Discount exceeded MAXIMUM_DISCOUNT',
      data: { subtotal, total, MAXIMUM_DISCOUNT }
    }, {
      cond: Prices[item.name] !== item.unit_amount.value,
      name: 'Box price did not match item price',
      data: { price: Prices[item.name], providedPrice: item.unit_amount.value }
    }, {
      cond: total < MINIMUM_PURCHASE_AMOUNT,
      name: 'Minimum purchase amount did not meet requirement',
      data: { total, MINIMUM_PURCHASE_AMOUNT }
    } ];

    for (const condition of failConditions) {
      if (condition.cond) {
        sendFailWebhook({
          fields: [ {
            name: 'User',
            value: `${transaction.custom_id}\n\`\`\`json\n${JSON.stringify(paymentData.payer.name, '', '  ')}\n\`\`\``
          }, {
            name: 'Condition',
            value: `\`\`\`json\n${JSON.stringify(condition, '', '  ')}\n\`\`\``
          }, {
            name: 'ID',
            value: paymentData.id
          } ]
        });
        return res.status(200).send({ status: 200 });
      }
    }

    const decodedJWT = decodeJWT(transaction.custom_id);
    if (!decodedJWT) {
      sendFailWebhook({
        description: `Failed to decrypt custom ID: ${transaction.custom_id}`,
        fields: [ {
          name: 'User',
          value: `${transaction.custom_id}\n\`\`\`json\n${JSON.stringify(paymentData.payer.name, '', '  ')}\n\`\`\``
        }, {
          name: 'ID',
          value: paymentData.id
        } ]
      });
      return res.status(200).send({ status: 200 });
    }

    await addLootbox(
      decodedJWT,
      item.name.split(' ')[0].toLowerCase(),
      Number(item.quantity)
    ).catch(logErrors);

    sendWebhook({
      title: `Meme box: ${paymentData.id}`,
      color: 0x169BD7,
      discordID: decodedJWT,
      user: paymentData.payer,
      isPatreon: false,
      fields: [ {
        name: 'Purchase',
        value: `${item.quantity} ${item.name}${item.quantity > 1 ? 'es' : ''} ($${total.toFixed(2)} total)`
      } ]
    });

    res.status(200).send({ status: 200 });
  });
