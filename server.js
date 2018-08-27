const cluster = require('cluster')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fs = require('fs')
const r = require('rethinkdbdash')()
const config = require('./config.json')

const cpusLength = require('os').cpus().length
app.use(bodyParser.json())

// DBL webhooks
app.post('/dblwebhook', async (req, res) => {
  if (req.headers.authorization) {
    if (req.headers.authorization === config.dbl_webhook_secret) {
      req.body.type === 'upvote' ? await addPocket(req.body.user, 25)
        : console.log('not an upvote??')
      res.send({status: 200})
    } else {
      res.send({status: 401, error: 'You done gone goofed up auth.'})
    }
  } else {
    res.send({status: 403, error: 'Pls stop.'})
  }
})

// DBL webhooks
app.post('/patreonwebhook', async (req, res) => {
    if (req.headers['X-Patreon-Signature']) {
      if (req.headers['X-Patreon-Signature'] /*=== The HEX digest of the message body HMAC signed (using MD5) using the webhook's secret*/) {
        if (req.body.data.attributes.patron_status === "active_patron") {
            await addDonor(res.body);
        } else if (req.body.data.attributes.patron_status === "former_patron") {
            await removeDonor();
        }
        res.send({status: 200})
      } else {
        res.send({status: 401, error: 'You done gone goofed up auth.'})
      }
    } else {
      res.send({status: 403, error: 'Pls stop.'})
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
    return r.table('donors')
      .getAll(id, {index: 'patreonID'})
      .delete()
      .run()
}

function launchServer () {
  const http = require('http')
  http.createServer(app).listen(8200)
  console.log(`Server started on port 8200 pid: ${process.pid}`)
}

if (cluster.isMaster) {
  const workerNumber = cpusLength - 1
  console.log(`Starting ${workerNumber} workers`)
  for (let i = 0; i < workerNumber; i++) {
    cluster.fork()
  }
  for (const id in cluster.workers) {
    cluster.workers[id].on('message', masterHandleMessage)
  }
} else {
  // worker
  launchServer()
}

cluster.on('online', (worker) => {
  console.log(`Worker ${worker.id} started`)
})

async function masterHandleMessage (message) {
  //processes events from the workers, in master process
  if(message === 'stuff') {
    console.log(message);
  }
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