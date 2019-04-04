require('dotenv').config();
const app = require('../server/service.js');
const similarIdx = require('../server/calculators.js');
//const SlackRTMClient = require('../server/SlackRTMClient');
const path = require('path');
const https = require('https');
const expressIp = require('express-ip');
const { check, validationResult } = require('express-validator/check');
const createError = require('http-errors')
const util = require('util');
const ticket = require('../ticket.js');
const onboard = require('../server/onboard.js')
const similarity = require('../server/similarity/similarity');
const WebSocket = require('ws');
const expressWs = require('express-ws')(app);
// const app = http.createServer(server);
// console.log(`this is the PORT: ${process.env.PORT}`)
const { sanitizeBody } = require('express-validator/filter');

const bodyParser = require("body-parser");
const request = require('request');
const apiUrl = 'https://slack.com/api';
const base_url = 'https://420520b7.ngrok.io';
const presence_snapshot = {};
const snapshot_db = {};
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
const he = require('he');
//event listener leak
require('events').EventEmitter.defaultMaxListeners = 15;
// process.setMaxListeners(0);
// require('events').EventEmitter.prototype._maxListeners = 100;

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


// const SlackRTMClient = require('@slack/client').RTMClient;
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
		rtmConnectFn('T0A286J8K');
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
// app.use((req, res, next) => {
// 	const maxAge = 24 * 60 * 60 * 1000; //<=24h, 60000 1min
// 	sess.cookie = { maxAge };
// 	sess.store.on('create', (sessionId) => {
// 		console.log(`create ${sessionId}`);
// 		setTimeout(() => {
// 			if (!!req.session.user) {
// 				const type = 'Session Expired'
// 				const timeStamp = new Date();
// 				const time = timeStamp.toString();
// 				const content = `Session ${sessionId} for user ${req.session.user.email} expired`;
// 				const path = req.path;
// 				const log = { type, time, timeStamp, content, path };
// 				logEvent(log, req);
// 			}
// 		}, maxAge);
// 	});
// 	session(sess)(req, res, next);
// });
app.use((req, res, next) => {
	const { method, body, params, query, path } = req;
	if (path === '/log') {
		next();
		return;
	}
	const type = `${method} Request`;
	const label = type + ' to ' + path;
	const content = { body, query, params, label };
	for (const key in content) {
		if (!content[key] || Object.keys(content[key]).length === 0) {
			delete content[key];
		}
	}
	const timeStamp = new Date();
	const time = timeStamp.toString();
	const log = {
		type,
		time,
		timeStamp,
		content,
		path
	};
	logEvent(log, req);
	if (method === 'GET' && '/logout' === path) {
		const action = 'logout';
		const type = `User ${action}`;
		const content = type;
		const log = {
			type,
			time,
			timeStamp,
			content,
			path
		};
		logEvent(log, req);
	}
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
		unescape: function (x) {
			if (x == undefined) return null;
			return unescape(x);
		},
		eq: function () {
			const args = Array.prototype.slice.call(arguments, 0, -1);
			return args.every(function (expression) {
				return args[0] === expression;
			});
		},
		get_UserID: function (uid) {
			return uid.split('_')[1];
		},
		get_TeamID: function (cid) {
			return cid.split('_')[0];
		},
		timeConverter: function (UNIX_timestamp, userInfo) {
			console.log(userInfo)
			var a = new Date(UNIX_timestamp * 1000);
			var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			var year = a.getFullYear();
			var month = months[a.getMonth()];
			var date = a.getDate();
			// var hour = a.getHours();
			// var min = "0" + a.getMinutes();
			// var sec = "0" + a.getSeconds();
			// var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min.substr(-2) + ':' + sec.substr(-2);
			var time = new Date(a).toLocaleTimeString(userInfo.locale,
				{
					timeZone: userInfo.tz,
					hour: '2-digit',
					minute: '2-digit'
				});
			return month + ' ' + date + ' ' + year + ' ' + time;
		},
		if_eq: function (a, b, opts) {
			if (a == b) {
				return opts.fn(this);
			} else {
				return opts.inverse(this);
			}
		},
		select: function (value, options) {
			return options.fn(this)
				.replace(new RegExp(' value=\"' + value + '\"'), '$& selected="selected"')
				.replace(new RegExp('>' + value + '</option>'), ' selected="selected"$&');
		}

	}
}));

const logEvent = (body, req) => {
	if (!!req.sessionID) {
		body.sessionID = req.sessionID;
	}
	let ipInfo = null;
	if ('ipInfo' in req && !('error' in req.ipInfo)) {
		ipInfo = modIpInfo(req.ipInfo);
	}
	if (!!req.session && !!req.session.user) {
		body.email = req.session.user.email;
	}

	if ('uid' in body && body.type === 'Activity') {
		(async () => {
			const isActive = body.content.type === 'Active';
			const updateDoc = { $set: { isActive } }
			const newUser = await DB.collection('users').findOneAndUpdate({ uid: body.uid }, updateDoc,
				{ returnOriginal: false }).then((user) => {
					return Promise.resolve(user.value);
				});
			// req.session.user = newUser;
		})();

	}
	if ('session' in req && 'user' in req.session && 'uid' in req.session.user && !!ipInfo) {
		(async () => {

			const updateDoc = {
				$addToSet: { ipInfo },
				$set: ipInfo
			}
			const newUser = await DB.collection('users').findOneAndUpdate({ uid: req.session.user.uid }, updateDoc,
				{ returnOriginal: false }).then((user) => {
					return Promise.resolve(user.value);
				});
			// req.session.user = newUser;
		})();

	}
	return DB.collection('logging').insertOne(body);
}

const modIpInfo = (ipInfo) => {
	try {
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
	catch (e) {
		return null;
	}
}

// app.engine('handlebars', exphbs({ helpers: { json: function (context) { return JSON.stringify(context); } } }));
app.post('/log', async (req, res) => {
	const { body } = req;
	try {
		assert('type' in body, `'type' must be present in body`);
		assert('time' in body, `'time' must be present in body`);
		assert('timestamp' in body, `'timestamp' must be present in body`);
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
							// await DB.collection('users').find({ major: { $exists: true } }).toArray()
							await DB.collection('users').find({ uid: result.team.id + '_' + result.user.id }).toArray()
								.then(async (users_docs, err) => {
									console.log(`the user is read from MongoDB: ${util.inspect(users_docs[0], { depth: 2 })}`);
									if (err) console.error(err);
									req.session.user = await users_docs[0];
									req.session.team = await docs[0];
									const timeStamp = new Date();
									const time = timeStamp.toString();
									const action = 'login';
									const type = `User ${action}`;
									const content = type;
									const path = '/api/oauth';
									const log = {
										type,
										time,
										timeStamp,
										content,
										path
									};
									logEvent(log, req);
									res.redirect('/');
								});
							snapshot_db['users'] = await DB.collection('users').find({}).toArray();
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
						console.log(`team id is ${result.team_id}, and Initiating ALL`);
						await InitTeamMembers(result.team_id, result.access_token, null);
						await InitTeamChannels(result.team_id, result.access_token, null);
						await UpdateChannelRecentMsgs(null, 'general', result.access_token, 200);
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
		await InitTeamChannels('T0A286J8K', process.env.SLACK_OAUTH_ACCESS_TOKEN, null);
	})();
	(async () => {
		await UpdateChannelRecentMsgs(null, 'general', process.env.SLACK_OAUTH_ACCESS_TOKEN, 200); //cid example:"T0A286J8K_C0A28BAHG"		
	})();
	console.log('---------------test----------------');
});

app.get('/initmembers', async (req, res) => {
	await InitTeamMembers('T0A286J8K', process.env.SLACK_OAUTH_ACCESS_TOKEN, 200);
	console.log('---------------initTeamMembers----------------');
	res.send('updated member list');
});

app.get('/initchannels', async (req, res) => {
	await InitTeamChannels('T0A286J8K', process.env.SLACK_OAUTH_ACCESS_TOKEN, null);
	console.log('---------------initTeamChannels----------------');
	res.send('updated channels list');
});

app.get('/initmsgs', async (req, res) => {

	await UpdateChannelRecentMsgs(null, 'general', process.env.SLACK_OAUTH_ACCESS_TOKEN, 200); //cid example:"T0A286J8K_C0A28BAHG"		
	console.log('---------------initMsgs----------------');
	res.send('updated msgs list');
});

app.get('/refresh', async (req, res) => {
	let sub_c = req.session.user.channels;
	let promiseArray = [];
	await sub_c.forEach((c) => {
		let promise = UpdateChannelRecentMsgs(c.cid, c.cname, process.env.SLACK_OAUTH_ACCESS_TOKEN, 200)
		promiseArray.push(promise);
		return Promise.resolve(promise);
		// return promise;
	});
	console.log('---------------refresh msgs clicked----------------');
	await Promise.all(promiseArray).then(result => {
		console.log(`promiseArray cleared`);
		res.json({ success: true });
	})
});

app.get('/sendconsentform', async (req, res) => {
	let users = await DB.collection('users').find(
		{
			$or: [
				{ consent: null },
				{ consent: 'decline' }
			]
		}
	).toArray().then((results) => {
		results.forEach(user => {
			let message = {
				channel: 'CFCP010FR',
				user: user.uid.split('_')[1],
				link_names: true,
				text: 'Consent form of Participating WeAre! Research Project',
				as_user: false,
				attachments: JSON.stringify([
					{
						title: 'Procedure',
						text: 'We invite you to participate in a research study that takes place this spring semester. Our research goal is to explore and assess ways to build a sense of community among World Campus students. Participants must be over the age of 18 to participate, and not stay or live in European Economic Area to participate. As a participant in the research project, you will be asked to use Slack and answer two questionnaires before and after usingt Slack (Each survey should 10 minutes to complete). As a compensation for your participation in the survey, we will draw 15 names in the first survey participants for a $30 Amazon Gift Card, and for those who answered both we will draw additional 15 names for a $50 Amazon Gift Card. During your use of Slack tool and visualization dashboard, we will collect your usage data (e.g. interactive moves in the dashboard, log-in time), but these data will always remain confidential and stored anonymously for data analysis. Only researchers of this project in the Human-Centered Lab of Penn State will have access to the data. No third party or university authorities will have access to the data.',
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

			web.chat.postEphemeral(message)
				.catch(err => {
					console.log(`error with posting ephmeral`);
					console.error(err);
				});
		})
	});


	console.log('---------------Consent Form sent to Not Reacted fellows ----------------');
	res.send('happy consent form sent out');
});

app.post('/slack/events', (req, res, next) => {
	console.log(`an example event is ${util.inspect(req.body)}`);
	switch (req.body.type) {
		case 'url_verification': {
			const challenge = req.body.challenge;
			res.send(challenge);
			console.log(`challenge is ${challenge}`);
			break;
		}
		case 'event_callback': {
			// Verify the signing secret
			// if (signature.isVerified(req)) {
			const event = req.body.event;
			if (event.is_bot) break;
			console.log(`within event callback: ${event}`);
			(async () => {
				var userID = null, teamID = null;
				if (event.type == 'team_join') {
					userID = event.user.id;
					teamID = event.user.team_id;
				}
				else {
					userID = event.user;
					teamID = event.team;
				}
				// `team_join` is fired whenever a new user (incl. a bot) joins the team, but the sequence of member_joined_channel and team_join for new member is undecided
				const exist_length = await DB.collection('users').find({ uid: teamID + '_' + userID }, { uid: 1 }).limit(1).toArray();
				console.log(`teamID is ${teamID} and userID is ${userID}`);
				console.log(`user length is ${util.inspect(exist_length, { depth: 2 })}`);
				if (exist_length.length == 0 && (event.type == 'member_joined_channel' || event.type == 'team_join')) {

					await web.users.info({ user: userID, include_locale: true })
						.then(async result => {
							console.log(`calling web.users.info the result is ${result}`);
							let userInfo = result.user;
							if (!userInfo.is_bot) {
								console.log(`Updating Locale etc for ${userInfo.profile.real_name}`);
								await DB.collection('users').updateOne(
									{ uid: teamID + '_' + userID },
									{
										$set: {
											team_id: teamID,
											name: userInfo.name,
											email: userInfo.profile.email,
											real_name: userInfo.real_name,
											tz: userInfo.tz,
											tz_label: userInfo.tz_label,
											local_area: userInfo.tz ? userInfo.tz.match(/([a-zA-Z]+)\//)[1] : 'unknown',
											tz_offset: userInfo.tz_offset / (60 * 60),
											title: userInfo.profile.title,
											phone: userInfo.profile.phone,
											status_text: userInfo.profile.status_text,
											status_emoji: userInfo.profile.status_emoji,
											status_expiration: userInfo.profile.status_expiration,
											first_name: userInfo.profile.first_name ? userInfo.profile.first_name : userInfo.profile.real_name.split(' ')[0],
											last_name: userInfo.profile.last_name,
											image_48: userInfo.profile.image_48,
											image_512: userInfo.profile.image_512,
											is_custom_image: userInfo.profile.is_custom_image,
											is_bot: userInfo.is_bot,
											last_updated: userInfo.updated,
											locale: userInfo.locale,
											// channels: user_channels,
											join_ts: new Date()
										}
									},
									{ upsert: true })
									.then(async () => {
										console.log('user updated succesfully');
										const uid = teamID + '_' + userID;
										const email = userInfo.profile.email;
										const fullName = userInfo.profile.real_name;

										console.log('user updated with LDAP succesfully');
										const join_channel = event.type == 'member_joined_channel' ? await fn_first_join() : true;

										// const obj_whatever = await similarity.storeSimilarUsers([uid]);
										const res = await DB.collection('users').find({}, { uid: 1 });
										const array = await res.toArray();
										const uids = array.map(user => user.uid).filter(uid => !!uid);
										// uids.forEach(uid => similarity.storeSimilarUsers(uid));
										similarity.storeSimilarUsers(uids);
										await ldap.updateUserWithLdapData(email, fullName, uid, DB);
										async function fn_first_join() {
											if (event.channel != 'C0A28BAHG') return;
											console.log(`First time joining channel is ${util.inspect(event, { depth: null })}`);

											const { user, channel, team, event_ts } = event;

											//It could be all the default join channels because it is not clear which one is going to be the first
											const message = {
												channel: channel,
												user: user,
												link_names: true,
												text: 'Consent form of Participating WeAre! Research Project',
												as_user: false,
												attachments: JSON.stringify([
													{
														title: 'Procedure',
														text: 'We invite you to participate in a research study that takes place this spring semester. Our research goal is to explore and assess ways to build a sense of community among World Campus students. Participants must be over the age of 18 to participate, and not stay or live in European Economic Area to participate. As a participant in the research project, you will be asked to use Slack and answer two questionnaires before and after usingt Slack (Each survey should 10 minutes to complete). As a compensation for your participation in the survey, we will draw 15 names in the first survey participants for a $30 Amazon Gift Card, and for those who answered both we will draw additional 15 names for a $50 Amazon Gift Card. During your use of Slack tool and visualization dashboard, we will collect your usage data (e.g. interactive moves in the dashboard, log-in time), but these data will always remain confidential and stored anonymously for data analysis. Only researchers of this project in the Human-Centered Lab of Penn State will have access to the data. No third party or university authorities will have access to the data.',
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
											setTimeout(function () {
												web.chat.postEphemeral(message)
													.catch(err => {
														console.log(`error with posting ephmeral`);
														console.error(err);
													});
											}, 7000);


											console.log(`finding the user is ${util.inspect(userInfo, { depth: null })}`);

											const updateChannel = await DB.collection('channels').findOneAndUpdate(
												{ cid: team + '_' + channel },
												{
													$push: {
														cmembers: {
															real_name: userInfo.real_name,
															first_name: userInfo.first_name,
															last_name: userInfo.last_name,
															uid: userInfo.uid,
															email: userInfo.email
														}
													},
													$inc: {
														num_members: 1
													}
												},
												{ upsert: true, returnOriginal: false }).then((updatedChannel) => {
													DB.collection('users').updateOne(
														{ uid: team + '_' + user },
														{
															$push: {
																channels: {
																	cid: updatedChannel.value.cid,
																	cname: updatedChannel.value.cname
																}
															}
														},
														{ upsert: true },
														function (err, doc) {
															if (err) console.error(err);
															else console.log('pushed channel to the user after the joining event');
														});
												});
											const userlog_update = await DB.collection('userlogs').updateOne({ log_id: makeid() }, {
												$set: {
													uid: team + '_' + user,
													email: userInfo.email,
													real_name: userInfo.real_name,
													first_name: userInfo.first_name,
													last_name: userInfo.last_name,
													action: `join the channel`,
													channel: team + '_' + channel,
													ts: new Date()
												},
											}, { upsert: true }, function (err, res) {
												if (err) console.error(err);
												else console.log(`the user ${util.inspect(userInfo.real_name)} join the channel ${channel} `);
											});
											return Promise.resolve({
												user_log: userlog_update,
												channel_update: updateChannel
											});
										}
										return Promise.resolve({
											join_channel: join_channel,
											// obj_whatever: obj
										});
									})
									.catch(err => {
										console.log(`error duing the inserting new user from Team_JOIN`);
										console.error(err);
									});
							}
						});
					res.sendStatus(200);
				}
				else switch (event.type) {
					case 'member_joined_channel':
						if (!event.is_bot) {
							console.log(`ELSE SWITCH body event ${util.inspect(event.user, { depth: null })}`);

							const { user, channel, team, event_ts } = event;

							if (channel == "C0A28BAHG") { //C0A34HJVA
								// onboard.initialMessage(user, channel);
								const message = {
									channel: channel,
									user: user,
									link_names: true,
									text: 'Consent form of Participating WeAre! Research Project',
									as_user: false,
									attachments: JSON.stringify([
										{
											title: 'Procedure',
											text: 'We invite you to participate in a research study that takes place this spring semester. Our research goal is to explore and assess ways to build a sense of community among World Campus students. Participants must be over the age of 18 to participate, and not stay or live in European Economic Area to participate. As a participant in the research project, you will be asked to use Slack and answer two questionnaires before and after usingt Slack (Each survey should 10 minutes to complete). As a compensation for your participation in the survey, we will draw 15 names in the first survey participants for a $30 Amazon Gift Card, and for those who answered both we will draw additional 15 names for a $50 Amazon Gift Card. During your use of Slack tool and visualization dashboard, we will collect your usage data (e.g. interactive moves in the dashboard, log-in time), but these data will always remain confidential and stored anonymously for data analysis. Only researchers of this project in the Human-Centered Lab of Penn State will have access to the data. No third party or university authorities will have access to the data.',
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
								setTimeout(function () {
									// onboard.initialMessage(user, channel);
									web.chat.postEphemeral(message)
										.catch(err => {
											console.log(`error with posting ephmeral`);
											console.error(err);
										});
								}, 7000);


							}
							DB.collection('users').findOne({ uid: team + '_' + user }, function (err, user_doc) {
								console.log(`finding the user is ${util.inspect(user_doc, { depth: null })}`);
								console.log(`error is ${util.inspect(err, { depth: null })}`);
								if (err) console.error(err);
								else if (user_doc) {
									// console.log(`the retrieved docs is ${util.inspect(docs, { depth: null })}`)
									DB.collection('channels').findOneAndUpdate(
										{ cid: team + '_' + channel },
										{
											$push: {
												cmembers: {
													real_name: user_doc.real_name,
													first_name: user_doc.first_name,
													last_name: user_doc.last_name,
													uid: user_doc.uid,
													email: user_doc.email
												}
											},
											$inc: {
												num_members: 1
											}
										},
										{ upsert: true, returnOriginal: false },
										function (err, updatedChannel) {
											if (err) console.error(err);
											else {
												DB.collection('users').updateOne(
													{ uid: team + '_' + user },
													{
														$push: {
															channels: {
																cid: updatedChannel.value.cid,
																cname: updatedChannel.value.cname
															}
														}
													},
													{ upsert: true },
													async function (err, doc) {
														if (err) console.error(err);
														else console.log('pushed channel to the user after the joining event');
														const res = await DB.collection('users').find({}, { uid: 1 });
														const array = await res.toArray();
														const uids = array.map(user => user.uid).filter(uid => !!uid);
														// uids.forEach(uid => similarity.storeSimilarUsers(uid));
														similarity.storeSimilarUsers(uids);
														console.log(`after the uids ${uids}`);
													});
											}
										});

									DB.collection('userlogs').updateOne({ log_id: makeid() }, {
										$set: {
											uid: team + '_' + user,
											email: user_doc.email,
											real_name: user_doc.real_name,
											first_name: user_doc.first_name,
											last_name: user_doc.last_name,
											action: `join the channel`,
											channel: team + '_' + channel,
											ts: new Date()
										},
									}, { upsert: true }, function (err, res) {
										if (err) console.error(err);
										else console.log(`the user ${util.inspect(user_doc.first_name)} join the channel ${channel} `);
									});

								}
							});

						}
						res.sendStatus(200);
						break;
					case 'member_left_channel':
						if (!event.is_bot) {
							const { user, channel, team } = event;
							console.log(`the event body is ${util.inspect(event, { depth: null })}`);
							DB.collection('users').findOne({ uid: team + '_' + user }, function (err, tobeDEL) {
								if (err) console.error(err);
								else {
									if (tobeDEL.channels.length == 1) { //this will be the last channel that the user is leaving, meaning that he/she is being deactivating
										DB.collection('users_deactivated').updateOne({ uid: team + '_' + user }, {
											$set: {
												email: tobeDEL.email,
												real_name: tobeDEL.real_name,
												first_name: tobeDEL.first_name,
												last_name: tobeDEL.last_name
											},
										}, { upsert: true }, function (err, res) {
											if (err) console.error(err);
											else console.log(`the deleted user is ${util.inspect(tobeDEL)}`);
										})
									}
									DB.collection('userlogs').updateOne({ log_id: makeid() }, {
										$set: {
											uid: team + '_' + user,
											email: tobeDEL.email,
											real_name: tobeDEL.real_name,
											first_name: tobeDEL.first_name,
											last_name: tobeDEL.last_name,
											action: `leave the channel`,
											channel: team + '_' + channel,
											ts: new Date()
										},
									}, { upsert: true }, function (err, res) {
										if (err) console.error(err);
										else console.log(`the user ${util.inspect(tobeDEL.first_name)} left the channel ${channel} `);
									});
								}
							});

							DB.collection('users').findOneAndUpdate({ uid: team + '_' + user },
								{
									$pull: {
										channels: {
											cid: team + '_' + channel
										}
									}
								},
								{
									upsert: true,
									returnOriginal: false
								},
								function (err, updatedUser) {
									console.log(`within call back, updatedUser is: ${util.inspect(updatedUser.value)}`);
									console.log(`within call back: ${util.inspect(err)}`);
									if (err) console.error(err);
									else {
										console.log(`removed channel ${channel} successfully: ${updatedUser.value.first_name}`);
									}
								});

							DB.collection('channels').findOneAndUpdate({ cid: team + '_' + channel },
								{
									$pull: {
										cmembers: {
											uid: team + '_' + user
										}
									}
								},
								{
									upsert: false,
									returnOriginal: false
								},
								function (err, updatedC) {
									console.log(`within call back, updatedChannel is: ${util.inspect(updatedC.value)}`);
									console.log(`within call back: ${util.inspect(err)}`);
									if (err) console.error(err);
									else {
										console.log(`removed channel ${channel} successfully: ${updatedC.value.first_name}`);
									}
								});

						}
						res.sendStatus(200);
						break;
					case 'team_join':
						console.log('team_join event happening');
						// if (!event.is_bot) {
						// 	// console.log(`the event body is ${util.inspect(event, { depth: null })}`);
						// 	const { user } = event;
						// 	console.log(`the user just joined the team is ${util.inspect(user, { depth: null })}`);

						// 	web.users.info({ user: user.id, include_locale: true })
						// 		.then(result => {
						// 			let userInfo = result.user;
						// 			if (!userInfo.is_bot) {
						// 				console.log(`Updating Locale etc for ${userInfo.profile.real_name}`);
						// 				DB.collection('users').updateOne(
						// 					{ uid: user.team_id + '_' + user.id },
						// 					{
						// 						$set: {
						// 							team_id: user.team_id,
						// 							name: userInfo.name,
						// 							email: userInfo.profile.email,
						// 							real_name: userInfo.real_name,
						// 							tz: userInfo.tz,
						// 							tz_label: userInfo.tz_label,
						// 							local_area: userInfo.tz ? user.tz.match(/([a-zA-Z]+)\//)[1] : 'unknown',
						// 							tz_offset: userInfo.tz_offset / (60 * 60),
						// 							title: userInfo.profile.title,
						// 							phone: userInfo.profile.phone,
						// 							status_text: userInfo.profile.status_text,
						// 							status_emoji: userInfo.profile.status_emoji,
						// 							status_expiration: userInfo.profile.status_expiration,
						// 							first_name: userInfo.profile.first_name ? userInfo.profile.first_name : userInfo.profile.real_name.split(' ')[0],
						// 							last_name: userInfo.profile.last_name,
						// 							image_48: userInfo.profile.image_48,
						// 							image_512: userInfo.profile.image_512,
						// 							is_custom_image: userInfo.profile.is_custom_image,
						// 							is_bot: userInfo.is_bot,
						// 							last_updated: userInfo.updated,
						// 							locale: userInfo.locale,
						// 							// channels: user_channels,
						// 							join_ts: new Date()
						// 						}
						// 					},
						// 					{ upsert: true })
						// 					.then(async () => {
						// 						console.log('user updated succesfully');
						// 						const uid = user.team_id + '_' + user.id;
						// 						const email = user.profile.email;
						// 						const fullName = user.profile.real_name;
						// 						await ldap.updateUserWithLdapData(email, fullName, user.team_id + '_' + user.id, DB);
						// 						await similarity.storeSimilarUsers(user.team_id + '_' + user.id);
						// 						console.log('user updated with LDAP succesfully');

						// 					})
						// 					.catch(err => {
						// 						console.log(`error duing the inserting new user from Team_JOIN`);
						// 						console.error(err);
						// 					});
						// 			}
						// 		});
						// }
						res.sendStatus(200);
						break;
					case 'channel_created':
						break;
					case 'channel_deleted':
						break;
					case 'channel_rename':
						break;
					case 'channel_archive':
						break;
					case 'message':
						if (event.parent_user_id) {
							(async () => {
								let msg_creator = await DB.collection('users').find({ uid: req.body.team_id + '_' + event.user },
									{
										real_name: 1,
										image_48: 1
									}).limit(1).toArray();
								let channel = await DB.collection('channels').find({ cid: req.body.team_id + '_' + event.channel },
									{
										cname: 1,
									}).limit(1).toArray();
								let msg_obj = {
									uid: event.user,
									username: msg_creator[0].real_name,
									user_avatar: msg_creator[0].image_48,
									cid: req.body.team_id + '_' + event.channel,
									cname: channel[0].cname,
									text: event.text,
									ts: event.ts,
									thread_ts: event.thread_ts,
									parent_user_id: event.parent_user_id
								}
								DB.collection('msgs').updateOne(
									{ mid: event.client_msg_id },
									{
										$set: msg_obj
									},
									{ upsert: true },
									function (err, res) {
										if (err) console.error(err);
										else console.log('msg updated!');
									});
							})();
						}
						else {
							web_slack.conversations.history({ // pay attention the user token (for reading history from channel/groups) but the bot is used to write
								channel: event.channel, //#test-bot (left) #learning-tech C0A34HJVA
								limit: 1,
								// cursor: cursor
							}).then(async res => {
								console.log(`the latest conversation message is ${util.inspect(res, { depth: null })}`);
								const LatestMsg = res.messages[0];
								const user = await DB.collection('users').findOne({ uid: req.body.team_id + '_' + LatestMsg.user });
								const channel = await DB.collection('channels').findOne({ cid: req.body.team_id + '_' + event.channel });
								// console.log(`the user ${req.body.team_id} + '_' + ${LatestMsg.user} constructing it is ${util.inspect(user, { depth: null })}`);
								// console.log(`the channel ${req.body.team_id} + '_' + ${event.channel} constructing it is ${util.inspect(channel, { depth: 2 })}`);
								if (LatestMsg.type == 'message' && !LatestMsg.bot_id && !LatestMsg.subtype) { // only look at the plain text msgs from real users
									const msg_obj = {
										uid: LatestMsg.user,
										username: user.real_name,
										user_avatar: user.image_48,
										cid: req.body.team_id + '_' + event.channel,
										cname: channel.cname,
										text: LatestMsg.text,
										ts: LatestMsg.ts,
										thread_ts: LatestMsg.thread_ts,
										is_starred: LatestMsg.is_starred,
										reactions: LatestMsg.reactions
									}
									DB.collection('msgs').updateOne(
										{ mid: LatestMsg.client_msg_id },
										{
											$set: msg_obj
										},
										{ upsert: true },
										function (err, res) {
											if (err) console.error(err);
											else console.log('msg updated!');
										});
									DB.collection('channels').updateOne(
										{ cid: req.body.team_id + '_' + event.channel },
										{
											$inc: {
												num_msgs: 1
											},
											$set: {
												latest_msg_ts: LatestMsg.ts
											}
										},
										{ upsert: true },
										function (err, res) {
											if (err) console.error(err);
											else console.log('channel num_msgs updated!');
										});
								}
							})
								.catch(err => console.error(err));
						}

						res.sendStatus(200);
						break;

					case 'message_changed':
						break;
					case 'reaction_added':
						DB.collection('interactions').updateOne(
							{ iid: makeid() },
							{
								$set: {
									from: req.body.team_id + '_' + event.user,
									content: event.type,
									to: req.body.team_id + '_' + event.item_user,
									reaction: event.reaction,
									item: event.item,
									ts: event.event_ts
								}
							},
							{ upsert: true },
							function (err, doc) {
								if (err) console.error(err);
								else console.log('reaction added!');
							});
						res.sendStatus(200);
						break;
					case 'reaction_removed':
						DB.collection('interactions').updateOne(
							{ iid: makeid() },
							{
								$set: {
									from: req.body.team_id + '_' + event.user,
									content: event.type,
									to: req.body.team_id + '_' + event.item_user,
									reaction: event.reaction,
									item: event.item,
									ts: event.event_ts
								}
							},
							{ upsert: true },
							function (err, doc) {
								if (err) console.error(err);
								else console.log('reaction removed!');
							});
						res.sendStatus(200);
						break;
					case 'user_change':
						//event - event.user
						res.sendStatus(200);
						break;
					default:
						console.log(`unknown event type`);
				}
			})();

		}

			break;
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
		],

	}

	sendMessageToSlackResponseURL(responseURL, message);

});

app.post('/slack/commands/WhoIsOnline', urlencodedParser, (req, res) => {
	res.status(200).end();
	console.log(`the req body in WhoIsOnline Command includes + ${util.inspect(req.body, { depth: null })}`);
	OnlineNow(req.body.channel_id, req.body.user_id, req.body.response_url);
});

app.post('/slack/commands/intro', urlencodedParser, (req, res) => {

	res.status(200).end(); // best practice to respond with empty 200 status code
	var reqBody = req.body;
	console.log(`within intro: reqbody is ${util.inspect(reqBody, { depth: null })}`);
	// var msg = {
	// 	title: 'I am, We Are!',
	// 	callback_id: 'self_intro',
	// 	submit_label: 'Done',
	// 	elements: [
	// 		{
	// 			label: 'Fun fact',
	// 			type: 'text',
	// 			name: 'fun',
	// 			text: 'existing content blah blah',
	// 			hint: 'Tell them something fun!'
	// 		},
	// 		{
	// 			label: 'I live in',
	// 			type: 'text',
	// 			name: 'city',
	// 			optional: true,
	// 			hint: 'Separate places with ";"! (e.g. Pittsburgh, PA; Victoria, BC'
	// 		},
	// 		{
	// 			label: 'Current profession',
	// 			type: 'select',
	// 			name: 'topic',
	// 			options: [
	// 				{ label: 'Veteran/military', value: 'military' },
	// 				{ label: 'Industry sector', value: 'industry' },
	// 				{ label: 'Education sector', value: 'education' },
	// 				{ label: 'No job yet', value: 'unemployed' }
	// 			],
	// 		},
	// 		{
	// 			label: 'Things I want my peers here to know about me',
	// 			type: 'text',
	// 			name: 'unique',
	// 			optional: true,
	// 			hint: 'e.g. interests, language, value systems, hobbies, minority roles'
	// 		}
	// 	],
	// };
	// console.log('before dialog web method');
	// console.log(util.inspect(msg, { depth: 3 }));
	// web.dialog.open({
	// 	trigger_id: reqBody.trigger_id,
	// 	dialog: msg
	// }).then(res => console.log(`successfully opened intro dialog`)).catch(err => { console.error(err); console.log(util.inspect(err, { depth: 3 })) });


	DB.collection('users').findOne({ uid: reqBody.team_id + '_' + reqBody.user_id }, async (err, user) => {
		const msg2 = {
			title: 'I am, We Are!',
			callback_id: 'self_intro',
			submit_label: 'Done',
			elements: [
				{
					label: 'Things I want my peers here to know about me',
					type: 'text',
					name: 'title',
					value: user.title ? he.unescape(user.title) : null,
					hint: 'e.g. language, value systems, hobbies, minority roles, ethnicity'
				},

				{
					label: 'I have lived in',
					type: 'text',
					name: 'pastCities',
					optional: true,
					value: user.pastCities ? he.unescape(user.pastCities) : null,
					hint: 'Separate places with ";"! (e.g. Pittsburgh, PA; Victoria, BC)'
				},
				{
					label: 'Current profession',
					type: 'select',
					name: 'profession',
					options: [
						{ label: 'Architecture and Engineering', value: '17' },
						{ label: 'Arts, Design, Entertainment, Sports, and Media', value: '27' },
						{ label: 'Building and Grounds Cleaning and Maintenance', value: '37' },
						{ label: 'Business and Financial Operations', value: '13' },
						{ label: 'Community and Social Service', value: '21' },
						{ label: 'Computer and Mathematical', value: '15' },
						{ label: 'Construction and Extraction', value: '47' },
						{ label: 'Education, Training, and Library', value: '25' },
						{ label: 'Farming, Fishing, and Forestry', value: '45' },
						{ label: 'Food Preparation and Serving Related', value: '35' },
						{ label: 'Healthcare Practitioners and Technical', value: '29' },
						{ label: 'Healthcare Support', value: '31' },
						{ label: 'Installation, Maintenance, and Repair', value: '49' },
						{ label: 'Legal', value: '23' },
						{ label: 'Life, Physical, and Social Science', value: '19' },
						{ label: 'Management', value: '11' },
						{ label: 'Miltary Specific', value: '55' },
						{ label: 'Office and Administrative Support', value: '43' },
						{ label: 'Personal Care and Service', value: '39' },
						{ label: 'Production', value: '51' },
						{ label: 'Protective Service', value: '33' },
						{ label: 'Sales and Related', value: '41' },
						{ label: 'Transportation and Material Moving', value: '53' },
						{ label: 'Other', value: '0' },
					],
					value: 0
				},
				{
					label: 'Fun fact',
					type: 'text',
					name: 'fun',
					value: user.fun ? he.unescape(user.fun) : null,
					optional: true,
					hint: 'Tell them something fun!'
				}
			],
		};
		console.log('before dialog web method');
		console.log(util.inspect(msg2, { depth: 3 }));
		web.dialog.open({
			trigger_id: reqBody.trigger_id,
			dialog: msg2
		}).then(result => console.log(`successfully opened intro dialog`)).catch(err => { console.error(err); console.log(util.inspect(err, { depth: 3 })) });
	});

});

app.post('/slack/actions', urlencodedParser, (req, res) => {
	var body = JSON.parse(req.body.payload); // parse URL-encoded payload JSON string
	const { type, token, trigger_id } = body;
	console.log(`the req body includes + ${util.inspect(req.body, { depth: null })}`);

	if (type == 'interactive_message') {
		console.log(`trigger id is ${trigger_id}`);
		switch (body.actions[0].value) {
			case 'accept':
				console.log('accepted term from new channel member!');
				const msg_postAccept = {
					as_user: false,
					replace_original: true,
					channel: body.channel.id,
					user: body.user.id,
					text: `Thanks for participating our research project We Are! an online community for World Campus students. Remember to introduce yourself :point_down:`,
				};
				sendMessageToSlackResponseURL(body.response_url, msg_postAccept);
				web.chat.postEphemeral({
					as_user: false,
					channel: body.channel.id,
					user: body.user.id,
					// text: `Thanks for participating our research project We Are! an online community for World Campus students. Remember to introduce yourself :point_down:`,
					attachments: JSON.stringify([
						{
							title: 'Welcome to the World Campus Students Community! We Are!',
							text: 'Penn State is where learning gains and your career takes off. If this is your first time using Slack, take some time to read the help docs at get.slack.help and our internal <https://weconnect.ist.psu.edu:8443/help|wiki>. If you have any questions, jump into <#CGNQYDKKJ|help-slack> and we\'ll help you out.',
							callback_id: 'consent',
							color: '#74c8ed',
							actions: [{
								name: 'introduce',
								text: 'Introduce myself',
								type: 'button',
								value: 'intro',
								style: 'primary'
							}
							],
						},
						{
							title: 'Visit our dashboard <https://weconnect.ist.psu.edu:8443|WeConnect> to explore your community!',
							callback_id: 'advertise_url',
							color: '#FBBD08',
						}
					]
					)
				}).catch(err => console.error(err));
				DB.collection('users').updateOne(
					{ uid: body.team.id + '_' + body.user.id },
					{
						$set: {
							consent: 'accept'
						}
					},
					{ upsert: true },
					function (err, doc) {
						if (err) console.error(err);
						else console.log('User accepted to consent their participation');
					});
				break;

			case 'decline':
				web.chat.postEphemeral({
					as_user: false,
					channel: body.channel.id,
					user: body.user.id,
					text: `Oops! It looks like you are not sure to participate in our research activities.`,
					attachments: JSON.stringify([
						{
							title: `Not sure about the potential gains and risks of using the Slack service of WeAre! and <${base_url}|community space>?`,
							text: 'Email nzs162@psu.edu for concerns and questions you have about the study. If you have any technical questions, jump into #help-slack and we\'ll help you out. \n :exclamation: Note that if you do not concent :point_down:, you will not be able to use our services in WeAre! and WeConnect tools.',
							callback_id: 'consent',
							color: '#74c8ed',
							actions: [{
								name: 'accept',
								text: 'Accept now',
								type: 'button',
								value: 'accept',
								style: 'primary'
							},
							{
								name: 'later',
								text: 'Decline and leave the space',
								type: 'button',
								value: 'leave-weare',
								style: 'default'
							}
							],
						},]
					)
				}).catch(err => console.error(err));
				DB.collection('users').updateOne(
					{ uid: body.team.id + '_' + body.user.id },
					{
						$set: {
							consent: 'decline'
						}
					},
					{ upsert: true },
					function (err, doc) {
						if (err) console.error(err);
						else console.log('User declined to participate in research');
					});
				break;
			case 'leave-weare':
				web.chat.postEphemeral({
					as_user: false,
					channel: body.channel.id,
					user: body.user.id,
					text: `Sorry that you decided to leave here. We hope you have a wonderful journey as a World Campus student. Bye!`,
				}).catch(err => console.error(err));
				setTimeout(function () {
					DB.collection('users').updateOne(
						{ uid: body.team.id + '_' + body.user.id },
						{
							$set: {
								consent: 'leave'
							}
						},
						{ upsert: true },
						function (err, doc) {
							if (err) console.error(err);
							else console.log('User decided to leave weare');
						});
					DB.collection('userlogs').updateOne({ log_id: makeid() }, {
						$set: {
							uid: body.team.id + '_' + body.user.id,
							action: `leave the team- faild to consent`,
							ts: new Date()
						},
					}, { upsert: true }, function (err, res) {
						if (err) console.error(err);
						else console.log(`the user ${util.inspect(tobeDEL.first_name)} left the channel ${channel} `);
					});
				}, 5000);
				break;
			case 'weare-welcome':
				DB.collection('interactions').updateOne(
					{ iid: makeid() },
					{
						$set: {
							from: body.team.id + '_' + body.user.id,
							content: 'weare-welcome',
							to: body.callback_id,
							channel: body.team.id + '_' + body.channel.id,
							ts: new Date()
						}
					},
					{ upsert: true },
					function (err, doc) {
						if (err) console.error(err);
						else console.log('Welcome weAre!');
					});
				console.log(`the user ${body.user.id} reacting to ${body.callback_id.split('_')[1]} weare in the channel ${body.channel.id} `);
				web.chat.postMessage({
					as_user: false,
					channel: body.channel.id,
					user: body.callback_id.split('_')[1],
					thread_ts: body.original_message.ts,
					text: `<@${body.user.id}> said :weare::psu_avatar: to <@${body.callback_id.split('_')[1]}>!`,
				}).catch(err => console.error(err));
				break;
			case 'heart':
				DB.collection('interactions').updateOne(
					{ iid: makeid() },
					{
						$set: {
							from: body.team.id + '_' + body.user.id,
							content: 'heart',
							to: body.callback_id,
							channel: body.team.id + '_' + body.channel.id,
							ts: new Date()
						}
					},
					{ upsert: true },
					function (err, doc) {
						if (err) console.error(err);
						else console.log('Welcome heart!');
					});
				console.log(`the user ${body.user.id} reacting to ${body.callback_id.split('_')[1]} heart in the channel ${body.channel.id} `);
				web.chat.postMessage({
					as_user: false,
					channel: body.channel.id,
					user: body.callback_id.split('_')[1],
					thread_ts: body.original_message.ts,
					text: `<@${body.callback_id.split('_')[1]}> got :blue_heart: from <@${body.user.id}>!`,
				}).catch(err => console.error(err));
				break;
			case 'dismiss-welcome':
				DB.collection('interactions').updateOne(
					{ iid: makeid() },
					{
						$set: {
							from: body.team.id + '_' + body.user.id,
							content: 'dismiss-welcome',
							to: body.callback_id,
							channel: body.team.id + '_' + body.channel.id,
							ts: new Date()
						}
					},
					{ upsert: true },
					function (err, doc) {
						if (err) console.error(err);
						else console.log('Dismiss welcome....../');
					});
				// sendMessageToSlackResponseURL(body.response_url, { text: `You dismissed the suggestion on welcoming <@${body.callback_id.split('_')[1]}>`, as_user: false, replace_original: true });
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
								// value: 'Blah blah is it there', //TODO: support command paramters later
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
									{ label: 'Specify individuals (in the dashboard)', value: 'custom' }, //TODO, custom
								],
							}
						],
						replace_original: true,
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
			case 'attend':
				// console.log(`yeah, I want to attend this meeting! Sure! the body is ${util.inspect(body, { depth: null })}`);
				// DB.collection('meetings').updateOne({mid: body.callback_id})
				(async () => {
					console.log(`the callback id for attend is ${body.callback_id}`);
					await DB.collection('meetings').findOne({ mid: body.callback_id }
						, async function (err, doc) {
							if (err) console.error(err);
							else {

								console.log(`meeting info is ${util.inspect(doc, { depth: null })}`);
								console.log(`the returned meeting info is ${doc.purpose}`)
								console.log(`body is ${util.inspect(body, { depth: 2 })}`);
								let newAttendees = doc.attendees.map(atd => {
									if (atd.uid == body.team.id + '_' + body.user.id) {
										atd.attend = 'accept';
										return atd;
									}
									else return atd;
								});
								console.log(`new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
								if (newAttendees.length) await DB.collection('meetings').updateOne({ mid: body.callback_id },
									{
										$set: {
											attendees: newAttendees
										}
									},
									{ upsert: true },
									function (err, res) {
										if (err) console.error(err);
										console.log(`Meeting information updated succesfully, new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
									});
								web.chat.postMessage({
									as_user: false,
									channel: body.channel.id,
									user: body.user.id,
									text: `You just confirmed your attendence to the meeting :point_up:.`,
									replace_original: false
								}).catch(err => console.error(err));

							}
						})

				})();
				break;
			case 'notattend':
				console.log(`No I am not attending this meeting! The body is ${util.inspect(body, { depth: null })}`);
				(async () => {
					const meeting_info = await DB.collection('meetings').findOne({ mid: body.callback_id }, async function (err, doc) {
						if (err) console.error(err);
						else {
							console.log(`meeting info is ${util.inspect(doc, { depth: null })}`);
							console.log(`the returned meeting info is ${doc.purpose}`)
							console.log(`body is ${util.inspect(body, { depth: 2 })}`);
							let newAttendees = doc.attendees.map(atd => {
								if (atd.uid == body.team.id + '_' + body.user.id) {
									atd.attend = 'reject';
									return atd;
								}
								else return atd;
							});
							console.log(`new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
							if (newAttendees.length) await DB.collection('meetings').updateOne({ mid: body.callback_id },
								{
									$set: {
										attendees: newAttendees
									}
								},
								{ upsert: true },
								function (err, res) {
									if (err) console.error(err);
									console.log(`Meeting information updated succesfully, new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
								});
							web.chat.postMessage({
								as_user: false,
								channel: body.channel.id,
								user: body.user.id,
								text: `You just decline your attendence to the meeting :point_up:.`,
								replace_original: false
							}).catch(err => console.error(err));
						}
					})
				})();
				break;
			case 'intro':
				DB.collection('users').findOne({ uid: body.team.id + '_' + body.user.id }, async (err, user) => {
					const msg2 = {
						title: 'I am, We Are!',
						callback_id: 'self_intro',
						submit_label: 'Done',
						elements: [
							{
								label: 'Things I want my peers here to know about me',
								type: 'text',
								name: 'title',
								value: user.title ? he.unescape(user.title) : null,
								hint: 'e.g. language, value systems, hobbies, minority roles, ethnicity'
							},

							{
								label: 'I have lived in',
								type: 'text',
								name: 'pastCities',
								optional: true,
								value: user.pastCities ? he.unescape(user.pastCities) : null,
								hint: 'Separate places with ";"! (e.g. Pittsburgh, PA; Victoria, BC)'
							},
							{
								label: 'Current profession',
								type: 'select',
								name: 'profession',
								options: [
									{ label: 'Architecture and Engineering', value: '17' },
									{ label: 'Arts, Design, Entertainment, Sports, and Media', value: '27' },
									{ label: 'Building and Grounds Cleaning and Maintenance', value: '37' },
									{ label: 'Business and Financial Operations', value: '13' },
									{ label: 'Community and Social Service', value: '21' },
									{ label: 'Computer and Mathematical', value: '15' },
									{ label: 'Construction and Extraction', value: '47' },
									{ label: 'Education, Training, and Library', value: '25' },
									{ label: 'Farming, Fishing, and Forestry', value: '45' },
									{ label: 'Food Preparation and Serving Related', value: '35' },
									{ label: 'Healthcare Practitioners and Technical', value: '29' },
									{ label: 'Healthcare Support', value: '31' },
									{ label: 'Installation, Maintenance, and Repair', value: '49' },
									{ label: 'Legal', value: '23' },
									{ label: 'Life, Physical, and Social Science', value: '19' },
									{ label: 'Management', value: '11' },
									{ label: 'Miltary Specific', value: '55' },
									{ label: 'Office and Administrative Support', value: '43' },
									{ label: 'Personal Care and Service', value: '39' },
									{ label: 'Production', value: '51' },
									{ label: 'Protective Service', value: '33' },
									{ label: 'Sales and Related', value: '41' },
									{ label: 'Transportation and Material Moving', value: '53' },
									{ label: 'Other', value: '0' },
								],
								value: 0
							},
							{
								label: 'Fun fact',
								type: 'text',
								name: 'fun',
								optional: true,
								value: user.fun ? he.unescape(user.fun) : null,
								hint: 'Tell your peers something interesting about yourself!'
							},
						],
					};
					console.log('before dialog web method');
					console.log(util.inspect(msg2, { depth: 3 }));
					web.dialog.open({
						trigger_id: trigger_id,
						dialog: msg2
					}).then(res => console.log(`successfully opened intro dialog`)).catch(err => { console.error(err); console.log(util.inspect(err, { depth: 3 })) });
				});
				break;
			case 'hello':
				console.log('now you are saying hello!');
				DB.collection('users').findOne({ uid: body.team.id + '_' + body.user.id }, async (err, user) => {
					const attach = [
						{
							"title": `Let's welcome <@${body.user.id}> who has been to ${user.pastCities}.`,
							"text": `Meet ${user.first_name} at <${base_url}/profile/${body.team.id}_${body.user.id}|profile page>.`,
							"color": '#FBBD08'
						},
						{
							"text": `Send ${user.first_name} some We Are! or some positive vibes! :fireworks: :tada: :wave: :clap:`,
							"fallback": "Shame... buttons aren't supported in this land",
							"callback_id": `${body.team.id}_${body.user.id}`,
							"color": "#3AA3E3",
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
									"text": ":blue_heart:",
									"type": "button",
									"value": "heart",
									"style": "danger"
								},
								{
									"name": "dismiss",
									"text": "Dismiss",
									"type": "button",
									"value": "dismiss-welcome",
									"style": "default"
								}
							]
						}
					];
					console.log(`interactive message - You confirmed to hello to the group!`);
					console.log(`The user has confirmed to say hello and receive welcome! ${body.channel.id}`)
					web.chat.postMessage({
						channel: body.channel.id,
						text: `I'd like to introduce *${user.real_name}*!`,
						attachments: JSON.stringify(attach)
					})
						.catch(err => console.error(err));
					console.log('now you finished hello and send the public message out');
				});

				break;
			case 'no-hello':
				let msg_tablelist = {
					as_user: false,
					replace_original: true,
					channel: body.channel.id,
					user: body.user.id,
					text: `More details in the profile will help your peers get to know you. \n - Enter /intro to initiate the prompt of self-intro, or go to ${base_url}/editprofile to edit yor profile. \n- Go to ${base_url}/tablelist to find more about your peers.`,
				};
				sendMessageToSlackResponseURL(body.response_url, msg_tablelist);
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
			case 'self_intro'://the action callback
				console.log(`Would you like to broadcast your join of the channel?! ${body.channel.id}`);

				(async () => {
					const newUser = await DB.collection('users').findOneAndUpdate(
						{ uid: body.team.id + '_' + body.user.id },
						{
							$set: {
								fun: submission.fun ? he.escape(submission.fun) : submission.fun,
								profession: submission.profession,
								title: submission.title ? he.escape(submission.title) : submission.title,
								pastCities: submission.pastCities ? he.escape(submission.pastCities) : submission.pastCities
							}
						},
						{ upsert: true, returnOriginal: false }).then((res) => {

							console.log(`after updating the user is ${util.inspect(res, { depth: null })}`);
							return Promise.resolve({ newUser: res.value });

						}).catch(err => {
							console.log('the error caught is ...');
							console.error(err);
						});
					console.log(`new user is ${util.inspect(newUser, { depth: null })}`);
					console.log(`the req session user is ${util.inspect(req.session.user, { depth: null })}`);
					req.session.user = newUser;
					let edit_url = `/editProfile/`;
					web.im.open({
						user: body.user.id
					}).then(dm => {
						console.log(`DM the editprofile link in ${dm.channel.id}`);

						web.chat.postMessage({
							as_user: false,
							channel: dm.channel.id,
							// text: `Would you like to join the meeting?`,
							attachments: JSON.stringify([
								{
									title: 'An interesting profile can help your compatible peers find you!',
									text: 'Go to ' + base_url + ' and click your name on the top right menu to edit your profile.',
									color: '#74c8ed',
									callback_id: 'edit_profile'
								}]
							)
						}).catch(err => console.error(err));

					}).catch(err => console.error(err));
					web.chat.postEphemeral({
						as_user: false,
						channel: body.channel.id,
						user: body.user.id,
						attachments: JSON.stringify([
							// {
							// 	title: 'An interesting profile can help your compatible peers find you!',
							// 	text: 'Go to ' + base_url + edit_url + ' to edit your profile.',
							// 	color: '#74c8ed'
							// },
							{
								title: `Would you like me to introduce you in #${body.channel.name}?`,
								text: 'Go and get some :blue_heart: and *We Are* from your peers!',
								color: '#18B87E',
								callback_id: 'hello',
								actions: [{
									name: 'accept',
									text: 'Sure',
									type: 'button',
									value: 'hello',
									style: 'primary'
								},
								{
									name: 'reject',
									text: 'No, thanks',
									type: 'button',
									value: 'no-hello',
									style: 'default'
								}
								],
							}
						])
					}).catch(err => console.error(err));
					console.log('self_intro finished');
				})();


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
								creator_name: body.user.name,
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
								duration: 60, //minutes
								// tz: req.session.user.tz_offset
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
						});
					// req.session.submission = body.submission;
					let meeting_url = `/meeting/` + meeting_id;
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
						]),
						replace_original: true,
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
	res.status(200).end(); // best practice to respond with 200 status

});

app.get('/helppreview', (req, res) => {
	let to_be_rendered = {
		layout: 'default',
		template: 'help-template',
	};
	res.render('help', to_be_rendered);
});

expressWs.app.ws('/temporal/presenceUpdate', function (ws, req) {
	ws.on('message', function (msg) {
		console.log(`temporal presence update route ws on ${msg}`);
	});
	// console.log('socket', req.session);
});

app.use(checkSignIn);

// app.use(rtmConnectFn);

app.get('/help', (req, res) => {
	let to_be_rendered = {
		layout: 'default',
		template: 'help-template',
		userInfo: req.session.user
	};
	res.render('help', to_be_rendered);
});

app.get('/', async function (req, res) {
	//you could do a combo of res.session.locals = res.locals() and res.locals(res.session.locals), but kinda hacky
	// console.log(`session info is ${util.inspect(req.session, { depth: 3 })}, and the locals are ${util.inspect(res.locals, { depth: 2 })}`)
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'index-template';
	to_be_rendered.team = req.session.team;
	to_be_rendered.userInfo = req.session.user;
	to_be_rendered.members = await DB.collection('users').find({ team_id: req.session.team ? req.session.team.team_id : 'T0A286J8K' }).toArray().then((results) => {
		console.log('getting users of the channels');
		if (results.length != 0) {
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

			var obj = {
				tz_members: members_by_tz,
				members_total: results.length
			}
			return Promise.resolve(obj);
			// res.render('index', { layout: 'default', template: 'home-template', tz_members: members_by_tz });
		}
	})
	// .catch(err=>console.error(err));

	let sub_c = req.session.user.channels.map(c => c.cid);
	let all_channels = await DB.collection('channels').find({}).toArray();

	to_be_rendered.total_channels_num = all_channels.length;
	to_be_rendered.channels_info = await DB.collection('channels').find({
		cid: {
			"$in": sub_c
		}
	})
		.toArray().then(async (results) => {
			console.log('find subscribed channels');
			if (results.length != 0) { //this is current all the channels of the team, but perhaps it is good to differentiate which ones the logged user belongs to vs not
				var TopSizeChannels = [], TopActiveChannels = [], limit = 3, c_list = []; //LIMIT is the number of Top X channels

				results.sort((a, b) => { //from big to small
					return b.num_members - a.num_members;
				});
				if (limit > results.length) limit = results.length;
				for (var i = 0; i < limit; i++) {
					TopSizeChannels.push(results[i]);
				}
				results.sort((a, b) => { //from active to inactive, large to small
					return b.num_msgs - a.num_msgs;
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
					channel_list: c_list
				}
				return Promise.resolve(obj);
			}
		})
	// .catch(err=>console.error(err));
	console.log(`the logged user subscribed channels are ${sub_c}`);
	// to_be_rendered.prepare_msgs = await UpdateChannelRecentMsgs(null, 'general', process.env.SLACK_OAUTH_ACCESS_TOKEN, 200);
	to_be_rendered.msgs = await DB.collection("msgs").find({
		cid: {
			"$in": sub_c
		}
	}).toArray().then(async (msgs, err) => {
		let reacted_msgs = [];
		console.log(`the length of the msgs are ${msgs.length}`);
		for (var i = 0; i < msgs.length; i++) {
			if (msgs[i].reactions == null) msgs[i].reactions = [];
		}
		await msgs.sort((a, b) => { //from most reacted to least reacted, popular to small
			// return b.reactions.length - a.reactions.length; //reactions.length is the number of different type of reactions
			var a_reaction_number = 0, b_reaction_number = 0;
			for (var i = 0; i < a.reactions.length; i++) {
				a_reaction_number += a.reactions[i].count;
			}
			for (var i = 0; i < b.reactions.length; i++) {
				b_reaction_number += b.reactions[i].count;
			}
			return b_reaction_number - a_reaction_number;
		});
		return Promise.resolve(msgs.splice(0, 6));

	})
	to_be_rendered.msgs_total = await DB.collection('msgs').find({}).toArray().then(res => {
		return Promise.resolve(res.length);
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
	to_be_rendered.template = 'table-template';
	to_be_rendered.userInfo = req.session.user;
	const numUsers = 80;
	const fields = ['uid', 'real_name', 'city', 'channels', 'major', 'local_area', 'affiliation', 'campus'];
	let users = await similarity.getSimilarUsers(req.session.user.uid, DB, numUsers, fields);
	// to_be_rendered.users = similarity.createSimilarityField(req.session.user, users, fields);
	console.log(`users length is ${users.length}`);
	to_be_rendered.users = users.map(user => {
		if (!!user.city) {
			return user;
		}
		if (!!user.region) {
			user.city = user.region;
			return user;
		}
		if (!!user.local_area) {
			user.city = user.local_area;
			return user;
		}
		return user;
	});

	to_be_rendered.users = similarity.createIsSharedField(req.session.user, users, fields);
	console.log(`number of channels for ${req.session.user.real_name} is ${req.session.user.channels}`);
	const channelNames = req.session.user.channels.map(channel => channel.cname)
		.filter(channel => channel !== 'general');
	to_be_rendered.channelNames = channelNames;
	to_be_rendered.users = to_be_rendered.users.map(user => {
		if (!user.channels) {
			user.channelNames = [];
		}
		else {
			user.channelNames = user.channels.map(channel => channel.cname)
				.filter(channel => channel !== 'general');
		}
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

app.get('/editProfile', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'editprofile-template';
	to_be_rendered.userInfo = req.session.user;
	const uid = req.session.user.uid;
	console.log(`the user session id is ${uid}`)
	const queryResult = await DB.collection('users').find({ uid });
	const doc = await queryResult.toArray();
	if (doc.length === 0) {
		console.error(`No results found for uid ${uid}`);
	}
	else {
		to_be_rendered.user = doc[0];
		//add in template for creation later
		if (!to_be_rendered.user.availability || to_be_rendered.user.availability.length === 0 || !Array.isArray(to_be_rendered.user.availability)) {
			to_be_rendered.user.availability = [{}, {}];
		}
		else {
			to_be_rendered.user.availability.unshift({});
		}
	}
	res.render('profile', to_be_rendered);
});

app.post('/editProfile', [
	check('pastCities').trim().escape(),
	check('fun').trim().escape(),
	check('likeplaces').trim().escape(),
	check('goals').trim().escape(),
	check('title').trim().escape(),
	check('kids').isNumeric()
], async function (req, res) {
	const uid = req.session.user.uid;
	const query = { uid };
	const insertObj = req.body;
	insertObj.availability = JSON.parse(insertObj.availability)
	await DB.collection('users').findOneAndUpdate(query, { $set: insertObj }, { returnOriginal: false }, function (err, updatedObj) {
		if (err) {
			console.warn(`Error with update query ${JSON.stringify(query)}, inserting object ${JSON.stringify(insertObj)}`);
		}
		else {
			console.log(`the updated OBj before call back dbResponse is ${util.inspect(updatedObj, { depth: null })}`);
			req.session.user = updatedObj.value;
			// console.log(`the updated OBj from dbResponse is ${util.inspect(dbResponse, { depth: null })}`);
			res.json({ success: true });
			// return updatedObj;
		}
		// res.send({ received: req.body });

	});


});

app.get('/profile/:uid', async function (req, res) {
	let to_be_rendered = {};
	const { uid } = req.params;
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'profileview-template';
	to_be_rendered.userInfo = req.session.user;
	const queryResult = await DB.collection('users').find({ uid });
	const doc = await queryResult.toArray();
	if (doc.length === 0) {
		console.error(`No results found for uid ${uid}`);
	}
	else {
		to_be_rendered.user = doc[0];
	}
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
			if (results[0].tz == undefined) {
				if (results[0].creator_uid == req.session.user.uid) {
					results[0].tz = req.session.user.tz_offset;
				}
			}
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
				creator_name: results[0].creator_name,
				cmembers: results[0].cmembers,
				cname: results[0].cname,
				cid: results[0].cid,
				attendees: results[0].attendees,
				tz: results[0].tz
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
				creator_name: req.session.user.name,
				cmembers: members,
				attendees: [],
				cid: 'T0A286J8K_C0A28BAHG',
				cname: 'general',
				who: 'custom',
				tz: req.session.user.tz_offset
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

app.post('/meeting/:mid', [
	check('purpose').isLength({ max: 150 }).trim().escape(),
	check('description').trim().escape(),
	check('who').trim().escape(),
	check('start_time').escape(),
	check('date').escape(),
	check('duration').isNumeric()

], async function (req, res) {
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
		creator_name: req.session.user.name,
		cid: req.body.cid,
		cname: req.body.cname,
		cmembers: cmembers,
		duration: req.body.duration,
		tz: req.session.user.tz_offset
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
			const attendees_info = await results[0].cmembers.filter(member => req.body.attendees.includes(
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
				function (err, doc) {
					if (err) console.error(err);
					console.log(`Meeting information updated succesfully, new attendees are: ${util.inspect(newAttendees, { depth: 2 })}`);
					res.json({ success: true });
				});
			return Promise.resolve(attendees_info);
		}
	});




	// res.sendStatus(200);
});

app.post('/remindmeeting', async (req, res) => {
	// var attendeeIDs = req.body.attendees.map(x => x.uid);
	req.body.attendees.forEach(attendee => {
		web.im.open({
			user: attendee.uid.split('_')[1]
		}).then(dm => {
			console.log(`the returned channel id is ${dm.channel.id}`);
			if (attendee.attend == "accept") {
				web.chat.postMessage({
					as_user: false,
					channel: dm.channel.id,
					// text: `Would you like to join the meeting?`,
					attachments: JSON.stringify([
						{
							title: `${req.session.user.real_name} would like to remind you of meeting for ${req.body.purpose}! \n When: ${req.body.date} ${req.body.start_time}`,
							text: `See the <${base_url}/meeting/${req.body.mid}|meeting details>. `,
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

app.post('/invitemeeting', async (req, res) => {
	// var attendeeIDs = req.body.attendees.map(x => x.uid);
	req.body.attendees.forEach(attendee => {
		web.im.open({
			user: attendee.uid.split('_')[1]
		}).then(dm => {
			console.log(`the returned channel id is ${dm.channel.id}`);
			if (attendee.attend == undefined) web.chat.postMessage({
				as_user: false,
				channel: dm.channel.id,
				text: `Would you like to accept the meeting invitation from ${req.session.user.real_name}?`,
				attachments: JSON.stringify([
					{
						title: `Purpose: ${req.body.purpose} \n When: ${req.body.date} ${req.body.start_time}`,
						text: `See the <${base_url}/meeting/${req.body.mid}|meeting details>`,
						callback_id: `${req.body.mid}`,
						color: '#74c8ed',
						actions: [{
							id: `${req.body.mid}`,
							name: 'accept',
							text: 'Sure',
							type: 'button',
							value: 'attend',
							style: 'primary'
						},
						{
							id: `${req.body.mid}`,
							name: 'reject',
							text: 'No, thanks',
							type: 'button',
							value: 'notattend',
							style: 'default'
						}
						],
					},]
				)
			}).catch(err => console.error(err));
		}).catch(err => console.error(err));
	}
	)
	res.sendStatus(200);
});

app.post('/deletemeeting', async function (req, res) {
	let mid = req.body.mid;
	DB.collection('meetings').remove({ mid: mid }, function (err, result) {
		if (err) console.error(err);
		else {
			console.log(`removed successfully: ${util.inspect(result.result)}`);
			res.json({ success: true });
		}
	});
})

function similarTo(list, user) {
	// console.log(`the list in similarTo is ${util.inspect(list, { depth: 3 })}`);
	var dist = 'impossible value';
	list.some(el => {

		if (el.user == user) {
			// console.log(`the distance index inside similarTo func is ${JSON.stringify(el)}`);
			// console.log(el.distance);
			dist = el.distance;
			return el.user === user;
		}


	});
	return Promise.resolve(dist);
}
app.get('/network', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'network-template';
	to_be_rendered.userInfo = req.session.user;
	to_be_rendered.data = await DB.collection('users').find({ team_id: req.session.team.team_id }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			let nodes = results, set_nodes = [], direct_nodes = [], distL = [], distL_temp = [], links = [], c_node = req.session.user, self_channels = req.session.user.channels;
			(async () => {
				links = [];
				set_nodes = [];
				await nodes.forEach(async (n) => {
					if (n.uid == c_node.uid) {
						// console.error("now this is the logged user in the nodes loop");
						n.fixed = true;
						n.x = 400;//half of the canvas width/height
						n.y = 300;
						n.distIdx = 1;
						return;
					}
					n.distIdx = await similarTo(n.similar_users, c_node.uid);
					// console.log(`distance is ${util.inspect(n.distIdx, { depth: null })}`);
					await distL.push({ uid: n.uid, distIdx: n.distIdx });
				});
				console.log(`the c_node third quartile is ${c_node.similar_users_dict.third_quartile}`);
				await distL.forEach(async (l) => {
					// console.log(`the distance is ${l.distIdx}`);
					if (l.distIdx <= c_node.similar_users_dict.third_quartile) {
						await links.push({
							source: l.uid,
							target: c_node.uid,
							value: l.distIdx
						});
						set_nodes.push(l.uid);
						set_nodes.push(c_node.uid);
						await direct_nodes.push(l);
					}
				});
				let i = await direct_nodes.length;
				console.log(`number of direct_nodes is ${direct_nodes.length}`)
				while (i--) {
					c_node = direct_nodes.splice(i, 1)[0];
					// console.log(`c_node is ${util.inspect(c_node, { depth: null })}`);
					distL_temp = [];
					await nodes.forEach(async (n) => {
						if (n.uid == c_node.uid) {
							return;
						};
						let dis = await similarTo(n.similar_users, c_node.uid);
						// console.log(`the distance within while is ${util.inspect(dis, { depth: null })}`);
						await distL.push(dis);
						await distL_temp.push({ uid: n.uid, distIdx: n.distIdx });
					});
					let len = await distL_temp.length;
					console.log(`the length of distL_temp is ${distL_temp.length}`);
					await distL_temp.forEach(async (l) => {
						// console.log(`the distance of other nodes is ${l.distIdx}`);
						if (typeof snapshot_db['users'] == 'undefined') snapshot_db['users'] = await DB.collection('users').find({}).toArray();
						if (l.distIdx <= snapshot_db['users'].filter(u => u.uid == c_node.uid)[0].similar_users_dict.third_quartile) {
							// console.log(`this met criteria and now is going to be put into link from ${l.uid} to ${c_node.uid}`);
							await links.push({
								source: l.uid,
								target: c_node.uid,
								value: l.distIdx
							});
							set_nodes.push(l.uid);
							set_nodes.push(c_node.uid);
						}
					});
				}
			})();

			var obj = {
				nodes: nodes,
				links: links,
				disL: [Math.min(...distL), Math.max(...distL)]
			}
			return Promise.resolve(obj);
		}
	});
	console.log(`links length is ${to_be_rendered.data.links.length}`);
	res.render('network', to_be_rendered);
});

app.get('/temporal', async function (req, res) {
	let to_be_rendered = {};
	to_be_rendered.layout = 'default';
	to_be_rendered.template = 'tz-template';
	to_be_rendered.userInfo = req.session.user;
	to_be_rendered.members = await DB.collection('users').find({ team_id: req.session.team.team_id }).toArray().then(async (results, err) => {
		if (err) console.error(err);
		else if (results.length != 0) {
			//categorize the users based on their tz_labels, sorted by tz_offset
			results.sort((a, b) => {
				return a.tz_offset - b.tz_offset;
			});
			console.log(`the tz offset is ${results[0].tz_offset} for the first sorted member`);

			var num_tz = 0; var members_by_tz = {};
			results.forEach(r => {
				// r.presence = presence_snapshot[r.uid] ? presence_snapshot[r.uid] : "away";
				if (r.tz_offset in members_by_tz) members_by_tz[r.tz_offset].push(r);
				else {
					members_by_tz[r.tz_offset] = [];
					r.tz_offset = parseInt(r.tz_offset);
					members_by_tz[r.tz_offset].push(r);
				}

			});
			console.log(`the total time zones are ${Object.keys(members_by_tz)}`)

			// Create items array
			var items = Object.keys(members_by_tz).map(function (key) {
				return [parseInt(key), members_by_tz[key]];
			});

			// Sort the array based on the key 
			items.sort(function (first, second) {
				return first[0] - second[0];
			});
			var obj = {
				tz_members: items
			}
			return Promise.resolve(obj);
		}
	});
	console.log(`rendered temporal content is ${util.inspect(to_be_rendered.members.tz_members[0], { depth: 2 })}`);
	res.render('temporal', to_be_rendered);


});

// let ws; 

app.post('/rtmconnect', (req, res) => {
	rtmConnectFn(req.session.team.team_id);
});

async function rtmConnectFn(team_id) {
	if (typeof ws == 'undefined' || ws.readyState != WebSocket.OPEN) {
		snapshot_db['users'] = await DB.collection('users').find({}).toArray();
		console.log('Connecting rtm.connect now:');
		console.log(`snapshot users length is ${snapshot_db['users'].length}`);
		// Promise.resolve(snapshot_db['users'])
		await web.rtm.connect({
			token: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
			batch_presence_aware: 1
		}).then(c_result => {
			if (c_result.ok) {

				var obj = {};
				console.log(`The bot is successfully calling RTM.connect`);
				const ws = new WebSocket(c_result.url);;
				ws.on('event', function (e) {
					console.log(`event contained is ${util.inspect(e, { depth: null })}`);
				});
				ws.on('open', function open() {
					ws.send(JSON.stringify({
						type: 'presence_sub',
						ids: snapshot_db['users'].map(u => u.uid.split('_')[1])
					}), function incoming(data) {
						// console.log(`the response from prsence_sub is ${util.inspect(data, {depth: 2})}`)
					});
				});

				ws.on('message', async function incoming(data) {
					var obj_data = JSON.parse(data);

					// var promise = results.filter(x => x.uid == obj_data.team + '_' + obj_data.user)
					if (obj_data.type != "hello") {
						obj_data.team = team_id;

						// console.log(`data message type is ${obj_data.type}`)
						switch (obj_data.type) {
							case 'presence_change':
								let aWss = expressWs.getWss('/temporal/presenceUpdate');
								const updateDoc = {
									uid: `${obj_data.team}_${obj_data.user}`,
									// presence_trail: [],
									status: obj_data.presence,
									ts: new Date()
								};
								DB.collection('user_presence').findOneAndUpdate(
									{ uid: `${obj_data.team}_${obj_data.user}` },
									{
										$set: updateDoc,
									},
									{ upsert: true, returnOriginal: true }).then((user) => {
										// console.log(`presence trail for the user is ${util.inspect(user, {depth: 2})}`);
										let presence_trail = user.value.presence_trail;
										if (user.value.presence_trail) {
											if(user.value.presence_trail[user.value.presence_trail.length-1].status!=obj_data.presence)presence_trail.push({
												ts: updateDoc.ts,
												status: obj_data.presence
											});
											DB.collection('user_presence').updateOne(
												{ uid: `${obj_data.team}_${obj_data.user}` },
												{
													$set: {
														presence_trail: presence_trail
													},
												},
												{ upsert: false },
												function (err, res) {
													if (err) console.error(err);
													// else console.log(`${obj_data.team}_${obj_data.user} added a new presence status ${obj_data.presence}`)
												});
										}
										else {
											user.presence_trail = [{
												ts: updateDoc.ts,
												status: obj_data.presence
											}];
											DB.collection('user_presence').updateOne(
												{ uid: `${obj_data.team}_${obj_data.user}` },
												{
													$set: {
														presence_trail: user.presence_trail
													},
												},
												{ upsert: false },
												function (err, res) {
													if (err) console.error(err);
													else console.log(`${obj_data.team}_${obj_data.user} first presence status ${obj_data.presence}`)
												});
										}
									}).catch(err=>console.error(err));
								// console.log(`the clients in the browsers includes ${util.inspect(aWss.clients, {depth: 3})} in total; and the presence status is ${obj_data.presence}`);
								aWss.clients.forEach(function (client) {
									// console.log(`sending to client the presence is : ${obj_data.presence}`);
									client.send(JSON.stringify(obj_data));
								});

								break;
							case 'text':
								aWss.clients.forEach(function (client) {
									console.log(`sending to client the message is : ${obj_data}`);
									client.send(JSON.stringify(obj_data));
								});
							default:
								console.log('not cased in the obj_data type for rtm.connect');
						}

					}
				});
				ws.on('close', function close() {
					console.log('----------------disconnected---------------------');

				});
			}
		});
	}
	else console.log('Already connected');
	// next();

}
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
					if (m.deleted == true) return;
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
						console.log(`user ${m.real_name} updated succesfully: next retrieving ldap and similarity`);
						const email = m.profile.email;
						const fullName = m.profile.real_name;
						try {
							await ldap.updateUserWithLdapData(email, fullName, uid, DB);
						} catch (e) {
							console.log('error', e.toString());
						}
						await similarity.storeSimilarUsers([uid]);
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
					if (m.deleted == true) return;
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
					const onComplete = async () => {
						console.log(`user ${m.real_name} updated succesfully: next retrieving ldap and similarity`);
						const email = m.profile.email;
						const fullName = m.profile.real_name;
						await ldap.updateUserWithLdapData(email, fullName, uid, DB);
						await similarity.storeSimilarUsers([uid]);
					}
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
						onComplete);

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
			console.log(`iteration in InitTeamChannels: round ${counter}`)
			await local_slack.conversations.list({ //find all the channel info given a teamID; default: public channels as 'types' param
				limit: limit | 200
			}).then(res => {
				cursor = res.response_metadata.next_cursor;
				counter += 1;
				// console.log(`cursor is ${cursor} and counter is ${counter}`)
				res.channels.forEach(async m => {
					var cid = team_id + '_' + m.id;
					let cmembers = await ChannelMembers(cid, m.name);
					if (cmembers) console.log(`members in ${m.name} are ${cmembers.length}`);
					else console.log(`undefined members for ${m.name}`);
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
								cmembers: cmembers ? cmembers : [],
								num_msgs: 0,
								latest_msg_ts: null
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
							else console.log(`first 20 channels`);
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
				res.channels.forEach(async m => {
					// console.log(`the m value inside res.channels are (from conversations.list): ${util.inspect(m, { depth: null })}`)
					var cid = team_id + '_' + m.id;
					let cmembers = await ChannelMembers(cid, m.name);
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
								cmembers: cmembers ? cmembers : [],
								num_msgs: 0,
								latest_msg_ts: null
							}
						},
						{ upsert: true },
						function (err, res) {
							if (err) console.error(err);
						});
				});
			});
			if (!cursor) break;
		}
	}

}

async function UpdateChannelRecentMsgs(c_id, cname, token, limit = 200) {
	var local_slack = new SlackWebClient(token);
	if (c_id) console.log(`channel id passed in is ${c_id}`);
	else console.log(`channel id passed in is EMPTY; I going to update messages in the subscribed channels only`);
	snapshot_db['users'] = await DB.collection('users').find({}).toArray();
	snapshot_db['channels'] = await DB.collection('channels').find({}).toArray();
	if (!c_id) { //c_id is not defined, pull all the channels msg
		snapshot_db['channels'].forEach(async c => {
			const obj = await Go_through_channel_msgs(c.cid, c.cname);
			DB.collection('channels').updateOne(
				{ cid: c.cid },
				{
					$set: {
						num_msgs: obj.num_msgs,
						latest_msg_ts: obj.latest_msg_ts
					}
				},
				{ upsert: false },
				function (err, res) {
					if (err) console.error(err);
				});
			return Promise.resolve(obj.num_msgs);
		});
	}
	else {
		const obj = await Go_through_channel_msgs(c_id, cname); //once
		DB.collection('channels').updateOne(
			{ cid: c_id },
			{
				$set: {
					num_msgs: obj.num_msgs,
					latest_msg_ts: obj.latest_msg_ts
				}
			},
			{ upsert: false },
			function (err, res) {
				if (err) console.error(err);
			});
	}
	async function Go_through_channel_msgs(c_id, cname) {
		if (!cname) {
			const thisChannel = snapshot_db['channels'].filter(c => c.cid == c_id)[0];
			cname = thisChannel.cname;
		}
		let first = true, count = 0, num_msgs = 0, latest = null;
		var check_cursor = "fake";
		while (check_cursor) {
			console.log(`while loop: ${count++}; cursor is ${check_cursor}`);
			if (first) {
				console.log(`First`);
				check_cursor = await local_slack.conversations.history({ // pay attention the user token (for reading history from channel/groups) but the bot is used to write
					channel: c_id.split('_')[1], //#test-bot (left) #learning-tech C0A34HJVA
					limit: limit | 200,
					// cursor: cursor
				}).then(res => {
					const msgs = res.messages;
					latest = 0;
					// num_msgs += msgs.length;
					console.log(`is the first messsage the latest one: ${timeConverter(res.messages[0].ts)}`)
					console.log(`is the last messsage the latest one: ${timeConverter(res.messages[msgs.length - 1].ts)}`)
					// console.log(`${util.inspect(res, { depth: 2 })}`);
					if (res.response_metadata) {
						check_cursor = res.response_metadata.next_cursor;
					}
					else {
						check_cursor = null;
						console.log(`oops!!!!!!!!!!!!! cursor is null`);
					}
					// console.log(`cursor is ${cursor} from object ${util.inspect(res, { depth: null })}`);
					msgs.forEach(async msg => {
						var user = snapshot_db['users'].filter(u => u.uid.split('_')[1] == msg.user)[0];
						if (msg.type == 'message' && !msg.bot_id && !msg.subtype) { // only look at the plain text msgs from real users
							if (msg.ts > latest) latest = msg.ts;
							num_msgs += 1;
							const msg_obj = {
								uid: msg.user,
								username: user.real_name,
								user_avatar: user.image_48,
								cid: c_id,
								cname: cname,
								text: msg.text,
								ts: msg.ts,
								thread_ts: msg.thread_ts,
								is_starred: msg.is_starred,
								reactions: msg.reactions
							}
							await DB.collection('msgs').updateOne(
								{ mid: msg.client_msg_id },
								{
									$set: msg_obj
								},
								{ upsert: true },
								function (err, res) {
									if (err) console.error(err);
									else console.log('msg updated!');
								});
						}
					});
					console.log(`-------------first time while loop: the next cursor is ${check_cursor}--------------`);
					return Promise.resolve(check_cursor);
				})
					.catch(err => console.error(err));
				first = false;
			}
			else {
				console.log(`Non-First`);
				await local_slack.conversations.history({ // pay attention the user token (for reading history from channel/groups) but the bot is used to write
					channel: c_id.split('_')[1], //#test-bot (left) #learning-tech C0A34HJVA
					limit: limit | 200,
					cursor: check_cursor
				}).then(res => {
					const msgs = res.messages;
					// num_msgs += msgs.length;
					if (res.response_metadata) {
						check_cursor = res.response_metadata.next_cursor;
						console.log(`cursor is ${check_cursor}}`);
					}
					else {
						check_cursor = null;
						console.log(`oops!!!!!!!!!!!!! cursor is null`);
					}
					// console.log(`there are ${msgs.length} results from a channel history \n the first one is ${util.inspect(msgs[0], { depth: 2 })}`)
					msgs.forEach(msg => {
						var user = snapshot_db['users'].filter(u => u.uid.split('_')[1] == msg.user)[0];
						if (msg.type == 'message' && !msg.bot_id && !msg.subtype) { // only look at the plain text msgs from real users
							// console.log(`Real msg from user in the Update func is ${util.inspect(msg, {depth: 2})}`);
							if (msg.ts > latest) latest = msg.ts;
							num_msgs += 1;
							const msg_obj = {
								uid: msg.user,//team??
								username: user.real_name,
								user_avatar: user.image_48,
								cid: c_id,
								cname: cname,
								text: msg.text,
								ts: msg.ts,
								thread_ts: msg.thread_ts,
								is_starred: msg.is_starred,
								reactions: msg.reactions
							}
							DB.collection('msgs').updateOne(
								{ mid: msg.client_msg_id },
								{
									$set: msg_obj
								},
								{ upsert: true },
								function (err, res) {
									if (err) console.error(err);
									// else console.log(`msgs entered with DB transaction ${res}`)
								});
						}
					});
					console.log(`-------------Next time while loop: the next cursor is ${check_cursor}--------------`);
					return Promise.resolve(check_cursor);
				})
					.catch(err => {
						console.error(err);
					});
			}
			if (!check_cursor) break;
			else console.log(`before finishing this while loop, the cursor is ${check_cursor}`);
		}
		return Promise.resolve({
			num_msgs: num_msgs,
			latest_msg_ts: latest
		});
	}
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
						'text': 'Would you like to set up a meeting and invite your attendees with direct messages',
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
	var time = month + ' ' + date + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
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
	return res.render('error');
});

// Set up express server here
// const options = {
//     cert: fs.readFileSync('/etc/pki/tls/certs/weconnect.crt'),
//     key: fs.readFileSync('/etc/pki/tls/private/weconnect.key')
// };
app.listen(process.env.PORT, () => {
	console.log(`WeAre! server is running on PORT ${process.env.PORT}`);
});

process.on('warning', warning => {
	console.warn(warning.name);    // Print the warning name
	console.warn(warning.message);
	console.warn(warning.stack);
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
	DB.createCollection('interactions', function (err, collection) { });
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
