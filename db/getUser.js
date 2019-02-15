module.exports = function getUser (id, amount = 0) {
  return {
    id, // User id/rethink id
    pls: 1, // Total commands ran
    lastCmd: Date.now(), // Last command time
    lastRan: 'nothing', // Last command ran
    pocket: amount, // Coins not in bank account
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
};
