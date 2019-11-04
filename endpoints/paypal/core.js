const {
  validatePayPalIdentity,
  decodeJWT,
  getBoxData,
  sendWebhook
} = require('../../util');
const { addLootbox, mongo } = require('../../db');

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

const eventSchema = {
  event_type: 'CHECKOUT.ORDER.APPROVED',
  event_version: '1.0',
  resource_type: 'checkout-order',
  resource_version: '2.0'
};

module.exports = async (req, res) => {
  const body = JSON.parse(req.body);
  const { id } = body.resource;

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

  const transaction = body.resource.purchase_units[0];
  const payer = body.resource.payer;
  const capture = transaction.payments.captures[0];
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
            value: id
          } ]
        },
        data: body
      };
    }
  }

  const decodedJWT = decodeJWT(transaction.custom_id);
  if (!decodedJWT) {
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
          value: id
        } ]
      },
      data: body
    };
  }

  await addLootbox(
    decodedJWT,
    item.name.split(' ')[0].toLowerCase(),
    Number(item.quantity)
  );

  const {
    email = 'None provided',
    ip = []
  } = await mongo.collection('users').findOne({ _id: decodedJWT }) || {};

  await mongo.collection('purchases').insertOne({
    orderID: id,
    captureID: capture.id,
    amount: ({
      ...transaction.amount.breakdown,
      total: transaction.amount.value
    }),
    payer: {
      name: `${payer.name.given_name} ${payer.name.surname}`,
      paypalEmail: payer.email_address,
      discordEmail: email,
      paypalID: payer.payer_id,
      userID: decodedJWT,
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
      title: `added boxes to ${decodedJWT}`,
      description: `\`\`\`json\n${JSON.stringify(item, '', '  ')}\n\`\`\``
    },
    data: body
  };
};
