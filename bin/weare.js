require('dotenv').config();
const app = require('../server/service.js');
const similarIdx = require('../server/calculators.js');
//const SlackRTMClient = require('../server/SlackRTMClient');
const path = require('path');
const https = require('https');
const expressIp = require('express-ip');
const createError = require('http-errors')
const util = require('util');
const ticket = require('../ticket.js');
const onboard = require('../server/onboard.js')
const similarity = require('../server/similarity/similarity');
// const app = http.createServer(server);
// console.log(`this is the PORT: ${process.env.PORT}`)
const { sanitizeBody } = require('express-validator/filter');

const bodyParser = require("body-parser");
const request = require('request');
const apiUrl = 'https://slack.com/api';
const base_url = 'https://ad4a5c00.ngrok.io/';
// const methodUril = 'https://slack.com/api/';
const qs = require('querystring');
const hbs = require('express-handlebars');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const cookieParser = require('cookie-parser');
const morgan = require('morgan')
const getOffset = require('get-timezone-offset');
const express = require('express');
const ldap = require('../server/ldap');
const assert = require('assert');

app.use(expressIp().getIpInfoMiddleware);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const jsonParser = bodyParser.json();
app.use(cookieParser());
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});


const SlackRTMClient = require('@slack/client').RTMClient;
const SlackWebClient = require('@slack/client').WebClient;

const fs = require('fs');
const async = require('async');
var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, '/../public/favicon.ico')));
app.use(express.static(path.join(__dirname, '/../public')));

const mongoClient = require('mongodb').MongoClient;

let DB = null;

mongoClient.connect(process.env.MONGO_DB, { useNewUrlParser: true }, function (err, db) {
	if (!err) {
		console.log('Mongo Connected');
		DB = db.db("weare");
		initDB();
	}
	else console.log(err);
});

var sess = {
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true,
	store: new MongoStore({
		url: process.env.MONGO_DB,
		collection: 'sessions'
	}),
	cookie: { maxAge: 24 * 60 * 60 * 1000 } //<=24h, 60000 1min
	// cookie: { secure: true }
};

app.set('trust proxy', 1);//comment this out...
if (app.get('env') === 'production') {
	app.set('trust proxy', 1) // trust first proxy
	sess.cookie.secure = true // serve secure cookies
}
app.use(morgan('dev'));//combined				        
app.use(session(sess));
app.use((req, res, next) => {
	const { method, body, params, query, path } = req;
	if (path === '/log') {
		next();
		return;
	}
	const log = {
		type: `${method} Request`,
		time: new Date().toString(),
		content: {
			body,
			query,
			params,
		},
		path
	}
	logEvent(log, req);
	next();
});

const web = new SlackWebClient(process.env.BOT_USER_OAUTH_ACCESS_TOKEN);
const web_slack = new SlackWebClient(process.env.SLACK_OAUTH_ACCESS_TOKEN);

// view engine setup 
// app.set('views', path.join(__dirname, '/../views'));
app.set('view engine', 'hbs');

app.engine('hbs', hbs({
	extname: 'hbs',
	defaultView: 'default',//'layout'
	layoutsDir: path.join(__dirname, '/../views/layouts/'),
	partialsDir: [
		path.join(__dirname, '/../views/partials/'),
		path.join(__dirname, '/../semantic/dist/')
	],
	helpers: {
		json: function (context) { return JSON.stringify(context); },
		eq: function () {
			const args = Array.prototype.slice.call(arguments, 0, -1);
			return args.every(function (expression) {
				return args[0] === expression;
			});
		}
	}
}));

const logEvent = (body, req) => {
  if (!!req.sessionID) {
    body.sessionID = req.sessionID;
  }
  if (!('error' in req.ipInfo)) {
    body.ipInfo = modIpInfo(req.ipInfo);
  }
  if (!!req.session && !!req.session.user) {
    body.email = req.session.user.email;
  }

  if('uid' in body && body.type === 'Activity'){
    const isActive = body.content.type === 'Active';
    const updateDoc = {$set: {isActive}}
    DB.collection('users').updateOne({uid: body.uid}, updateDoc);
  }
  if('uid' in body && 'ipInfo' in body){
    const updateDoc = {
			$push: {ipInfo: body.ipInfo},
			$set: body.ipInfo
		}
		DB.collection('users').updateOne({ uid: body.uid }, updateDoc);
	}
	return DB.collection('logging').insertOne(body);
}

const modIpInfo = (ipInfo) => {
	delete ipInfo.range;
	delete ipInfo.eu;
	delete ipInfo.metro;
	delete ipInfo.area;
	ipInfo.tz_offset = -getOffset(ipInfo.timezone, new Date()) / 60;
	ipInfo.tz = ipInfo.timezone;
	ipInfo.latitude = ipInfo.ll[0];
	ipInfo.longitude = ipInfo.ll[1];
	delete ipInfo.timezone;
	delete ipInfo.ll;
	return ipInfo;
}

// app.engine('handlebars', exphbs({ helpers: { json: function (context) { return JSON.stringify(context); } } }));
app.post('/log', async (req, res) => {
	const { body } = req;
	try {
		assert('type' in body, `'type' must be present in body`);
		assert('time' in body, `'time' must be present in body`);
		assert('content' in body, `'content' must be present in body`);
		assert('path' in body, `'path' must be present in body`);
	}
	catch (e) {
		res.status(400);
		res.send({ response: e.toString() });
		return;
	}
	const dbResult = await logEvent(body, req);
	if (dbResult.result.n === 1 && dbResult.result.ok === 1) {
		res.status(200);
		res.send({ response: 'Inserted' });
		return;
	}
	res.status(500);
	res.send({ response: 'Server error' });
});

app.get('/install', (req, res) => {
	let to_be_rendered = {
		layout: 'default',
		template: 'add_to_slack-template'
	};
	res.render('add_to_slack', to_be_rendered);
});
app.get('/login', function (req, res) {
	let to_be_rendered = {
		layout: 'default',
		template: 'login-template'
	};
	res.render('login', to_be_rendered);
});

// GET /logout
app.get('/logout', function (req, res, next) {
	if (req.session) {
		// delete session object
		req.session.destroy(function (err) {
			if (err) {
				return next(err);
			} else {
				return res.redirect('/');
			}
		});
	}
});


app.get('/api/oauth', function (req, res, next) {
	var code = req.query.code;
	console.log(`code is ${code}`);
	console.log(`locals are ${util.inspect(res.locals, { depth: 2 })}`)
	var data = {
		form: {
			client_id: process.env.SLACK_CLIENT_ID,
			client_secret: process.env.SLACK_CLIENT_SECRET,
			code: req.query.code
		}
	};
	web.oauth.access(data.form, async function (err, result) {
		if (err) console.error(err);
		// await insertUser(result.user);
		console.log(`enter the oauth access: ${util.inspect(result, { depth: 2 })}`)
		if (!err) {
			if (!result.bot) { //this is signed in with slack
				console.log(`entering signed with Slack condition -----------`);
				await DB.collection('oauthtokens').find({ team_id: result.team.id }).toArray()
					.then(async (docs, err) => {
						if (err) console.error(err);
						if (docs.length == 0) {
							//NOT autherized
							return res.redirect('/install');
						}
						else {
							if (docs[0].scopes.indexOf('channels:read') === -1) {
								console.log('the scopes are not enough');
								return res.redirect('/install');
							}
							console.log('before retrieving usr DB');
							// await DB.collection('users').find({major : {$exists: true}}).toArray()
							await DB.collection('users').find({ uid: result.team.id + '_' + result.user.id }).toArray()
								.then(async (users_docs, err) => {
									console.log(`the user is read from MongoDB: ${util.inspect(users_docs[0], { depth: 2 })}`);
									if (err) console.error(err);
									req.session.user = await users_docs[0];
									req.session.team = await docs[0];

									res.redirect('/');
								});
						}
					});
			}
			else { //the oauth is used to install the WeAre! App to a new workspace
				console.log(`entering install WeAre! to Slack team condition -----------`);
				DB.collection("oauthtokens").updateOne(
					{ team_id: result.team_id },
					{
						$set: {
							authenticated_user: result.team_id + '_' + result.user_id,
							access_token: result.access_token,
							bot_access_token: result.bot.bot_access_token,
							bot_id: result.bot.bot_user_id,
							team_name: result.team_name,
							url: result.incoming_webhook.configuration_url,
							scopes: result.scope
						}
					}, { upsert: true }, async function (err, db_result) {
						if (err) console.error(err);
						console.log(`team id is ${result.team_id}, and token is ${result.access_token}`);
						await InitTeamMembers(result.team_id, result.access_token, null);
						await InitTeamChannels(result.team_id, result.access_token, null);
						await DB.collection('users').find({ uid: result.team_id + '_' + result.user_id }).toArray()
							.then(async (user_docs, err) => {
								if (err) console.error(err);
								req.session.user = await user_docs[0];
								req.session.team = {
									team_id: result.team_id,
									team_name: result.team_name,
									app_url: result.incoming_webhook.configuration_url
								};
								console.log(`signed in after installing WeAre! bot: team is ${util.inspect(req.session.team, { depth: 3 })}; user is team is ${util.inspect(req.session.user, { depth: 3 })}`);
								res.redirect('/');
							});


					});

			}

		}
		console.log('OUT of oauth access')
	});
});

app.get('/auth', (req, res) => {
	console.log(__dirname);
	console.log(__filename);
	res.sendFile(path.resolve(__dirname + '/../views/add_to_slack.html'));
})

// test adding channels here
app.get('/test', (req, res) => {
	res.send('haha');
	res.status(200).end();
	(async () => {									//TODO: MOVE this Block to the Init Module
		await InitTeamMembers('T0A286J8K', process.env.SLACK_OAUTH_ACCESS_TOKEN, 200);
	})();
	(async () => {
		await InitTeamChannels('T0A286J8K', process.env.SLACK_OAUTH_ACCESS_TOKEN, null);;
	})();

	console.log('---------------test----------------');
});


app.post('/slack/events', (req, res, next) => {
	switch (req.body.type) {
		case 'url_verification': {
			// verify Events API endpoint by returning challenge if present
			// res.send({ challenge: req.body.challenge });
			const challenge = req.body.challenge;
			res.send(challenge);
			console.log(`challenge is ${challenge}`);
			// console.log(util.inspect(req, { depth: null }));
			// next();
			break;
		}
		case 'event_callback': {
			// Verify the signing secret
			// if (signature.isVerified(req)) {
			const event = req.body.event;
			console.log(`within event callback: ${event}`);

			// `team_join` is fired whenever a new user (incl. a bot) joins the team
			if (event.type === 'member_joined_channel' && !event.is_bot) {
				console.log(`the event body is ${util.inspect(event, { depth: null })}`)
				const { user, channel } = event;
				onboard.initialMessage(user, channel);
			}
			res.sendStatus(200);
			// next();
			break;
		}
		default: {
			console.error('nothing cased events');
			res.sendStatus(500); next();
		}
	}

});

app.post('/slack/commands/discuss', urlencodedParser, (req, res) => {
	console.log(`within discuss`);
	res.status(200).end(); // best practice to respond with empty 200 status code
	var reqBody = req.body
	var responseURL = reqBody.response_url

	var message = {
		"text": "Would you like to study with others Now or Later?",
		"attachments": [
			{
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
	OnlineNow(req.body.channel_id, req.body.user_id, req.body.response_url);
});

app.post('/slack/commands/intro', urlencodedParser, (req, res) => {
	console.log(`within intro`);
	res.status(200).end(); // best practice to respond with empty 200 status code
	var reqBody = req.body;
	var msg = {
		title: 'I am, We Are!',
		callback_id: 'self_intro',
		submit_label: 'Hello!',
		elements: [
			{
				label: 'Fun fact',
				type: 'text',
				name: 'fun',
				text: 'existing content blah blah',
				hint: 'Tell them something fun!'
			},
			{
				label: 'I live in',
				type: 'text',
				name: 'city',
				optional: true,
				hint: 'Separate places with ";"! (e.g. Pittsburgh, PA; Victoria, BC'
			},
			{
				label: 'Current profession',
				type: 'select',
				name: 'topic',
				options: [
					{ label: 'Veteran/military', value: 'military' },
					{ label: 'Industry sector', value: 'industry' },
					{ label: 'Education sector', value: 'education' },
					{ label: 'No job yet', value: 'unemployed' }
				],
			},
			{
				label: 'Things I want my peers here to know about me',
				type: 'text',
				name: 'unique',
				optional: true,
				hint: 'e.g. interests, language, value systems, hobbies, minority roles'
			}
		],
	};
	console.log('before dialog web method');
	console.log(util.inspect(msg, { depth: 3 }));
	web.dialog.open({
		trigger_id: reqBody.trigger_id,
		dialog: msg
	}).then(res => console.log(`successfully opened intro dialog`)).catch(err => { console.error(err); console.log(util.inspect(err, { depth: 3 })) });

});

app.post('/slack/actions', urlencodedParser, (req, res) => {
	res.status(200).end(); // best practice to respond with 200 status
	var body = JSON.parse(req.body.payload); // parse URL-encoded payload JSON string
	const { type, token, trigger_id } = body;
	console.log(`the req body includes + ${util.inspect(req.body, { depth: null })}`);

	if (type == 'interactive_message') {
		console.log(`trigger id is ${trigger_id}`);
		switch (body.actions[0].value) {
			case 'accept':
				console.log('accepted term from new channel member!');
				web.chat.postEphemeral({
					as_user: false,
					channel: body.channel.id,
					user: body.user.id,
					text: `Thanks for participating our research project We Are! an online community for World Campus students. Remember to introduce yourself :point_down:`,
					attachments: JSON.stringify([
						{
							title: 'Welcome to the World Campus Students Community! We Are!',
							text: 'Penn State is where learning gains and your career takes off. If this is your first time using Slack, take some time to read the help docs at get.slack.help and our internal <https://docs.google.com/document/d/1-nCasqUcPrLYbhDuAm9SmuvY0S5ZOevPLbp52-PpZLM/edit?usp=sharing|wiki>. If you have any questions, jump into #help-slack and we\'ll help you out',
							callback_id: 'intro',
							color: '#74c8ed',
							actions: [{
								name: 'introduce',
								text: 'Introduce myself',
								type: 'button',
								value: 'intro',
								style: 'primary'
							},
							{
								name: 'later',
								text: 'Perhaps later',
								type: 'button',
								value: 'not-intro',
								style: 'default'
							},
								// {
								// 	name: 'neverIntro',
								// 	text: 'Don\'t show this again',
								// 	type: 'button',
								// 	value: 'never-intro',
								// 	style: 'default'
								// }
							],
						},]
					)
				}).catch(err => console.error(err));
				break;
			case 'now': console.log('now selected');
				OnlineNow(body.channel.id, body.user.id, body.response_url);//body.response_url
				break;
			case 'later': console.log('later selected');
				//// create the dialog payload - includes the dialog structure, Slack API token,
				// and trigger ID
				const dialog = {
					token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
					trigger_id,
					dialog: JSON.stringify({
						title: 'Schedule a meeting',
						callback_id: 'schedule_later',
						submit_label: 'Next',
						elements: [
							{
								label: 'Purpose',
								type: 'text',
								name: 'purpose',
								value: 'Blah blah is it there', //TODO: support command paramters later
								hint: '150 characters summary of meeting purpose',
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
									{ label: 'Other', value: 'other' },
								],
							},
							{
								label: 'With whom',
								type: 'select',
								name: 'who',
								options: [
									{ label: 'All the channel members', value: 'all' },
									{ label: 'Specify individuals (in the next page)', value: 'custom' }, //TODO, custom
								],
							}
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
				});


				// sendMessageToSlackResponseURL(`${apiUrl}/dialog.open`, dialog);
				break;
			case 'hangout':
				console.log('launch hangout and invite ppl');

				(async () => {
					const activeMembers = await ActiveWho(body.channel.id, body.user.id);
					console.log(`who is online with ActiveWho func: ${util.inspect(activeMembers, { depth: 2 })}`);
					const usersnames = activeMembers.map(x => x.username), emails = activeMembers.map(x => x.email);
					console.log('before empheral');
					web.chat.postEphemeral({
						as_user: false,
						channel: body.channel.id,
						user: body.user.id,
						text: `Type \`/hangout\` and Enter; Copy the emails for ${usersnames} as follows: ${emails}`
					}).catch(err => console.error(err));
					console.log('after empheral');
				})();
				break;
			case 'mention':
				console.log('mention selected');
				sendMessageToSlackResponseURL(body.response_url, { text: '@here', as_user: true, replace_original: false });
				break;
			case 'intro':
				const msg2 = {
					title: 'I am, We Are!',
					callback_id: 'self_intro',
					submit_label: 'Hello!',
					elements: [
						{
							label: 'Fun fact',
							type: 'text',
							name: 'fun',
							hint: 'Tell them something fun!'
						},
						{
							label: 'I live in',
							type: 'text',
							name: 'city',
							optional: true,
							hint: 'Separate places with ";"! (e.g. Pittsburgh, PA; Victoria, BC)'
						},
						{
							label: 'Current profession',
							type: 'select',
							name: 'profession',
							options: [
								{ label: 'Veteran/military', value: 'military' },
								{ label: 'Industry sector', value: 'industry' },
								{ label: 'Education sector', value: 'education' },
								{ label: 'No job yet', value: 'unemployed' },
							],
						},
						{
							label: 'Things I want my peers here to know about me',
							type: 'text',
							name: 'unique',
							optional: true,
							hint: 'e.g. language, value systems, hobbies, minority roles, ethnicity'
						},
					],
				};
				console.log('before dialog web method');
				console.log(util.inspect(msg2, { depth: 3 }));
				web.dialog.open({
					trigger_id: trigger_id,
					dialog: msg2
				}).then(res => console.log(`successfully opened intro dialog`)).catch(err => { console.error(err); console.log(util.inspect(err, { depth: 3 })) });
				break;
			case 'hello':
				console.log(`interactive message - hello!`);
				(async () => {
					await DB.collection('users').updateOne(
						{ uid: body.team.id + '_' + body.user.id },
						{
							$set: {
								fun_fact: submission.fun,
								profession_type: submission.profession,
								unique: submission.unique,
								cities: submission.city
							}
						},
						{ upsert: false },
						function (err, res) {
							if (err) console.error(err);
						});
					let edit_url = `editProfile/`;
					web.chat.postEphemeral({
						as_user: false,
						channel: body.channel.id,
						user: body.user.id,
						attachments: JSON.stringify([
							{
								title: 'An interesting profile can help your compatible peers find you!',
								text: 'Go to ' + base_url + edit_url + ' to edit your profile.',
								color: '#74c8ed'
							}
						])
					}).catch(err => console.error(err));
				})();
				break;
			case 'specify-now':
				const msg = {
					title: 'Schedule a meeting',
					callback_id: 'specify-now',
					submit_label: 'Invite',
					elements: [
						{
							label: 'Purpose',
							type: 'text',
							name: 'purpose',
							value: req.session.submission.purpose,
							hint: '150 characters summary of meeting purpose',
						},
						{
							label: 'Description',
							type: 'textarea',
							value: req.session.submission.description,
							name: 'description',
							optional: true,
						},
						{
							label: 'Topic',
							type: 'select',
							name: 'topic',
							value: req.session.submission.topic,
							options: [
								{ label: 'Course materials', value: 'materials' },
								{ label: 'Homework discussion (Q&A)', value: 'homework' },
								{ label: 'Group sync', value: 'sync' },
							],
						},
						{
							label: 'With whom',
							type: 'select',
							name: 'who',
							value: req.session.submission.description,
							options: members,
						}
					],

				};

				//open the dialog by caling dialogs.open
				web.dialog.open({
					trigger_id: trigger_id,
					dialog: msg
				}).then(res => console.log(`successfully opened custom followup dialog`))
					.catch(err => { console.error(err); console.log(util.inspect(err, { depth: 3 })) });
				break;
			default: console.log('nothing cased'); break;
		}

	}
	else if (type == 'dialog_submission') {
		const { submission, callback_id } = body;
		console.log(`Someone submit a dialog form, inside body: ${util.inspect(body, { depth: null })}`);
		console.log(`callback id is ${callback_id}`);
		switch (callback_id) {
			case 'self_intro':
				console.log(`this is in self-intro, say hello and welcome! ${body.channel.id}`)
				web.chat.postMessage({
					channel: body.channel.id,
					text: `I'd like to introduce ${body.user.name}!`,
					attachments: [
						{
							"title": `Let's welcome ${body.user.name} from ${body.submission.city}.`,
							"text": `Meet ${body.user.name} at <https://${base_url}/${body.team.id}_${body.user.id}|profile page>.`,
							color: 'good'
						},
						{
							"text": `Send ${body.user.name} some We Are! or some positive vibes! :fireworks: :tada: :wave: :clap:`,
							"fallback": "Shame... buttons aren't supported in this land",
							"callback_id": "hello_all",
							"color": "#3AA3E3",
							"attachment_type": "default",
							"actions": [
								{
									"name": "weare-welcome",
									"text": "We Are!",
									"type": "button",
									"style": "primary",//093162 this is the PSU team color
									"value": "weare-welcome"
								},
								{
									"name": "heart",
									"text": ":heart:",
									"type": "button",
									"value": "heart",
									"style": "danger"
								},
								{
									"name": "dismiss",
									"text": "Dismiss",
									"type": "button",
									"value": "cancel",
									"style": "default"
								}
							]
						}
					]
				})
				break;
			case 'schedule_later':
				console.log(`action type is ${type} and body content is ${util.inspect(body, { depth: null })}`);
				(async () => {
					let meeting_id = makeid();
					const members = await ChannelMembers(body.team.id + '_' + body.channel.id, body.channel.name);
					await DB.collection('meetings').updateOne(
						{ mid: meeting_id },
						{
							$set: {
								creator_uid: body.team.id + '_' + body.user.id,
								cid: body.team.id + '_' + body.channel.id,
								cname: body.channel.name,
								purpose: body.submission.purpose,
								topic: body.submission.topic,
								description: body.submission.description,
								who: body.submission.who,
								attendees: body.submission.who == "all" ? members : [],
								cmembers: members,
								start_time: '',
								end_time: '',
								duration: 60 //minutes
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
						});
					// req.session.submission = body.submission;
					let meeting_url = `meeting/` + meeting_id;
					web.chat.postEphemeral({
						as_user: false,
						channel: body.channel.id,
						user: body.user.id,
						attachments: JSON.stringify([
							{
								title: 'Just one step away from completing the meeting invitation.',
								text: 'Go to ' + base_url + meeting_url + ' to specify when and with whom to meet; Otherwise, type /we-meet later to manage your meetings.',
								color: '#74c8ed',
								// actions: [{
								// 	name: 'editMeeting',
								// 	text: 'Edit meeting details (e.g. when with whom)',
								// 	type: 'button',
								// 	value: meeting_url,
								// 	style: 'primary'
								// },
								// {
								// 	name: 'editLater',
								// 	text: 'Perhaps later',
								// 	type: 'button',
								// 	value: 'editLater',
								// 	style: 'default'
								// }
								// ],
							}
						])
					}).catch(err => console.error(err));
				})();
				// (async () => {
				// 	const members = await ChannelMembers(body.channel.id);

				// 	switch (body.submission.who) {
				// 		case 'all':

				// 			break;
				// 		case 'custom':
				// 			console.log('inside custom message now!');

				// 			break;
				// 		default:
				// 			console.log(`having specified members to schedule a meeting with`);
				// 			break;
				// 	}
				// 	function schedule_a_meeting(body) {
				// 		web.im.open({
				// 			user: body.submission.who
				// 		}).then(dm => {
				// 			console.log(`the returned channel id is ${dm.channel.id}`);
				// 		}).catch(err => console.error(err));
				// 		ticket.create(body.user.id, body.channel.id, submission);
				// 	};
				// })();
				break;
			case 'specify-later':

				break;

			default:
				break;
		}

	}
});

app.use(checkSignIn);

app.get('/', async function (req, res) {
	//you could do a combo of res.session.locals = res.locals() and res.locals(res.session.locals), but kinda hacky
	console.log(`session info is ${util.inspect(req.session, { depth: 3 })}, and the locals are ${util.inspect(res.locals, { depth: 2 })}`)
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'index-template';
	to_be_rendered.team = req.session.team;
	to_be_rendered.userInfo = req.session.user;
	to_be_rendered.members = await DB.collection('users').find({ team_id: req.session.team ? req.session.team.team_id : 'T0A286J8K' }).toArray().then((results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			//categorize the users based on their tz_labels, sorted by tz_offset
			results.sort((a, b) => {
				return a.tz_offset - b.tz_offset;
			});
			var num_tz = 0; var members_by_tz = {};
			results.forEach(r => {
				if (r.tz_offset in members_by_tz) members_by_tz[r.tz_offset].push(r);
				else {
					members_by_tz[r.tz_offset] = [];
					members_by_tz[r.tz_offset].push(r);
				}
			});
			console.log(`the total time zones are ${Object.keys(members_by_tz)}`)
			var obj = {
				tz_members: members_by_tz,
				members_total: results.length
			}
			return Promise.resolve(obj);
			// res.render('index', { layout: 'default', template: 'home-template', tz_members: members_by_tz });
		}
	});

	to_be_rendered.channels_info = await DB.collection('channels').find({ team_id: req.session.team ? req.session.team.team_id : 'T0A286J8K' }).toArray().then((results, err) => {
		if (err) console.error(err);
		if (results.length != 0) { //this is current all the channels of the team, but perhaps it is good to differentiate which ones the logged user belongs to vs not
			var TopSizeChannels = [], TopActiveChannels = [], reacted_msgs = [], msg_total = 0, limit = 3, c_list = []; //LIMIT is the number of Top X channels
			results.sort((a, b) => { //from big to small
				return b.num_members - a.num_members;
			});
			if (limit > results.length) limit = results.length;
			for (var i = 0; i < limit; i++) {
				msg_total += results[i].msgs.length;
				TopSizeChannels.push(results[i]);
			}
			results.sort((a, b) => { //from active to inactive, large to small
				return b.msgs.length - a.msgs.length;
			});
			for (var i = 0; i < limit; i++) {
				TopActiveChannels.push(results[i]);
			};
			results.forEach(r => {
				c_list.push({
					cid: r.cid,
					cname: r.cname
				});
			})
			var msgs = [], activeChannelIds = TopActiveChannels.map(c => c.cid);
			for (var i = 0; i < limit; i++) {
				var temp = TopActiveChannels[i].msgs;
				for (var j = 0; j < temp.length; j++) {
					temp[j].cname = TopActiveChannels[i].cname;
					// await UpdateChannelRecentMsgs(cid, token, limit);
				}
				msgs = msgs.concat(temp);
			}
			for (var i = 0; i < msgs.length; i++) {
				if (msgs[i].reactions == null) msgs[i].reactions = [];
			}
			msgs.sort((a, b) => { //from most reacted to least reacted, popular to small
				// return b.reactions.length - a.reactions.length; //reactions.length is the number of different type of reactions
				var a_reaction_number = 0, b_reaction_number = 0;
				for (var i = 0; i < a.reactions.length; i++) {
					a_reaction_number += a.reactions[i].count;
				}
				for (var i = 0; i < b.reactions.length; i++) {
					b_reaction_number += b.reactions[i].count;
				}
				// console.log(`reaction number is ${a_reaction_number}`);
				// console.log(`reaction number is ${b_reaction_number}`);
				return b_reaction_number - a_reaction_number;
			});

			// console.log(`reaction number is ${util.inspect(msgs, {depth:null})}`);
			for (var i = 0; i < 10; i++) {
				reacted_msgs.push(msgs[i]);
			}
			var obj = {
				TopSizeChannels: TopSizeChannels,
				TopActiveChannels: TopActiveChannels,
				channels_total: results.length,
				msg_total: msg_total,
				channel_list: c_list,
				reacted_msgs: reacted_msgs
			}
			return Promise.resolve(obj);
		}
	});
	res.render('index', to_be_rendered);
});
app.get('/cardview', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'card-template';
	res.render('cardview', to_be_rendered);
});

app.get('/tablelist', async function (req, res) {
	// generate the basic table for the logged in user to check who is closet to him/her
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'home-template';
	const numUsers = 80;
	const fields = ['real_name', 'channels', 'major', 'local_area', 'affiliation', 'campus'];
	let users = await similarity.getSimilarUsers(req.session.user.uid, DB, numUsers, fields);
	to_be_rendered.users = similarity.createSimilarityField(req.session.user, users, fields);
	to_be_rendered.users = similarity.createIsSharedField(req.session.user, users, fields);
	const channelNames = req.session.user.channels.map(channel => channel.cname)
		.filter(channel => channel !== 'general');
	to_be_rendered.channelNames = channelNames;
	to_be_rendered.users = to_be_rendered.users.map(user => {
		user.channelNames = user.channels.map(channel => channel.cname)
			.filter(channel => channel !== 'general');
		const channels = user.channelNames.map(name =>
			({
				name,
				isShared: channelNames.includes(name),
				className: `channel${channelNames.indexOf(name)}`
			})
		);
		if (channels.length > 4) {
			user.displayChannels = channels.slice(0, 4);
			user.extraChannels = channels.slice(4);
			return user;
		}
		user.displayChannels = channels;
		user.extraChannels = [];
		return user;
	});
	to_be_rendered.user = JSON.stringify(req.session.user);
	to_be_rendered.usersString = JSON.stringify(to_be_rendered.users);
	res.render('table', to_be_rendered);
});
app.get('/network_balloon', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'home-template';
	to_be_rendered.data = await DB.collection('users').find({ team_id: req.session.team.team_id }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			var nodes = results, direct_nodes = [], simiL = [], links = [], c_node = req.session.user, self_channels = req.session.user.channels;
			// var dist = await DB.collection('usersDistance').find({ "": c_node.uid });//.limit(10)
			// console.log(`the dist are ${util.inspect(dist, {depth: null})}`);
			console.log(`the self_channels are ${util.inspect(self_channels, { depth: null })}`);
			nodes.forEach(n => {
				if (n.uid == c_node.uid) {
					// console.error("now this is the logged user in the nodes loop");
					n.fixed = true;
					n.x = 400;//half of the canvas width/height
					n.y = 300;
					n.similarIdx = 1;
					return;
				}
				n.similarIdx = similarIdx(n.channels, self_channels);
				console.log(`similarity is ${util.inspect(n.similarIdx, { depth: null })}`);
				simiL.push(n.similarIdx);

				if (n.similarIdx >= 0.06) {
					links.push({
						source: n.uid,
						target: c_node.uid,
						value: n.similarIdx
					});
					direct_nodes.push(n);
				}
			});
			var i = direct_nodes.length;
			while (i--) {
				c_node = direct_nodes.splice(i, 1)[0];
				if (c_node.uid == undefined) console.log(`c_node is ${util.inspect(c_node, { depth: null })}`);
				nodes.forEach(n => {

					if (n.uid == c_node.uid) {
						return;
					};
					var simi = similarIdx(n.channels, c_node.channels)
					simiL.push(simi);
					if (simi >= 0.3) {
						links.push({
							source: n.uid,
							target: c_node.uid,
							value: simi
						});
					}
				})
			}
			console.log(`the third quantile similarity index is ${median(simiL)}; and the min is ${Math.min(...simiL)} and max is ${Math.max(...simiL)}`);
			// jac_links = similarIdx.JaccardIdx(m_channels);
			// console.log(`the jaclinks are ${util.inspect(jac_links, {depth: null})}`);
			console.log(`the nodes are ${util.inspect(nodes[0], { depth: null })}`);
			// console.log(`the total groups are ${Object.keys(link_ends)}`)
			var obj = {
				nodes: nodes,
				links: links,
				disL: [Math.min(...simiL), Math.max(...simiL)]
			}
			console.log(`links are ${util.inspect(links, { depth: 3 })}`);
			return Promise.resolve(obj);
		}
	});
	res.render('network', to_be_rendered);
});

app.get('/editProfile', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'editprofile-template';
	to_be_rendered.userInfo = req.session.user;
	res.render('profile', to_be_rendered);
});

app.post('/editProfile', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'editprofile-template';
	to_be_rendered.userInfo = await DB.collection('users').find({ uid: req.session.user.uid }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {

		};

	});
	res.render('profile', to_be_rendered);
});

app.get('/profile/:uid', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'profile-template';
	to_be_rendered.userInfo = req.session.user;
	res.render('profileview', to_be_rendered);
});

app.get('/meetings', async function (req, res) {
	let to_be_rendered = {};
	// console.log(`the req.params to be show is ${util.inspect(req.params, {depth: null})}`);
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'meetings-template';
	to_be_rendered.userInfo = req.session.user;
	const meetings1 = await DB.collection('meetings').find({ creator_uid: req.session.user.uid }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			console.log(`the meetings info created by you are ${util.inspect(results, { depth: null })}`);
			// var obj = {
			// 	purpose: results[0].submission.purpose,
			// 	description: results[0].submission.description,
			// 	topic: results[0].submission.topic,
			// 	who: results[0].submission.who,
			// 	start_time: results[0].start_time,
			// 	duration: results[0].duration,
			// 	creator: results[0].creator_uid
			// }
			// console.log(`User info is ${to_be_rendered.userInfo.uid}, and the creator is ${to_be_rendered.meetings[0].creator_uid}`);
			return Promise.resolve(results);
		}
		else {
			to_be_rendered.empty1 = true;
		}
	});
	const meetings2 = await DB.collection('meetings').find({
		"attendees.uid": req.session.user.uid
		// attendees:
		// {

		// 	real_name: req.session.user.real_name,
		// 	first_name: req.session.user.first_name,
		// 	last_name: req.session.user.last_name,
		// 	uid: req.session.user.uid,
		// 	email: req.session.user.email,
		// 	attend: "accept"
		// }
	}).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			console.log(`the meetings you are invited are ${util.inspect(results, { depth: null })}`);
			// to_be_rendered.empty = false;
			// var obj = {
			// 	purpose: results[0].submission.purpose,
			// 	description: results[0].submission.description,
			// 	topic: results[0].submission.topic,
			// 	who: results[0].submission.who,
			// 	start_time: results[0].start_time,
			// 	duration: results[0].duration,
			// 	creator: results[0].creator_uid
			// }
			// console.log(`User info is ${to_be_rendered.userInfo.uid}, and the creator is ${to_be_rendered.meetings[0].creator_uid}`);
			return Promise.resolve(results);
		}
		else to_be_rendered.empty2 = true;
	});
	if (to_be_rendered.empty1 & to_be_rendered.empty2) to_be_rendered.empty = true;
	to_be_rendered.meetings = await union(meetings1 ? meetings1 : [], meetings2 ? meetings2 : []);//[...new Set([...meetings1, ...meetings2])];//
	res.render('meetings_table', to_be_rendered);
});

app.get('/meeting/:mid', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'meeting-template';
	to_be_rendered.userInfo = req.session.user;
	to_be_rendered.meeting = await DB.collection('meetings').find({ mid: req.params.mid }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			console.log(`the meeting info to be show is ${util.inspect(results, { depth: null })}`);
			var obj = {
				exist: true,
				mid: results[0].mid,
				purpose: results[0].purpose,
				description: results[0].description,
				topic: results[0].topic,
				who: results[0].who,
				date: results[0].date,
				time: results[0].start_time,
				duration: results[0].duration,
				creator_uid: results[0].creator_uid,
				cmembers: results[0].cmembers,
				cname: results[0].cname,
				cid: results[0].cid,
				attendees: results[0].attendees
			}
			return Promise.resolve(obj);
		}
		else if (req.params.mid == "new") {
			console.log(`create new meeting`);
			const members = await ChannelMembers("T0A286J8K_C0A28BAHG", "general");
			var obj = {
				exist: true,
				mid: makeid(),
				new: true,
				creator_uid: req.session.user.uid,
				cmembers: members,
				attendees: [],
				cid: 'T0A286J8K_C0A28BAHG',
				cname: 'general',
				who: 'custom'
			}

			return Promise.resolve(obj);
		}
		else {
			console.log(`the meeting url ${req.params.mid} does not exist!`);
			return Promise.resolve({
				exist: false
			});
		}
	});
	res.render('meeting_form', to_be_rendered);
});

app.post('/meeting/:mid', async function (req, res) {
	console.log(`post update the meeting form is ${util.inspect(req.body, { depth: 2 })}`);
	console.error('updating now');
	// Sanitize fields.
	// sanitizeBody('first_name').trim().escape(),
	// sanitizeBody('family_name').trim().escape(),
	// sanitizeBody('date_of_birth').toDate(),
	// sanitizeBody('date_of_death').toDate(),
	const cmembers = await ChannelMembers(req.body.cid, req.body.cname);
	var updateObj = {
		purpose: req.body.purpose,
		description: req.body.description,
		topic: req.body.topic,
		who: req.body.who,
		start_time: req.body.time,
		date: req.body.date,
		creator_uid: req.session.user.uid,
		cid: req.body.cid,
		cname: req.body.cname,
		cmembers: cmembers,
		duration: req.body.duration
	};
	(async () => {

		if (req.body.who == "custom") {
			updateObj.attendees = await cmembers.filter(member => req.body.attendees.includes(
				member.uid
				// 	{
				// 	uid: member.uid,
				// 	real_name: member.real_name,
				// 	last_name: member.last_name,
				// 	first_name: member.first_name,
				// 	email: member.email
				// }
			));
			console.log(`the update is set to be custom attendees: ${util.inspect(updateObj.attendees, { depth: null })}`);
		}
		else updateObj.attendees = await cmembers;



		// const cmembers = await DB.collection('meetings').find({ mid: req.params.mid }).toArray().then(async (results, err) => {
		// 	if (err) console.error(err);
		// 	else if (results.length != 0) {
		// 		if (req.body.who == "custom") {
		// 			updateObj.attendees = await results[0].cmembers.filter(member => req.body.attendees.includes(
		// 				member.uid
		// 				// 	{
		// 				// 	uid: member.uid,
		// 				// 	real_name: member.real_name,
		// 				// 	last_name: member.last_name,
		// 				// 	first_name: member.first_name,
		// 				// 	email: member.email
		// 				// }
		// 			));
		// 			console.log(`the update is set to be custom attendees: ${util.inspect(updateObj.attendees, { depth: null })}`);
		// 		}
		// 		else updateObj.attendees = await results[0].cmembers;
		// 		return Promise.resolve(updateObj.attendees);
		// 	}
		// 	else if (req.params.mid=="new") {

		// 	}
		// });

		await DB.collection('meetings').updateOne({ mid: req.body.mid },
			{
				$set: updateObj
			},
			{ upsert: true },
			function (err, res) {
				if (err) console.error(err);
				return Promise.resolve(res);
				console.log(`Meeting information updated succesfully: ${util.inspect(updateObj, { depth: 2 })}`);
			});
		console.log('redirecting to meetings');
		// res.redirect('/meetings');//ajax this will not be responded
		res.json({ success: true });
	})();

});


app.post('/reactmeeting', async function (req, res) {
	console.log(`into reacting post with req.body is ${util.inspect(req.body, { depth: null })}`);
	await DB.collection('meetings').find({ mid: req.body.mid }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			var attendees_info = await results[0].cmembers.filter(member => req.body.attendees.includes(
				member.uid
			));
			console.log(`find the attendee info is ${util.inspect(attendees_info, { depth: null })}`);
			const newAttendees = await attendees_info.map(atd => {
				if (atd.uid == req.body.who_react) {
					atd.attend = req.body.react;
					return atd;
				}
				else return atd;
			});
			console.log(`new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
			if (newAttendees.length) await DB.collection('meetings').updateOne({ mid: req.body.mid },
				{
					$set: {
						attendees: newAttendees
					}
				},
				{ upsert: false },
				function (err, res) {
					if (err) console.error(err);
					console.log(`Meeting information updated succesfully, new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
				});
			return Promise.resolve(attendees_info);
		}
	});




	res.sendStatus(200);
});

app.post('/remindmeeting', async (req, res)=>{
	// var attendeeIDs = req.body.attendees.map(x => x.uid);
	req.body.attendees.forEach( attendee =>{
		web.im.open({
			user: attendee.uid.split('_')[1]
		}).then(dm => {
			console.log(`the returned channel id is ${dm.channel.id}`);
			if(attendee.attend == undefined) web.chat.postMessage({
				as_user: false,
				channel: dm.channel.id,
				text: `Would you like to join the meeting invited by XXX?`,
				attachments: JSON.stringify([
					{
						title: 'Purpose: aaa; Time: aaa',
						text: 'Visit here<>wik',
						callback_id: 'meeting_react',
						color: '#74c8ed',
						actions: [{
							name: 'accept',
							text: 'Sure',
							type: 'button',
							value: 'accept',
							style: 'primary'
						},
						{
							name: 'reject',
							text: 'No, thanks',
							type: 'button',
							value: 'reject',
							style: 'default'
						}
						],
					},]
				)
			}).catch(err => console.error(err));
			else if (attendee.attend == "accept") {
				web.chat.postMessage({
					as_user: false,
					channel: dm.channel.id,
					// text: `Would you like to join the meeting?`,
					attachments: JSON.stringify([
						{
							title: 'Reminder: the meeting with XXX',
							text: `Visit <${base_url}meeting/${req.body.mid}> for more details. `,
							callback_id: 'meeting_react',
							color: '#74c8ed'
						},]
					)
				}).catch(err => console.error(err));
			}
		}).catch(err => console.error(err));
	}
	)
	res.sendStatus(200);
});

function similarTo(list, user) {
	console.log(`the list in similarTo is ${util.inspect(list, { depth: 3 })}`);
	var dist = 'impossible value';
	list.some(el => {

		if (el.user == user) {
			console.log(`the distance index inside similarTo func is ${JSON.stringify(el)}`);
			console.log(el.distance);
			dist = el.distance;
			return el.user === user;
		}


	});
	return Promise.resolve(dist);
}
app.get('/network', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'home-template';
	to_be_rendered.data = await DB.collection('users').find({ team_id: req.session.team.team_id }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			var nodes = results, direct_nodes = [], distL = [], links = [], c_node = req.session.user, self_channels = req.session.user.channels;
			(async () => {
				nodes.forEach(async (n) => {
					if (n.uid == c_node.uid) {
						// console.error("now this is the logged user in the nodes loop");
						n.fixed = true;
						n.x = 400;//half of the canvas width/height
						n.y = 300;
						n.distIdx = 1;
						return;
					}
					n.distIdx = await similarTo(n.similar_users, c_node.uid);
					console.log(`distance is ${util.inspect(n.distIdx, { depth: null })}`);
					distL.push(n.distIdx);

					if (n.distIdx <= 0.4) {
						links.push({
							source: n.uid,
							target: c_node.uid,
							value: n.distIdx
						});
						direct_nodes.push(n);
					}
				});
				var i = await direct_nodes.length;
				console.log(`number of direct_nodes is ${direct_nodes.length}`)
				while (i--) {
					c_node = direct_nodes.splice(i, 1)[0];
					console.log(`c_node is ${util.inspect(c_node, { depth: null })}`);
					nodes.forEach(async (n) => {

						if (n.uid == c_node.uid) {
							return;
						};
						dis = await similarTo(n.similar_users, c_node.uid);
						console.log(`dist is ${util.inspect(dis, { depth: null })}`);
						distL.push(dis);
						if (dis <= 0.4) {
							links.push({
								source: n.uid,
								target: c_node.uid,
								value: dis
							});
						}
					})
				}
			})();
			// console.log(`the third quantile similarity index is ${median(distL)}; and the min is ${Math.min(...distL)} and max is ${Math.max(...distL)}`);
			// console.log(`the nodes are ${util.inspect(nodes[0], { depth: null })}`);
			var obj = {
				nodes: nodes,
				links: links,
				disL: [Math.min(...distL), Math.max(...distL)]
			}
			console.log(`links are ${util.inspect(links, { depth: 3 })}`);
			return Promise.resolve(obj);
		}
	});
	res.render('network', to_be_rendered);
});


app.get('/network11', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'home-template';
	to_be_rendered.data = await DB.collection('users').find({ team_id: req.session.team.team_id }).toArray().then((results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			var nodes = [];
			var groups = [];
			var links = []
			var link_ends = {};
			results.forEach(r => {
				obj = r;
				obj.name = r.first_name;
				obj.id = r.uid;
				nodes.push(obj);
				if (groups.indexOf(obj.group) == -1) {
					groups.push(obj.group);
					link_ends[obj.group] = [obj.id];
				}
				else {
					console.log(`link_ends list is ${util.inspect(link_ends[obj.group], { depth: null })}`);
					link_ends[obj.group].forEach(end => {//for (var end in link_ends[obj.group]) { loop through the index instead of array item
						console.log(`the pushed source end is ${end}`)
						console.log(`the pushed target end is ${r.uid}`)
						links.push({
							source: end,
							target: r.uid,
							value: Math.random()
						});
					});
					link_ends[obj.group].push(obj.id);
				}
			});
			console.log(`the total groups are ${Object.keys(link_ends)}`)
			var obj = {
				nodes: nodes,
				links: links
			}
			console.log(`links are ${util.inspect(links, { depth: 3 })}`);
			return Promise.resolve(obj);
			// res.render('index', { layout: 'default', template: 'home-template', tz_members: members_by_tz });
		}
	});
	res.render('network', to_be_rendered);
});

app.get('/temporal', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'home-template';
	to_be_rendered.members = await DB.collection('users').find({ team_id: req.session.team.team_id }).toArray().then((results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			//categorize the users based on their tz_labels, sorted by tz_offset
			results.sort((a, b) => {
				return a.tz_offset - b.tz_offset;
			});
			var num_tz = 0; var members_by_tz = {};
			results.forEach(r => {
				if (r.tz_offset in members_by_tz) members_by_tz[r.tz_offset].push(r);
				else {
					members_by_tz[r.tz_offset] = [];
					members_by_tz[r.tz_offset].push(r);
				}
			});
			console.log(`the total time zones are ${Object.keys(members_by_tz)}`)
			var obj = {
				tz_members: members_by_tz,
				members_total: results.length
			}
			return Promise.resolve(obj);
			// res.render('index', { layout: 'default', template: 'home-template', tz_members: members_by_tz });
		}
	});
	to_be_rendered.channels_info = await DB.collection('channels').find({ team_id: 'T0A286J8K' }).toArray().then((results, err) => {
		if (err) console.error(err);
		if (results.length != 0) { //this is current all the channels of the team, but perhaps it is good to differentiate which ones the logged user belongs to vs not
			var TopSizeChannels = [], TopActiveChannels = [], msg_total = 0, limit = 3, c_list = []; //LIMIT is the number of Top X channels
			results.sort((a, b) => { //from big to small
				return b.num_members - a.num_members;
			});

			for (var i = 0; i < limit; i++) {
				msg_total += results[i].msgs.length;
				TopSizeChannels.push(results[i]);
			}
			results.sort((a, b) => { //from active to inactive
				return a.msgs.length - b.msgs.length;
			});
			for (var i = 0; i < limit; i++) {
				TopActiveChannels.push(results[i]);
			};
			results.forEach(r => {
				c_list.push({
					cid: r.cid,
					cname: r.cname
				});
			})
			var obj = {
				TopSizeChannels: TopSizeChannels,
				TopActiveChannels: TopActiveChannels,
				channels_total: results.length,
				msg_total: msg_total,
				channel_list: c_list
			}
			return Promise.resolve(obj);
		}
	});
	// console.log(util.inspect(to_be_rendered, { depth: 2 }));
	res.render('temporal', to_be_rendered);
});

//calculate similar users here
async function InitTeamMembers(team_id, token, limit = null) {
	var first = true, cursor = "fake", counter = 0;
	let local_slack = new SlackWebClient(token);
	while (cursor) {
		if (first || limit) {
			console.log(`first while iteration in InitTeamMembers: round ${counter}`)
			await local_slack.users.list({
				include_locale: true,
				limit: limit | 200
			}).then(res => {
				// console.log(`members in the team include ${util.inspect(res.members, { depth: null })}`);
				cursor = res.response_metadata.next_cursor;
				counter += 1;
				// console.log(`cursor is ${cursor} and counter is ${counter}`)
				res.members.forEach(async (m) => {
					var uid = m.team_id + '_' + m.id;
					var user_channels = [];
					await local_slack.users.conversations({
						user: m.id,
						limit: 200, //this should be c_limit for channel limit per member instead of the limit as the users list
						// cursor: c_cursor this should also be initialized
					}).then(res_channels => {
						res_channels.channels.forEach(c => {
							user_channels.push({
								cid: m.team_id + '_' + c.id,
								cname: c.name
							});
						});
					});
					const onComplete = async () => {
						console.log('user updated succesfully');
						const email = m.profile.email;
						const fullName = m.profile.real_name;
						await ldap.updateUserWithLdapData(email, fullName, uid, DB);
						await similarity.storeSimilarUsers(uid);
					}
					if (!m.is_bot && m.id != 'USLACKBOT') DB.collection('users').updateOne(
						{ uid: uid },
						{
							$set: {
								uid: uid,
								team_id: m.team_id,
								name: m.name,
								email: m.profile.email,
								real_name: m.real_name,
								tz: m.tz,
								tz_label: m.tz_label,
								local_area: m.tz ? m.tz.match(/([a-zA-Z]+)\//)[1] : 'unknown',
								tz_offset: m.tz_offset / (60 * 60),
								title: m.profile.title,
								phone: m.profile.phone,
								status_text: m.profile.status_text,
								status_emoji: m.profile.status_emoji,
								status_expiration: m.profile.status_expiration,
								first_name: m.profile.first_name ? m.profile.first_name : m.profile.real_name.split(' ')[0],
								last_name: m.profile.last_name,
								image_48: m.profile.image_48,
								image_512: m.profile.image_512,
								is_custom_image: m.profile.is_custom_image,
								is_bot: m.is_bot,
								last_updated: m.updated,
								locale: m.locale,
								channels: user_channels
							}
						},
						{ upsert: true },
						onComplete);

				})
			});
			first = false;
			if (limit || !cursor) break;
		}
		else {
			console.log('iteration in InitTeamMembers else')
			await local_slack.users.list({
				cursor: cursor,
				include_locale: true,
				limit: limit | 200
			}).then(res => {
				// console.log(`members in the team include ${util.inspect(res.members, { depth: null })}`);
				cursor = res.response_metadata.next_cursor;
				counter += 1;
				// console.log(`cursor is ${cursor} and counter is ${counter}`)
				res.members.forEach(async (m) => {
					// console.log(`the m value inside res.members are (from users.list): ${util.inspect(m, { depth: null })}`)
					var uid = m.team_id + '_' + m.id;
					var user_channels = [];
					await local_slack.users.conversations({
						user: m.id,
						limit: 200, //this should be c_limit for channel limit per member instead of the limit as the users list
						// cursor: c_cursor this should also be initialized
					}).then(res_channels => {
						res_channels.channels.forEach(c => {
							console.log(c.id);
							user_channels.push({
								cid: m.team_id + '_' + c.id,
								cname: c.name
							});
						});
					});
					if (!m.is_bot && m.id != 'USLACKBOT') DB.collection('users').updateOne(
						{ uid: uid },
						{
							$set: {
								uid: uid,
								team_id: m.team_id,
								name: m.name,
								real_name: m.real_name,
								email: m.profile.email,
								tz: m.tz,
								tz_label: m.tz_label,
								local_area: m.tz ? m.tz.match(/([a-zA-Z]+)\//)[1] : 'unknown',
								tz_offset: m.tz_offset / (60 * 60),
								title: m.profile.title,
								phone: m.profile.phone,
								status_text: m.profile.status_text,
								status_emoji: m.profile.status_emoji,
								status_expiration: m.profile.status_expiration,
								first_name: m.profile.first_name ? m.profile.first_name : m.profile.real_name.split(' ')[0],
								last_name: m.profile.last_name,
								image_48: m.profile.image_48,
								image_512: m.profile.image_512,
								is_custom_image: m.profile.is_custom_image,
								is_bot: m.is_bot,
								last_updated: m.updated,
								locale: m.locale,
								channels: user_channels
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
							console.log('user updated succesfully');
						});

				});
			});
			if (!cursor) break;
		}
	}
}

async function InitTeamChannels(team_id, token, limit = null) {
	var first = true, cursor = "fake", counter = 0;
	var local_slack = new SlackWebClient(token);
	while (cursor) {
		if (first || limit) {
			// console.log(`iteration in InitTeamChannels: round ${counter}`)
			await local_slack.conversations.list({ //find all the channel info given a teamID; default: public channels as 'types' param
				limit: limit | 20
			}).then(res => {
				cursor = res.response_metadata.next_cursor;
				counter += 1;
				// console.log(`cursor is ${cursor} and counter is ${counter}`)
				res.channels.forEach(m => {
					var cid = team_id + '_' + m.id;

					DB.collection('channels').updateOne(
						{ cid: cid },
						{
							$set: {
								cid: cid,
								cname: m.name,
								team_id: team_id,
								topic: m.topic.value,
								purpose: m.purpose.value,
								num_members: m.num_members,
								msgs: []
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
							(async () => {
								await UpdateChannelRecentMsgs(cid, token, limit);
								console.log('channel updated succesfully');
							})();
						});
				})
			});
			first = false;
			if (limit || !cursor) break;
		}
		else {
			console.log('iteration in InitTeamChannels else')

			await local_slack.conversations.list({
				cursor: cursor,
				limit: limit | 20
			}).then(res => {
				// console.log(`members in the team include ${util.inspect(res.members, { depth: null })}`);
				cursor = res.response_metadata.next_cursor;
				counter += 1;
				// console.log(`cursor is ${cursor} and counter is ${counter}`)
				res.channels.forEach(m => {
					// console.log(`the m value inside res.channels are (from conversations.list): ${util.inspect(m, { depth: null })}`)
					var cid = team_id + '_' + m.id;
					DB.collection('channels').updateOne(
						{ cid: cid },
						{
							$set: {
								cid: cid,
								cname: m.name,
								team_id: team_id,
								topic: m.topic.value,
								purpose: m.purpose.value,
								num_members: m.num_members,
								msgs: []
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
							(async () => {
								await UpdateChannelRecentMsgs(cid, token, limit);
								console.log('channel updated succesfully');
							})();
						});
				});
			});
			if (!cursor) break;
		}
	}

}

async function UpdateChannelRecentMsgs(c_id, token, limit = 200) {
	//init the channel info with the msgs from real users in the past month from now
	let local_slack = new SlackWebClient(token);
	console.log(`channel id passed in is ${c_id}`)

	var x = new Date();
	x.setDate(1);
	x.setMonth(x.getMonth() - 1);
	local_slack.channels.history({ // pay attention the user token (for reading history from channel/groups) but the bot is used to write
		channel: c_id.split('_')[1], //#test-bot (left) #learning-tech C0A34HJVA
		count: limit | 200,
		latest: new Date().getTime(),
		// oldest: x.getTime() //since previous month
	}).then(async res => {
		const msgs = res.messages;
		var recent_msgs = [];
		var promiseArray = [];

		// console.log(`msg in the Update func is ${util.inspect(msgs, {depth: 2})}`);
		// console.log(`there are ${msgs.length} results from a channel history \n the first one is ${util.inspect(msgs[0], { depth: 2 })}`)

		msgs.forEach(msg => {
			if (msg.type == 'message' && !msg.bot_id && !msg.subtype) { // only look at the plain text msgs from real users
				// console.log(`Real msg from user in the Update func is ${util.inspect(msg, {depth: 2})}`);
				var promise = DB.collection('users')
					.find({ uid: c_id.split('_')[0] + '_' + msg.user }
					).toArray()
					.then((docs, err) => {
						if (err) console.error(err);
						if (docs.length != 0) {
							console.log(`real_name for the message creator is ${docs[0].real_name}`);
							return Promise.resolve(docs[0]);
						}
						else console.error(`Member ${msg.user} does not exist`);
					}).then(user => {
						const msg_obj = {
							mid: msg.client_msg_id,
							uid: msg.user,
							username: user.real_name,
							user_avatar: user.image_48,
							text: msg.text,
							ts: timeConverter(msg.ts),
							is_starred: msg.is_starred,
							reactions: msg.reactions
						}
						recent_msgs.push(msg_obj);
					});
				promiseArray.push(promise);
			}
		});

		await Promise.all(promiseArray).then(res => {
			console.log(promiseArray)
			console.log(`recent msgs array inside Promise array is ${util.inspect(recent_msgs, { depth: null })}`)

		})
		console.log(`recent msgs array is ${util.inspect(recent_msgs, { depth: null })}`)
		return recent_msgs;


	})
		.then(recent_msgs => {
			console.log(`recent msgs array is ${util.inspect(recent_msgs, { depth: null })}`)
			DB.collection('channels').updateOne(
				{ cid: c_id },
				{
					$set: {
						msgs: recent_msgs
					}
				},
				function (err, res) {
					if (err) console.error(err);
					// else console.log(`msgs entered with DB transaction ${res}`)
				});
		})
		.catch(err => console.error(err));
}

async function ActiveWho(channel_id, user_id) {
	var members = [], activeMembers = [], activeProfiles = [];
	var promiseArray = [];
	await web.conversations.members({
		channel: channel_id,
		limit: 20 //TODO: change this number 
	})
		.then(async (res) => {
			// console.log(`the web client result is ${util.inspect(res, { depth: 2, color: true })}`);
			members = res.members;
			// console.log(`members are ${members}`);

			members.forEach(member => {
				if (member === user_id) return;
				var promise = web.users.getPresence({ user: member })
					.then(async (resp) => {
						// console.log(`${member} presence status is ${resp.presence}`);
						await web.users.info({ user: member, include_locale: true })
							.then(res => {
								if (resp.presence == 'active' && !res.user.is_bot) {
									console.log(`user name is ${res.user.profile.real_name}`);
									activeMembers.push({
										id: member,
										username: res.user.name,
										name: res.user.profile.real_name,
										email: res.user.profile.email
									});
								}

							});
						// promiseArray.push(inner_promise);

					});
				promiseArray.push(promise);

			});
			await Promise.all(promiseArray).then(res => {
				console.log(promiseArray)
				console.log(`now active members:${util.inspect(activeMembers, { depth: 2, color: true })}`);

			})

		});
	return activeMembers;
}

async function ChannelMembers(channel_id, channel_name) {
	const members = await DB.collection('users')
		.find({
			"channels": {
				cid: channel_id,
				cname: channel_name
			}
		}).toArray()
		.then(async (docs, err) => {
			if (err) console.error(err);
			if (docs.length != 0) {
				// console.log(`Members in Channel ${channel_id}: ${util.inspect(docs, { depth: 2 })}`);
				const members = docs.map(x => {
					return {
						real_name: x.real_name,
						first_name: x.first_name,
						last_name: x.last_name,
						uid: x.uid,
						email: x.email
					}
				})
				return Promise.resolve(members);
			}
			else console.error(`Members in Channel ${channel_id} are none`);
		});
	// console.log(`Members in Channel ${channel_id}: ${util.inspect(members, { depth: 2 })}`);
	return members;
}
function OnlineNow(channel_id, user_id, responseURL) {

	(async () => {
		const active = await ActiveWho(channel_id, user_id);
		console.log(`who is online with ActiveWho func: ${util.inspect(active, { depth: 2 })}`);
		var message = active.length ? {
			"text": `There are ${active.length} other students in this channel online :raising_hand: `,
			"attachments": [
				{
					"text": "Would you like to invite them for video call or a Slack group chat",
					"fallback": "Shame... buttons aren't supported in this land",
					"callback_id": "ContactNow",
					"color": "#3AA3E3",
					"attachment_type": "default",
					"actions": [
						{
							"name": "hangout",
							"text": "Video call",
							"type": "button",
							"value": "hangout"
						},
						// {
						// 	"name": "mention",
						// 	"text": "@here in the channel",
						// 	"type": "button",
						// 	"value": "mention"
						// },
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
			// ,
			// replace_original: false,
		} : {
				'text': 'Nobody is online :point_left: :shrug: ',
				'attachments': [
					{
						'text': 'Would you like to send an email to set up something later',
						"fallback": "Shame... buttons aren't supported in this land",
						"callback_id": "Nobody-Online",
						"color": "#3AA3E3",
						"attachment_type": "default",
						"actions": [

							{
								"name": "Later",
								"text": "Yes, schedule something later",
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
	})()

	// //another way of implementation
	// var members = [], activeMembers = [], activeProfiles = [];
	// var promiseArray = [];
	// web.conversations.members({
	// 	token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
	// 	channel: channel_id,
	// 	limit: 20 //TODO: change this number 
	// })
	// 	.then(res => {
	// 		// console.log(`the web client result is ${util.inspect(res, { depth: 2, color: true })}`);
	// 		members = res.members;
	// 		// console.log(`members are ${members}`);

	// 		members.forEach(member => {

	// 			var promise = web.users.getPresence({ user: member })
	// 				.then(async (resp) => {
	// 					// console.log(`${member} presence status is ${resp.presence}`);
	// 					await web.users.info({ user: member, include_locale: true })
	// 						.then(res => {
	// 							// console.log(`user name is ${res.user.profile.real_name}`);
	// 							if (resp.presence == 'active' && !res.user.is_bot) {
	// 								console.log(`user name is ${res.user.profile.real_name}`);
	// 								activeMembers.push({
	// 									id: member,
	// 									username: res.user.name,
	// 									name: res.user.profile.real_name,
	// 									email: res.user.profile.email
	// 								});
	// 							}

	// 						});
	// 					// promiseArray.push(inner_promise);

	// 				});
	// 			promiseArray.push(promise);

	// 		});
	// 		Promise.all(promiseArray).then(res => {
	// 			console.log(promiseArray);
	// 			var message = {
	// 				"text": `There are ${activeMembers.length} students of this channel online`,
	// 				"attachments": [
	// 					{
	// 						"text": "Would you like to invite them for video call or a Slack group chat",
	// 						"fallback": "Shame... buttons aren't supported in this land",
	// 						"callback_id": "ContactNow",
	// 						"color": "#3AA3E3",
	// 						"attachment_type": "default",
	// 						"actions": [
	// 							{
	// 								"name": "hangout",
	// 								"text": "Video call",
	// 								"type": "button",
	// 								"value": "hangout"
	// 							},
	// 							{
	// 								"name": "mention",
	// 								"text": "@here in the channel",
	// 								"type": "button",
	// 								"value": "mention"
	// 							},
	// 							{
	// 								"name": "Cancel",
	// 								"text": "Cancel",
	// 								"type": "button",
	// 								"value": "cancel",
	// 								"style": "danger"
	// 							}
	// 						]
	// 					}
	// 				]
	// 				// ,
	// 				// replace_original: false,
	// 			}
	// 			sendMessageToSlackResponseURL(responseURL, message);


	// 			return activeMembers;
	// 		})
	// 	});
}
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

function timeConverter(UNIX_timestamp) {
	var a = new Date(UNIX_timestamp * 1000);
	var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	var year = a.getFullYear();
	var month = months[a.getMonth()];
	var date = a.getDate();
	var hour = a.getHours();
	var min = a.getMinutes();
	var sec = a.getSeconds();
	var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
	return time;
}

function checkSignIn(req, res, next) {
	// res.locals.login = true;
	// 	console.log(`req ip is ${req.ip}, if there is list, then ${req.ips}`)
	// 	next(); 
	if (req.session.user) {
		// console.log(`user logged in: ${req.session.user}`);
		// console.log(`locals are ${util.inspect(res.locals, { depth: 2 })}`)
		res.locals.login = true;
		console.log(`req ip is ${req.ip}, if there is list, then ${req.ips}`)
		next();     //If session exists, proceed to page
	} else {
		var err = new Error("Not logged in!");
		// console.log(req.session.user);
		// next(err);  //Error, trying to access unauthorized page!
		console.error(err);
		res.redirect('/login');
	}
}

app.use((req, res, next) => {
	return next(createError(404, 'File not found'));
});

app.use((err, req, res, next) => {
	res.locals.message = err.message; //makiong the error message available in the template
	const status = err.status | 500;
	res.locals.error = req.app.get('env') === 'development' ? err : {};
	res.status(status);
	return res.render('error')
});

// Set up express server here
// const options = {
//     cert: fs.readFileSync('/etc/pki/tls/certs/weconnect.crt'),
//     key: fs.readFileSync('/etc/pki/tls/private/weconnect.key')
// };
app.listen(process.env.PORT, () => {
	console.log(`WeAre! server is running on PORT ${process.env.PORT}`);
});

process.on('exit', () => {
	ldap.closeLdapConnection();
});

// https.createServer(options, app).listen(8443);

function initDB() {
	DB.createCollection('commands', function (err, collection) { });
	DB.createCollection('users', function (err, collection) { });
	DB.createCollection('chats', function (err, collection) { });
	DB.createCollection('userlogs', function (err, collection) { });
	DB.createCollection('channeladdress', function (err, collection) { });
	DB.createCollection('channels', function (err, collection) { });
	DB.createCollection('teamnames', function (err, collection) { });
	DB.createCollection('oauthtokens', function (err, collection) { });
	// DB.createCollection('tildaposts', function (err, collection) { });
}


Array.prototype.contains = Array.prototype.contains || function (obj) {
	var i, l = this.length;
	for (i = 0; i < l; i++) {
		if (this[i] == obj) return true;
	}
	return false;
};

function median(values) {
	values.sort(function (a, b) {
		return a - b;
	});

	if (values.length === 0) return 0

	var half = Math.floor(values.length * 3 / 4);//third quantile

	if (values.length % 2)
		return values[half];
	else
		return (values[half - 1] + values[half]) / 2.0;
}

function makeid() {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 5; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}

function union(array1, array2) {
	// if(a1)
	// return [...new Set([...a1, ...a2])]
	if (array1 == undefined | array1.length == 0) return array2;
	else if (array2 == undefined | array2.length == 0) return array1;
	const result = array2.concat(array1).filter(function (o) {
		return this.has(o.mid) ? false : this.add(o.mid);
	}, new Set());
	return result;
}