module.exports = function getNextMonthUTC () {
  const date = new Date();
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
};