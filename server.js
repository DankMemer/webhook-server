const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const { parse: parseQuerystring } = require('querystring');
const r = require('rethinkdbdash')();
const config = require('./config.json');
const crypto = require('crypto');
const { join } = require('path');
const { StatsD } = require('node-dogstatsd');
const ddog = new StatsD();
const axios = require('axios').default;

app.use(bodyParser.text({ type: '*/*' }));

setInterval(() => checkDonors.catch(console.error), 60000 * 30);

// discordbots.org webhooks
app.post('/dblwebhook', async (req, res) => {
  req.body = JSON.parse(req.body);
  if (req.headers.authorization) {
    if ((req.headers.authorization === config.dblorg_webhook_secret) && (req.body.type === 'upvote')) {
      ddog.increment('webhooks.dblorg.upvote');
      await addLootbox(req.body.user);
      res.status(200).send({ status: 200 });
    } else {
      res.status(401).send({ status: 401 });
    }
  } else {
    res.status(403).send({ status: 403 });
  }
});

// discordbotlist.com webhooks
app.post('/dblistwebhook', async (req, res) => {
  req.body = parseQuerystring(req.body);
  if (req.headers['x-dbl-signature']) {
    if ((req.headers['x-dbl-signature'].split(/\s+/)[0] === config.dblcom_webhook_secret) && ((Date.now() - 1000 * 120) < req.headers['x-dbl-signature'].split(/\s+/)[1])) {
      ddog.increment('webhooks.dblcom.upvote');
      await addLootbox(req.body.id);
      res.status(200).send({ status: 200 });
    } else {
      res.status(401).send({ status: 401 });
    }
  } else {
    res.status(403).send({ status: 403 });
  }
});

// Patreon webhooks
app.post('/patreonwebhook', async (req, res) => {
  if (req.headers['x-patreon-signature']) {
    if (validatePatreonIdentity(req)) {
      req.body = JSON.parse(req.body);
      if (req.headers['x-patreon-event'] === 'members:pledge:create') {
        await addDonor(req.body).catch(console.error);
      } else if (req.headers['x-patreon-event'] === 'members:pledge:delete') {
        await removeDonor(req.body).catch(console.error);
      } else if (req.headers['x-patreon-event'] === 'members:pledge:update') {
        await updateDonor(req.body).catch(console.error);
      }
      res.status(200).send({ status: 200 });
    } else {
      ddog.increment('webhooks.patreon.noAuth');
      res.status(401).send({ status: 401 });
    }
  } else {
    ddog.increment('webhooks.patreon.noHeader');
    res.status(403).send({ status: 403 });
  }
});

app.get('/audio/custom/:id/:file', (req, res) => {
  if (!req.query.token) {
    res.status(403).send({ status: 403 });
  } else if (req.query.token !== config.memer_secret) {
    res.status(401).send({ status: 401 });
  }
  const filePath = join(process.cwd(), '..', 'Dank-Memer', 'src', 'assets', 'audio', 'custom', req.params.id, `${req.params.file}.opus`);
  try {
    return res.status(200).sendFile(filePath);
  } catch (err) {
    return res.status(500).send({ status: 500 });
  }
});

app.use(function (req, res, next) {
  ddog.increment('webhooks.404');
  res.status(404).send({ error: '404: You in the wrong part of town, boi.' });
});

async function addDonor (body) {
  const user = body.included.find(inc => inc.type === 'user');
  sendPatreonWebhook({
    title: 'Pledge Create',
    color: 0x71f23e,
    fields: [{
      name: 'User',
      value: user.attributes.full_name,
      inline: true
    }, {
      name: 'Discord ID / Patreon ID',
      value: (user.attributes.social_connections && user.attributes.social_connections.discord && user.attributes.social_connections.discord.user_id ? user.attributes.social_connections.discord.user_id : '`null`') + ` / ${user.id}`,
      inline: true
    }, {
      name: 'Amount Pledged',
      value: `${body.data.attributes.currently_entitled_amount_cents / 100}$`
    }]
  });
  if (!user.attributes.social_connections || !user.attributes.social_connections.discord || !user.attributes.social_connections.discord.user_id) {
    return;
  }
  ddog.increment('webhooks.patreon.create');
  return _saveQuery(_fetchUserQuery(user.attributes.social_connections.discord.user_id).merge({ donor: {
    donorAmount: body.data.attributes.currently_entitled_amount_cents / 100,
    guilds: [],
    guildRedeems: 0,
    firstDonationDate: body.data.attributes.pledge_relationship_start || r.now(),
    declinedSince: null,
    patreonID: user.id
  } })).run();
}

function removeDonor (body) {
  const user = body.included.find(inc => inc.type === 'user');
  sendPatreonWebhook({
    title: 'Pledge Delete',
    color: 0xf73a33,
    fields: [{
      name: 'User',
      value: user.attributes.full_name,
      inline: true
    }, {
      name: 'Discord ID / Patreon ID',
      value: (user.attributes.social_connections && user.attributes.social_connections.discord && user.attributes.social_connections.discord.user_id ? user.attributes.social_connections.discord.user_id : '`null`') + ` / ${user.id}`,
      inline: true
    }, {
      name: 'Total Amount Pledged',
      value: `${body.data.attributes.lifetime_support_cents / 100}$`
    }]
  });
  ddog.increment('webhooks.patreon.delete');
  return r.table('users').getAll(user.id, { index: 'patreonID' })
    .nth(0)
    .update({
      perksExpireAt: getNextMonthUTC()
    })
    .run();
}

async function updateDonor (body) {
  const user = body.included.find(inc => inc.type === 'user');
  let donor;
  if (user.attributes.social_connections && user.attributes.social_connections.discord && user.attributes.social_connections.discord.user_id) {
    ddog.increment('webhooks.patreon.update');
    donor = await r.table('users').get(user.attributes.social_connections.discord.user_id).run();
  } else {
    donor = await r.table('users').filter(function (doc) {
      return doc.hasFields('donor').and(doc('donor')('patreonID').eq(user.id));
    }).run().then(users => users[0]);
  }
  // Reset redeemed guilds if the patron decreased the amount they pledge and they don't meet the requirements anymore
  if ((donor.donor.guilds.length > 3 && body.data.attributes.currently_entitled_amount_cents < 2000) ||
  (donor.donor.guilds.length > 0 && body.data.attributes.currently_entitled_amount_cents < 500)) {
    donor.donor.guilds = [];
    donor.donor.guildRedeems = 0;
  }
  sendPatreonWebhook({
    title: 'Pledge Update',
    color: 0xf7dc32,
    fields: [{
      name: 'User',
      value: user.attributes.full_name,
      inline: true
    }, {
      name: 'Discord ID / Patreon ID',
      value: (user.attributes.social_connections && user.attributes.social_connections.discord && user.attributes.social_connections.discord.user_id ? user.attributes.social_connections.discord.user_id : '`null`') + ` / ${user.id}`,
      inline: true
    }, {
      name: 'Amount Pledged Update',
      value: `${donor.donor.donorAmount}$ => ${body.data.attributes.lifetime_support_cents / 100}$`
    }]
  });
  donor.donor.donorAmount = body.data.attributes.currently_entitled_amount_cents / 100;
  return r.table('users').get(donor.id).update({ donor: donor.donor }).run();
}

function launchServer () {
  const http = require('http');
  http.createServer(app).listen(8585);
  ddog.increment('webhooks.function.launchServer');
  console.log(`Server started on port 8585 pid: ${process.pid}`);
}

launchServer();

function validatePatreonIdentity (req) {
  let hash = req.headers['x-patreon-signature'];

  let hmac = crypto.createHmac('md5', config.patreon_webhook_secret);
  hmac.update(req.body);
  let crypted = hmac.digest('hex');
  return crypted === hash;
}

function formatTime (time) { // eslint-disable-line no-unused-vars
  let days = Math.floor(time % 31536000 / 86400);
  let hours = Math.floor(time % 31536000 % 86400 / 3600);
  let minutes = Math.floor(time % 31536000 % 86400 % 3600 / 60);
  let seconds = Math.round(time % 31536000 % 86400 % 3600 % 60);
  days = days > 9 ? days : '0' + days;
  hours = hours > 9 ? hours : '0' + hours;
  minutes = minutes > 9 ? minutes : '0' + minutes;
  seconds = seconds > 9 ? seconds : '0' + seconds;
  return `${days > 0 ? `${days}:` : ``}${(hours || days) > 0 ? `${hours}:` : ``}${minutes}:${seconds}`;
}

function getUser (id, amount) {
  return {
    id, // User id/rethink id
    pls: 1, // Total commands ran
    lastCmd: Date.now(), // Last command time
    lastRan: 'nothing', // Last command ran
    pocket: amount || 0, // Coins not in bank account
    bank: 0, // Coins in bank account
    experience: 0, // Total experience earned
    inventory: {}, // Items the user has, an object of item ID's with the value being the quantity
    activeitems: [], // Array of item ID's
    level: 0, // The level the user is currently at
    notifications: [], // Notifications object,
    transactions: [],
    title: '', // string
    lost: 0, // Total coins lost
    won: 0, // Total coins won
    shared: 0, // Transferred to other players,
    stolenFromAt: 0,
    wonLotteryAt: 0,
    heistedFromAt: 0,
    joinedHeistAt: 0,
    perksExpireAt: 0,
    streak: {
      time: 0, // Time since last daily command
      streak: 0 // Total current streak
    },
    upgrades: {
      multi: 0,
      luck: 0
    },
    ghostBlacklist: 0, // Integer, level of ghost-blacklist,
    blacklisted: false,
    upvoted: false, // DBL voter status
    dblUpvoted: false, // discordbotlist.com voter status, DEPRECATED
    donor: null
  };
}

function _fetchUserQuery (id) {
  return r.table('users').get(id).default(getUser(id));
}

function _saveQuery (data) {
  return r.table('users').insert(data, { conflict: 'update' });
}

async function addLootbox (id) {
  return _saveQuery(_fetchUserQuery(id).merge({ inventory: {
    normie: r.row('inventory').default({}).getField('normie').default(0).add(1)
  },
  upvoted: true })).run();
}

function getNextMonthUTC () {
  let date = new Date();
  date.setUTCHours(0);
  date.setUTCMinutes(0);
  date.setUTCMilliseconds(0);
  date.setUTCDate(1);
  if (date.getUTCMonth() === 11) {
    date.setUTCFullYear(date.getUTCFullYear() + 1, 0);
  } else {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return date.valueOf();
}

async function checkDonors () {
  let patrons = [];
  const loopThroughPatrons = async (url) => {
    let res = await axios.get(url || `https://www.patreon.com/api/oauth2/v2/campaigns/${config.options.patreonCampaignID}/members?page%5B100%5D&include=user&fields%5Bmember%5D=full_name%2Cis_follower%2Clast_charge_date%2Clast_charge_status%2Clifetime_support_cents%2Ccurrently_entitled_amount_cents%2Cpatron_status&fields%5Buser%5D=social_connections&page%5Bcount%5D=100`, { headers: { 'Authorization': `Bearer ${this.client.secrets.extServices.patreon}` }, responseType: 'json' });
    if (!res.data) {
      return;
    }
    res = res.data;
    for (const patron of res.included) {
      const pledge = patron.type === 'user' ? res.data.find(p => p.relationships.user.data.id === patron.id) : null;
      if (pledge) {
        patrons.push({ attributes: patron.attributes, payment_data: pledge ? pledge.attributes : null, id: patron.id });
      }
    }
    if (res.links && res.links.next) {
      await loopThroughPatrons(res.links.next);
    } else {
      return patrons;
    }
  };
  await loopThroughPatrons();
  const storedDonors = await r.table('users').filter(r.hasFields('donor').and(r.row('donor').hasFields('patreonID'))).run();
  patrons = patrons.filter(p => p.attributes.social_connections &&
    p.attributes.social_connections.discord &&
    p.attributes.social_connections.discord.user_id &&
    !storedDonors.find(d => d.donor.patreonID === p.id));

  for (let patron of patrons) {
    let discord = patron.attributes.social_connections.discord;
    await _saveQuery(_fetchUserQuery(discord.user_id).merge({ donor: {
      donorAmount: patron.payment_data.currently_entitled_amount_cents / 100,
      guilds: [],
      guildRedeems: 0,
      firstDonationDate: patron.payment_data.pledge_relationship_start || r.now(),
      declinedSince: null,
      patreonID: patron.id
    } })).run().catch();
    const channel = await this.client.bot.getDMChannel(discord.user_id);
    channel.createMessage({ embed: {
      color: 6732650,
      title: 'You now have donor perks',
      description: `Thanks for your donation!\nMost donor perks are automatic. If you want to redeem your coins, use \`pls redeem\`.\n`,
      fields: patron.payment_data.currently_entitled_amount_cents > 300 ? [
        {
          name: 'You have access to Premium Memer!',
          value: 'Since you have donated above $5, you have the option to set a server as premium for extra commands, including command tags, autoposting memes, music, and much more!\nTo do this, run `pls pserver add` in the server you want to activate premium perks for!'
        }
      ] : null,
      footer: { text: 'ur a cool person' }
    } }).catch(() => {});
  }
}

async function sendPatreonWebhook (content) {
  content = typeof content === 'object' ? { embeds: [content] } : { content };
  return axios.post(`${config.discord_baseURL}/webhooks/${config.patreon_webhookID}/${config.patreon_webhook_token}?wait=true`, content, {
    headers: {
      'Content-Type': `application/json`
    }
  }).catch(console.error);
}
