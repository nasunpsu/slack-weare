const qs = require('querystring');
const axios = require('axios');
const JsonDB = require('node-json-db');

const db = new JsonDB('users', true, false);

const apiUrl = 'https://slack.com/api';


const postResult = result => console.log(result.data);

// default message - edit to include actual ToS
const message = {
  token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
  link_names: true,
  text: 'Welcome to the team! We\'re glad you\'re here.',
  as_user: false,
  attachments: JSON.stringify([
    {
      title: 'Welcome to the World Campus Students Community! We Are!',
      text: 'Penn State is where learning gains and your career takes off. If this is your first time using Slack, take some time to read the help docs at get.slack.help and our internal wiki. If you have any questions, jump into #help-slack and we\'ll help you out',
      color: '#74c8ed',
    },
    {
      title: 'Code of Conduct',
      text: 'Our goal is to maintain a safe, helpful and friendly community for everyone, regardless of experience, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, nationality, or other defining characteristic. Please take the time to read through <https://code.localhost|Code of Conduct> before continuing.',
      callback_id: 'terms-of-service',
      color: '#3060f0',
      actions: [{
        name: 'accept',
        text: 'Accept',
        type: 'button',
        value: 'accept',
        style: 'primary',
      },
    {
        name: 'introduce',
        text: 'Introduce myself',
        type: 'button',
        value: 'intro',
        style: 'default'
    }],
    },]
  ),
};

const initialMessage = (userId, channelId) => {
  let data = false;
  // try fetch team/user pair. This will throw an error if nothing exists in the db
//   try { data = db.getData(`/${teamId}/${userId}`); } catch (error) {
//     console.error(error);
//   }

  // `data` will be false if nothing is found or the user hasn't accepted the ToS
  if (!data) {
    // add or update the team/user record
    // db.push(`/${teamId}/${userId}`, false);

    // send the default message as a DM to the user
    message.channel = channelId;
    message.user = userId;
    axios.post(`${apiUrl}/chat.postEphemeral`, qs.stringify(message), {headers: { 'content-type': 'application/x-www-form-urlencoded' }})
      .then((result => {
        console.log(result.data);
      }));
  } else {
    console.log('Already onboarded');
  }
};

// set the team/user record to true to indicate that they've accepted the ToS
// you might want to store the date/time that the terms were accepted

// const accept = (userId, teamId) => db.push(`/${teamId}/${userId}`, true);

// find all the users who've been presented the ToS and send them a reminder to accept.
// the same logic can be applied to find users that need to be removed from the team


module.exports = { initialMessage  };
