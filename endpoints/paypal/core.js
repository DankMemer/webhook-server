const {
  validatePayPalIdentity,
  decodeJWT,
  getBoxData,
  sendWebhook
} = require('../../util');
const { addLootbox, sendNotification, mongo } = require('../../db');
const config = require('../../config.json');
const lighttp = require('lighttp');
const { StatsD } = require('node-dogstatsd');
const ddog = new StatsD();

const auth = Buffer.from(`${config.paypalID}:${config.paypalSecret}`).toString('base64');
const recentlyReceived = new Set();

let Constants, boxes;
getBoxData()
  .then(data => (
    { Constants, boxes } = data
  ))
  .catch(err => sendWebhook({
    title: 'Failed to request box data',
    description: `${err.response ? err.response.statusCode : err.message}`
  }));

const IGNORED_EVENTS = [
  'PAYMENT.CAPTURE.PENDING',
  'RISK.DISPUTE.CREATED',
  'CUSTOMER.DISPUTE.CREATED',
  'CUSTOMER.DISPUTE.UPDATED'
];

const eventSchema = {
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  event_version: '1.0',
  resource_type: 'capture',
  resource_version: '2.0'
};

module.exports = async (req, res) => {
  const body = JSON.parse(req.body);
  const { id } = body.resource;
  ddog.increment(`paypal.${body.event_type}`);

  if (IGNORED_EVENTS.includes(body.event_type)) {
    return {
      didAddBoxes: false,
      resend: false,
      data: body,
      webhook: {
        title: 'ignoring event type',
        description: body.event_type
      }
    };
  }

  for (const prop in eventSchema) {
    if (body[prop] !== eventSchema[prop]) {
      return {
        didAddBoxes: false,
        resend: false,
        data: body,
        webhook: {
          title: 'mismatched event schema',
          fields: [
            { name: 'Expected', value: `${prop}: ${eventSchema[prop]}` },
            { name: 'Received', value: `${prop}: ${body[prop]}` }
          ],
          footer: { text: `Resource ID: ${id}` }
        }
      };
    }
  }

  if (recentlyReceived.has(id)) {
    return {
      didAddBoxes: false,
      resend: false,
      data: body,
      webhook: {
        title: 'Deflected duplicate webhook',
        fields: [
          { name: 'ID', value: id }
        ]
      }
    };
  } else {
    recentlyReceived.add(id);
    setTimeout(
      recentlyReceived.delete.bind(recentlyReceived, id),
      15 * 60 * 1000
    );
  }

  const validity = await validatePayPalIdentity(req, body);
  if (!validity.isValid) {
    return {
      didAddBoxes: false,
      resend: true,
      webhook: {
        fields: [ {
          name: 'Validity',
          value: `\`\`\`json\n${JSON.stringify(validity, '', '  ')}\n\`\`\``
        }, {
          name: 'Order ID',
          value: body.resource ? body.resource.id : 'Not supplied'
        } ]
      },
      data: body
    };
  }

  const paymentData = await lighttp.get(body.resource.links.find(link => link.rel === 'up').href)
    .header('Authorization', `Basic ${auth}`)
    .then(r => r.body)
    .catch(e => e);

  if (paymentData instanceof Error) {
    return {
      didAddBoxes: false,
      resend: true,
      webhook: {
        title: 'failed to GET paymentData',
        description: JSON.stringify(paymentData.result.body)
      },
      data: body
    };
  }

  const transaction = paymentData.purchase_units[0];
  const payer = paymentData.payer;
  const item = transaction.items[0];
  const total = Number(transaction.amount.value);
  const subtotal = Number(transaction.amount.breakdown.item_total.value);
  const theoreticalTotal = Number(item.quantity) * Number(item.unit_amount.value);
  const discountPercent = await (async () => {
    const flashDiscount = await mongo.collection('discounts').findOne({ expiry: { $gt: Date.now() } });
    const flashDiscountPercentage = flashDiscount ? flashDiscount.percent : 0;

    if (item.name === 'Normie Box') {
      return 0;
    }

    return subtotal > Constants.MINIMUM_DISCOUNT_VALUE
      ? Constants.FLAT_DISCOUNT_PERCENTAGE + flashDiscountPercentage
      : flashDiscountPercentage;
  })();
  ddog.incrementBy(`paypal.totalMade`, total);
  ddog.increment(`paypal.totalPurchased`);

  const failConditions = [ {
    cond: theoreticalTotal.toFixed(2) !== subtotal.toFixed(2),
    name: 'Theoretical total did not match provided total',
    data: { theoreticalTotal, subtotal }
  }, {
    cond: subtotal > Constants.MINIMUM_DISCOUNT_VALUE &&
    (subtotal - total - 0.1) > (subtotal * (discountPercent / 100)),
    name: 'Provided discount exceeded theoretical discount',
    data: {
      total,
      expected: (subtotal * (discountPercent / 100)).toFixed(2),
      received: (subtotal - total).toFixed(2),
      discountPercentage: discountPercent
    }
  }, {
    cond: boxes.find(b => b.name === item.name).price.toFixed(2) !== item.unit_amount.value,
    name: 'Box price did not match item price',
    data: { price: boxes.find(b => b.name === item.name).price, providedPrice: item.unit_amount.value }
  }, {
    cond: total < Constants.MINIMUM_PURCHASE_AMOUNT,
    name: 'Minimum purchase amount did not meet requirement',
    data: { total, min: Constants.MINIMUM_PURCHASE_AMOUNT }
  } ];

  for (const condition of failConditions) {
    if (condition.cond) {
      return {
        didAddBoxes: false,
        resend: false,
        webhook: {
          fields: [ {
            name: 'User',
            value: `${transaction.custom_id}\n\`\`\`json\n${JSON.stringify(payer.name, '', '  ')}\n\`\`\``
          }, {
            name: 'Condition',
            value: `\`\`\`json\n${JSON.stringify(condition, '', '  ')}\n\`\`\``
          }, {
            name: 'ID',
            value: paymentData.id
          } ]
        },
        data: body
      };
    }
  }

  const idSegments = transaction.custom_id.split(':');
  const customerID = decodeJWT(idSegments[0]);
  let giftUserID = idSegments[1];

  if (!customerID) {
    return {
      didAddBoxes: false,
      resend: false,
      webhook: {
        description: `Failed to decrypt custom ID: ${transaction.custom_id}`,
        fields: [ {
          name: 'User',
          value: `${transaction.custom_id}\n\`\`\`json\n${JSON.stringify(payer.name, '', '  ')}\n\`\`\``
        }, {
          name: 'ID',
          value: paymentData.id
        } ]
      },
      data: body
    };
  }

  if (giftUserID) {
    const isValid = await lighttp
      .get(`https://discordapp.com/api/v7/users/${giftUserID}`)
      .header('Authorization', `Bot ${config.botToken}`)
      .then(() => true)
      .catch(() => false);
    if (!isValid) {
      giftUserID = null;
      await sendNotification(customerID, 'gift', 'The user ID you tried to send a gift to is invalid.', 'The boxes have instead been sent to your inventory.');
    } else {
      await sendNotification(giftUserID, 'gift', 'You received a gift!', `You received **${item.quantity} ${item.name}es** from ${customer.username}#${customer.discriminator}.`);
    }
  }

  const customer = await lighttp
    .get(`https://discordapp.com/api/v7/users/${customerID}`)
    .header('Authorization', `Bot ${config.botToken}`)
    .then(res => res.body);

  await addLootbox(
    giftUserID || customerID,
    item.name.split(' ')[0].toLowerCase(),
    Number(item.quantity)
  );

  const {
    email = 'None provided',
    ip = []
  } = await mongo.collection('users').findOne({ _id: customerID }) || {};

  await mongo.collection('purchases').insertOne({
    orderID: id,
    captureID: transaction.payments.captures[0].id,
    amount: ({
      ...transaction.amount.breakdown,
      total: transaction.amount.value
    }),
    payer: {
      name: `${payer.name.given_name} ${payer.name.surname}`,
      paypalEmail: payer.email_address,
      discordEmail: email,
      paypalID: payer.payer_id,
      userID: customerID,
      giftUserID,
      userIDEncoded: transaction.custom_id,
      ip
    },
    item: {
      name: item.name,
      quantity: item.quantity,
      price: item.unit_amount.value
    },
    times: {
      create: new Date(body.resource.create_time).getTime(),
      update: new Date(body.resource.update_time).getTime()
    }
  });

  return {
    didAddBoxes: true,
    resend: false,
    webhook: {
      title: `added boxes to ${giftUserID || customerID} ${giftUserID ? `(bought by ${customerID})` : ''}`,
      description: `\`\`\`json\n${JSON.stringify(item, '', '  ')}\n\`\`\``
    },
    data: body
  };
};
