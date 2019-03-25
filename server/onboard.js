const qs = require('querystring');
const axios = require('axios');
const JsonDB = require('node-json-db');

const db = new JsonDB('users', true, false);

const apiUrl = 'https://slack.com/api';

const message = {
  token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
  link_names: true,
  text: 'Consent form of Participating WeAre! Research Project',
  as_user: false,
  attachments: JSON.stringify([
    {
      title: 'Procedure',
      text: 'We invite you to participate in a research study that takes place this spring semester. Our research goal is to explore and assess ways to build a sense of community among World Campus students. Participants must be over the age of 18 to participate. As a participant in the research project, you will be asked to use Slack and answer two questionnaires before and after usingt Slack (Each survey should 10 minutes to complete). As a compensation for your participation in the survey, we will draw 15 names in the first survey participants for a $30 Amazon Gift Card, and for those who answered both we will draw additional 15 names for a $50 Amazon Gift Card. During your use of Slack tool and visualization dashboard, we will collect your usage data (e.g. interactive moves in the dashboard, log-in time), but these data will always remain confidential and stored anonymously for data analysis. Only researchers of this project in the Human-Centered Lab of Penn State will have access to the data. No third party or university authorities will have access to the data.',
      color: '#3060f0',
    },
    {
      title: 'Questions or concerns?',
      text: 'If you have questions or concerns, you may contact Na Sun at nzs162@psu.edu. If you have questions regarding your rights as a research subject or concerns regarding your privacy, you may contact the Penn State Office for Research Protections at 814-865-1775. Your participation is voluntary and you may decide to withdraw at any time without penalty. You do not have to answer any questions that you do not want to answer. Note that you can no longer modify the content once you complete the survey content. Your participation implies your voluntary consent to participate in the research.',
      color: '#74c8ed',
      callback_id: 'terms-of-service',
      actions: [{
        name: 'accept',
        text: 'Accept',
        type: 'button',
        value: 'accept',
        style: 'primary',
      },
      {
        name: 'Decline',
        text: 'Decline',
        type: 'button',
        value: 'decline',
        style: 'default'
      }],
    }]
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
    console.log(`channel id is ${channelId}`);
    console.log(`user id is ${userId}`);
    // send the default message as a DM to the user
    message.channel = channelId; //if the channel id is empty, when team_join instead channel_join
    message.user = userId;
    axios.post(`${apiUrl}/chat.postEphemeral`, qs.stringify(message), { headers: { 'content-type': 'application/x-www-form-urlencoded' } })
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


module.exports = { initialMessage };
