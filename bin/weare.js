require('dotenv').config();
const app = require('../server/service.js');
//const SlackRTMClient = require('../server/SlackRTMClient');
const path = require('path');
const http = require('http');
const util = require('util');
const ticket = require('../ticket.js');
// const app = http.createServer(server);
// console.log(`this is the PORT: ${process.env.PORT}`)


const bodyParser = require("body-parser");
// const superagent = require("superagent");
const request = require('request');
const apiUrl = 'https://slack.com/api';
// const methodUril = 'https://slack.com/api/';
const qs = require('querystring');

app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const jsonParser = bodyParser.json();

const SlackRTMClient = require('@slack/client').RTMClient;
const SlackWebClient = require('@slack/client').WebClient;
// const RTM_EVENTS = require('@slack/client').RTM_EVENTS;
// const RTM_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;

const fs = require('fs');
const async = require('async');
const MongoClient = require('mongodb').MongoClient;

const DB = null;

app.get('/api/oauth', function (req, res, next) {
	var code = req.body.params.code;

	SlackRTMClient.oauth.access(process.env.SLACK_CLIENT_ID, process.env.SLACK_CLIENT_SECRET, code,

		function (err, result) {
			if (!err) {
				DB.collection("oauthtokens").update(
					{ team_id: result.team_id },
					result, { upsert: true });

				res.redirect('https://tildachat.com/instructions.html', next);//TODO: replace the url
			}
		});


});

app.get('/auth', (req, res) => {
	console.log(__dirname);
	console.log(__filename);
	res.sendFile(path.resolve(__dirname + '/../views/add_to_slack.html'));
})

app.post('/slack/events', (req, res, next) => {

	const challenge = req.body.challenge;
	res.send(challenge);
	console.log(`challenge is ${challenge}`);
	// console.log(util.inspect(req, { depth: null }));
	next();
});

app.post('/slack/commands/study', urlencodedParser, (req, res) => {
	console.log(`within study`);
	res.status(200).end(); // best practice to respond with empty 200 status code
	var reqBody = req.body
	var responseURL = reqBody.response_url

	var message = {
		"text": "Would you like to study with others Now or Later?",
		"attachments": [
			{
				"text": "Check who is online or Schedule a meeting with others.",
				"fallback": "Shame... buttons aren't supported in this land",
				"callback_id": "schedule_0",
				"color": "#3AA3E3",
				"attachment_type": "default",
				"actions": [
					{
						"name": "Now",
						"text": "Now",
						"type": "button",
						"value": "now"
					},
					{
						"name": "Later",
						"text": "Later",
						"type": "button",
						"value": "later"
					},
					{
						"name": "Cancel",
						"text": "Cancel",
						"type": "button",
						"value": "cancel",
						"style": "danger"
					}
				]
			}
		]
	}
	sendMessageToSlackResponseURL(responseURL, message);

});

app.post('/slack/commands/WhoIsOnline', urlencodedParser, (req, res) => {
	res.status(200).end();
	console.log(`the req body in WhoIsOnline Command includes + ${util.inspect(req.body, { depth: null })}`);
	// const body = JSON.parse(req.body);
	const PostOptions = {
		uri: `${apiUrl}/conversations.members`,
		body: qs.stringify({
			token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
			channel: req.body.channel_id,
			limit: 20
		}),
		method: 'POST',
		headers: {
			'Content-type': 'application/x-www-form-urlencoded'
		}
	};
	request(PostOptions, (err, res, body) => {
		if (err) console.error(err);
		body = JSON.parse(body);
		console.log(typeof (body));
		console.log(body);
		console.log(`success in getting conversation.members:${body.members}`);

		//------------------
		// const rtm = new SlackRTMClient(process.env.BOT_USER_OAUTH_ACCESS_TOKEN, {
		// 	dataStore: false,
		// 	useRtmConnect: true,
		// });
		// // rtm.start({ batch_presence_aware: true });
		// rtm.start({
		// 	"type": "presence_query",
		// 	"ids": [
		// 		"U061F7AUR",
		// 		"W123456"
		// 	]
		// });

		// rtm.on('ready', () => {
		// 	console.log('Connected!');

		// 	//presence_query event emitting does not return anything (void/undefined)
		// 	const message = {
		// 		type: 'message',
		// 		channel: req.body.channel_id,
		// 		user: req.body.user_id,
		// 		text: "hello world",
		// 	};
		// 	rtm.addOutgoingEvent(false, message.type, message)
		// 		.then((resp) => console.log('Successfully sent message back:', resp))
		// 		.catch(console.error);
		// 	rtm.addOutgoingEvent(false, 'presence_query', {
		// 		// rtm.send({
		// 		// rtm.presence_query({
		// 		type: "presence_query",
		// 		ids: `[${body.members}]`
		// 		// "channel": req.body.channel_id
		// 	}
		// 		// ,(err, res) => {
		// 		// 	if(err) console.error(err);
		// 		// 	console.log('fuck!')
		// 		// 	if(res == undefined) console.log('res undefined')
		// 		// 	res.forEach(a=>console.log(a.presence));
		// 		// 	console.log(`-------------callback query:${util.inspect(res, { depth: null })}`);
		// 		// }
		// 	).then((res) => {
		// 			console.log(`-------------presence_query:${util.inspect(res, { depth: null })}`);
		// 			console.log(typeof (res));
		// 		}, (reason) => {
		// 			// rejection
		// 			console.log('rejected for' +reason);
		// 		  })
		// 		.catch((err) => console.error(err));

		// });

		// rtm.on('presence_query', (events) => {
		// 	console.log('heard query')
		// 	console.log(`-------------presence_query evemts:${util.inspect(events, { depth: null })}`);
		// 	events.users.forEach(userId => console.log(userId));
		// });
		//--------------------------------
		//posting the POST request from app directly ti rtn.connect
		// const PostOptions = {
		// 	//uri: `${apiUrl}/events/presence_query`,
		// 	uri: `${apiUrl}/rtm.connect`,
		// 	method: 'POST',
		// 	body: qs.stringify({
		// 		'type': 'presence_query',
		// 		'ids': [`${body.members}`]
		// 	}),
		// 	token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
		// 	headers: {
		// 		'Content-type': 'application/x-www-form-urlencoded'
		// 	}
		// }
		// request(PostOptions, (err, res, body) => {
		// 	if (err) console.error(err);
		// 	else {
		// 		// const body = JSON.parse(body);
		// 		console.log(`is res typeof undefined?? ${typeof(res)}`);
		// 		console.log(`is body typeof undefined?? ${typeof(body)}`);
		// 		// console.log(`body includes ${body}`);
		// 		console.dir(res);
		// 		// console.log(`-------------res presence_query:${util.inspect(res, { depth: null })}`);
		// 		// console.log(`-------------body presence_query:${util.inspect(body, { depth: null })}`);
		// 	}

		// });
		////^ not working
		// // rtm.disconnect();
		// another WEB API method //WebClient.users.getPresence() working
		// const PostOptions = {
		// 	uri: `${apiUrl}/users.getPresence`,
		// 	method: 'GET',//'POST',
		// 	qs: {
		// 		token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
		// 		user: 'U0A4G9E86'//[`${body.members}`]
		// 	}
		// 	// ,
		// 	// headers: {
		// 	// 	'Content-type': 'application/x-www-form-urlencoded'
		// 	// }
		// };
		// console.log(PostOptions);
		// request(PostOptions, (err, res, body) => {
		// 	if (err) console.error(err);
		// 	else {
		// 		if (body != undefined) var body = JSON.parse(body);
		// 		console.log(`is res typeof undefined?? ${typeof (res)}`);
		// 		console.log(`is body typeof undefined?? ${typeof (body)}`);
		// 		console.log(`body includes ${body}`);
		// 		// console.log(`-------------res presence_query:${util.inspect(res, { depth: null })}`);
		// 		console.log(`-------------body presence_query:${util.inspect(body, { depth: null })}`);
		// 	}

		// });

		//using web client
		const web = new SlackWebClient(process.env.BOT_USER_OAUTH_ACCESS_TOKEN);
		body.members.forEach(member => {
			web.users.getPresence({ user: member })
			.then(res => {
				console.log(`${member} presence status is ${res.presence}`);
			})
		})

	});
});

app.post('/slack/actions', urlencodedParser, (req, res) => {
	res.status(200).end(); // best practice to respond with 200 status
	var body = JSON.parse(req.body.payload); // parse URL-encoded payload JSON string
	const { type, text, token, trigger_id } = body;
	console.log(`the req body includes + ${util.inspect(req.body, { depth: null })}`);

	// var message = {
	//     "text": body.user.name+" chose "+body.actions[0].name,
	//     "replace_original": false
	// };
	// sendMessageToSlackResponseURL(body.response_url, message);
	if (type == 'interactive_message') {
		console.log(`trigger id is ${trigger_id}`);
		switch (body.actions[0].value) {
			case 'now': console.log('now selected'); break;
			case 'later': console.log('later selected');

				//// create the dialog payload - includes the dialog structure, Slack API token,
				// and trigger ID
				const dialog = {
					token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
					trigger_id,
					dialog: JSON.stringify({
						title: 'Schedule a meeting',
						callback_id: 'schedule_later',
						submit_label: 'Invite',
						elements: [
							{
								label: 'Purpose',
								type: 'text',
								name: 'purpose',
								value: text, //TODO: support command paramters later
								hint: '30 second summary of meeting purpose',
							},
							{
								label: 'Description',
								type: 'textarea',
								name: 'description',
								optional: true,
							},
							{
								label: 'Topic',
								type: 'select',
								name: 'topic',
								options: [
									{ label: 'Course materials', value: 'materials' },
									{ label: 'Homework discussion (Q&A)', value: 'homework' },
									{ label: 'Group sync', value: 'sync' },
								],
							},
							{
								label: 'Urgency',
								type: 'select',
								name: 'urgency',
								options: [
									{ label: 'Low', value: 'Low' },
									{ label: 'Medium', value: 'Medium' },
									{ label: 'High', value: 'High' },
								],
							},
						],
					}),
				}, uri = `${apiUrl}/dialog.open`;

				const options = {
					uri: uri,
					body: qs.stringify(dialog),
					method: 'POST',
					headers: {
						'Content-type': 'application/x-www-form-urlencoded'
					}
				}

				//open the dialog by caling dialogs.open
				request(options, (err, response, body) => {
					if (err) {
						console.error(err);
					};
					console.log('open successfully the dialog');
				})
				// sendMessageToSlackResponseURL(`${apiUrl}/dialog.open`, dialog);
				break;
			default: console.log('nothing cased'); break;
		}

	}
	else if (type == 'dialog_submission') {
		const { submission } = body;
		console.log(`action type is ${type}`);
		ticket.create(body.user.id, body.channel.id, submission);
	}
});



function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	console.log(`Sending msg : ${JSONmessage.text} to Slack with a response url to be ${responseURL}`);
	var postOptions = {
		uri: responseURL,
		method: 'POST',
		headers: {
			'Content-type': 'application/json'
		},
		json: JSONmessage
	}
	request(postOptions, (error, response, body) => {
		if (error) {
			// handle errors as you see fit
			console.error(error);
		}
	});
}


app.listen(process.env.PORT, () => {
	console.log(`WeAre! server is running on PORT ${process.env.PORT}`);
});