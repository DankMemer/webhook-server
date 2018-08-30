const cluster = require('cluster')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const r = require('rethinkdbdash')()
const config = require('./config.json')
const crypto = require('crypto')
const fs = require('fs')
let privateKey = fs.readFileSync(__dirname + '/key.pem')
let certificate = fs.readFileSync(__dirname + '/cert.pem')

app.use(bodyParser.json())

// discordbots.org webhooks
app.post('/dblwebhook', async (req, res) => {
  if (req.headers.authorization) {
    if ((req.headers.authorization === config.dblorg_webhook_secret) && (res.body.type === 'upvote')) {
      await addPocket(req.body.user, 25) 
      res.send({status: 200})
    } else {
      res.send({status: 401})
    }
  } else {
    res.send({status: 403})
  }
})

// Patreon webhooks
app.post('/patreonwebhook', async (req, res) => {
    if (req.headers['X-Patreon-Signature']) {
      if (validatePatreonIdentity(req)) {
        if (req.body.data.attributes.patron_status === "active_patron") {
            await addDonor(res.body);
        } else if (req.body.data.attributes.patron_status === "former_patron") {
            await removeDonor(res.body);
        }
        res.send({status: 200})
      } else {
        res.send({status: 401})
      }
    } else {
      res.send({status: 403})
    }
})

async function addDonor(body) {
    if (!body.data.included[1].attributes.social_connections.discord || !body.data.included[1].attributes.social_connections.discord.user_id) {
        return;
    }
    return r.table('donors')
    .insert({
      id: body.data.included[1].attributes.social_connections.discord.user_id,
      donorAmount: body.data.attributes.currently_entitled_amount_cents / 100,
      guilds: [],
      guildRedeems: 0,
      firstDonationDate: body.data.attributes.pledge_relationship_start || r.now(),
      declinedSince: null,
      totalPaid: donorAmount,
      patreonID: body.data.included[1].attributes.id,
    }, { conflict: 'update' })
    .run()
}

function removeDonor(body) {
    if (!body.data.included[1].attributes.id) {
      return;
    }
    return r.table('donors')
      .getAll(body.data.included[1].attributes.id, {index: 'patreonID'})
      .delete()
      .run()
}

function launchServer () {
  const https = require('https')
  https.createServer({key: privateKey, cert: certificate}, app).listen(8200)
  console.log(`Server started on port 8200 pid: ${process.pid}`)
};

launchServer();

function validatePatreonIdentity(req) {
  let hash = req.headers['X-Patreon-Signature'],
      hmac = crypto.createHmac("md5", config.patreon_webhook_secret); 
  hmac.update(res.body);
  let crypted = hmac.digest("hex");
  return crypted === hash;
}

function formatTime (time) {
  let days = Math.floor(time % 31536000 / 86400)
  let hours = Math.floor(time % 31536000 % 86400 / 3600)
  let minutes = Math.floor(time % 31536000 % 86400 % 3600 / 60)
  let seconds = Math.round(time % 31536000 % 86400 % 3600 % 60)
  days = days > 9 ? days : '0' + days
  hours = hours > 9 ? hours : '0' + hours
  minutes = minutes > 9 ? minutes : '0' + minutes
  seconds = seconds > 9 ? seconds : '0' + seconds
  return `${days > 0 ? `${days}:` : ``}${(hours || days) > 0 ? `${hours}:` : ``}${minutes}:${seconds}`
}

async function getUser (userID) {
  let user = await r.table('users').get(userID)

  if (!user) {
    user = (await r.table('users').insert({
      id: userID, // User id/rethink id
      pls: 1, // Total commands ran
      lastCmd: Date.now(), // Last command time
      lastRan: 'nothing', // Last command ran
      spam: 0, // Spam means 2 commands in less than 1s
      pocket: 0, // Coins not in bank account
      bank: 0, // Coins in bank account
      lost: 0, // Total coins lost
      won: 0, // Total coins won
      shared: 0, // Transferred to other players
      streak: {
        time: 0, // Time since last daily command
        streak: 0 // Total current streak
      },
      items: {
        spin: 0, // Fidget Spinners
        memes: 0, // Memes
        tide: 0 // Tide Pods
      },
      upgrades: {
        incr: 0, // Incremental upgrades
        multi: 0, // Multiplier upgrades
        vault: 0, // Bank Vault upgrades
        shares: 0, // Sharing upgrades
        luck: 0 // Luck upgrades
      },
      donor: false, // Donor status, false or $amount
      godMode: false, // No cooldowns, only for select few
      vip: false, // Same cooldowns as donors without paying
      upvoted: false // DBL voter status
    }, {
      returnChanges: true
    }).run()).changes[0].new_val
  }

  return user
}

async function addPocket (id, amount) {
  let res = await getUser(id)
  res.pocket += amount
  res.upvoted = true

  return r.table('users')
    .insert(res, { conflict: 'update' })
}