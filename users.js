// const qs = require('querystring');
// const axios = require('axios');

// const find = (slackUserId) => {
//   const body = { token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN, user: slackUserId };
//   console.log('token is ' + body.token + '; user id is + ' + slackUserId);
//   const promise = axios.post('https://slack.com/api/users.info', {
//     headers: { 'content-type': 'application/x-www-form-urlencoded' },
//     data: qs.stringify(body),
//   });
//   return promise;
// };

// module.exports = { find };
const qs = require('querystring');
const axios = require('axios');

const find = (slackUserId) => {
  const body = { token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN, user: slackUserId };
  const promise = axios.post('https://slack.com/api/users.info', 
  qs.stringify(body), {headers: { 'content-type': 'application/x-www-form-urlencoded' }});
  return promise;
};

module.exports = { find };