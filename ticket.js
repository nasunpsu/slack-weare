const request = require('request');
// const debug = require('debug')('slash-command-template:ticket');
const qs = require('querystring');
const users = require('./users');
const util = require('util');
const apiUrl = 'https://slack.com/api';
/*
 *  Send ticket creation confirmation via
 *  chat.postMessage to the user who created it
 */
const sendConfirmation = (ticket) => {
    const PostOptions = {
        url: `${apiUrl}/chat.postEphemeral`, 
        body: qs.stringify({
            token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
            channel: ticket.channelId,
            user: ticket.userId,
            as_user: false,
            text: 'Invitations for meeting sent out!',
            attachments: JSON.stringify([
                {
                    title: `Request to meet sent out`,
                    // Get this from the 3rd party helpdesk system
                    title_link: 'https://ad4a5c00.ngrok.io/Meetings', //TODO: update to the server address
                    text: ticket.text,
                    response_type: 'ephemeral',
                    fields: [
                        {
                            title: 'Purpose',
                            value: ticket.purpose,
                        },
                        {
                            title: 'Description',
                            value: ticket.description || 'None provided',
                        },
                        {
                            title: 'Status',
                            value: 'Open',
                            short: true,
                        },
                        {
                            title: 'Topic',
                            value: ticket.topic,
                        },
                        {
                            title: 'With',
                            value: ticket.who,
                            short: true,
                        },
                    ],
                },
            ]),
        }),
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        }
    };
    request.post(PostOptions, (err, res, body) => {
        // debug('sendConfirmation error: %o', err);
        if (err) console.error(err);
        console.log(`success in inviting people in!`);
    });
};

// const InviteWho = (channelId) => {
//     const activeMembers = await ActiveWho(body.channel.id);
// 					console.log(`who is online with ActiveWho func: ${util.inspect(activeMembers, { depth: 2 })}`);
// 					const usersnames = activeMembers.map(x => x.username), emails = activeMembers.map(x => x.email);

// }

// Create helpdesk ticket. Call users.find to get the user's email address
// from their user ID
const create = (userId, channelId, submission) => {
    const ticket = {};

    const fetchUserEmail = new Promise((resolve, reject) => {
        users.find(userId).then((result) => {
            //   debug(`Find user: ${userId}`);
            console.log('this is fetching user');
            console.log(util.inspect(result.data, { depth: null }));
            resolve(result.data.user.profile.email);
        }).catch((err) => { reject(err); });
    });

    fetchUserEmail.then((result) => {
        ticket.userId = userId;
        ticket.channelId = channelId;
        ticket.userEmail = result;
        ticket.purpose = submission.purpose;
        ticket.description = submission.description;
        ticket.topic = submission.topic;
        ticket.urgency = submission.urgency;
        sendConfirmation(ticket);

        return ticket;
    }).catch((err) => { console.error(err); });
};

module.exports = { create, sendConfirmation };
