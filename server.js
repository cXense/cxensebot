// Dependencies
var fs = require('fs'),
    os = require('os'),
    crypto = require('crypto'),
    http = require('http'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    request = require('request');
require('console-stamp')(console, 'yyyy.mm.dd HH:MM:ss');
var Botkit = require('botkit');
const {Wit, log} = require('node-wit');


// TODOs
var siteId = 'xxxxxxxxxxx'; // TODO: Set your Cxense site ID here
var username = 'xxx@x.com'; // TODO: Set your Cxense user name (email) here
var apiKey = 'xxxxxxxxxxx'; // TODO: Set your API key here
var baseUrl = 'https://cxensebot.cxense.com/'; // TODO: Set your base URL here

var fb_access_token = 'xxxxxxx'; // TODO: Set your facebook access token here
var fb_verify_token = 'xxxxxxx'; // TODO: Set your facebook verify token here

var slack_token = 'xxxxxxxxxxx'; // TODO: Set your Slack token here


// Helper function to make Cxense API requests
function cxApiRequest(apiName, body, callback) {
    var date = new Date().toISOString(), hmac = crypto.createHmac('sha256', apiKey).update(date).digest('hex');
    console.log('Sending API request: ' + apiName + ', body: ' + JSON.stringify(body));
    request.post({
        url: 'https://api.cxense.com' + apiName,
        headers: {'X-cXense-Authentication': 'username=' + username + ' date=' + date + ' hmac-sha256-hex=' + hmac},
        body: body,
        json: true
    }, callback);
}


// Setup the Facebook messenger integration
var fbController = Botkit.facebookbot({
    access_token: fb_access_token,
    verify_token: fb_verify_token
});
var fbBot = fbController.spawn({});
fbController.setupWebserver(10521, function(err, webserver) {
    fbController.createWebhookEndpoints(fbController.webserver, fbBot, function() {
        console.log('This bot is online!!!');
    });
});
fbController.on('facebook_optin', function(fbBot, message) {
    fbBot.reply(message, 'Welcome to my app!');
});
fbController.on('message_received', function(bot, message) { return botReply(bot, message, 'fbm'); });


// Setup the Slack integration
var controller = Botkit.slackbot();
var bot = controller.spawn({ token: slack_token, retry: Infinity })

var slackInitialConnectionOk = false;
function initialSlackConnect() {
    if (!slackInitialConnectionOk) {
        bot.startRTM(function (err, bot, payload) {
            if (err) {
                console.log('Couldn\'t connect to Slack. Retrying in 10s...');
                setTimeout(initialConnect, 10000);
            } else {
                slackInitialConnectionOk = true;
                console.log('Connected to Slack. ');
            }
        });
    }
}
initialSlackConnect();
controller.on('direct_message', function(bot, message) { return botReply(bot, message, 'slk'); });
controller.on('direct_mention', function(bot, message) { return botReply(bot, message, 'slk'); });


// The code that parses incoming text and responds (common to all integrations)
function botReply(bot, message, type) {
    console.log('Message: ' + JSON.stringify(message));

    cxApiRequest('/profile/user', { type: type, id: message.user }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            bot.reply(message, 'Hi there! Before we can talk, I need you to verify yourself by clicking this link: ' +
                baseUrl + 'verify.html?id=' + message.user + '&type=' + type);
        } else {
            const witClient = new Wit({accessToken: 'ILCIPD54QXJS55HJ34XKDEHELDDSFQZV'});
            witClient.message(message.text, {})
                .then((data) => {
                    console.log('Got Wit.ai response: ' + JSON.stringify(data));

                        if ((data.entities.intent || []).some(function (intent) { return intent.value === 'greeting' })) {
                            bot.reply(message, '' +
                                (Math.random() > 0.5 ? 'Hi!' : 'Hello!') +
                                (Math.random() > 0.5 ? (type === 'slk' ? ' :simple_smile:' : ' :-)') : '')
                            );

                        } else if (data.entities.personPropertyValue) { // Set a property
                            var personReference = ((data.entities.personReference || [])[0] || {}).value;
                            var personProperty = ((data.entities.personProperty || [])[0] || {}).value;
                            var personPropertyValue = ((data.entities.personPropertyValue || [])[0] || {}).value;

                            user[personProperty] = personPropertyValue;
                            console.log(JSON.stringify([personReference, personProperty, personPropertyValue]));
                            bot.reply(message, 'Ok, got it.');

                        } else if (data.entities.personProperty) { // Get a property
                            var personReference = ((data.entities.personReference || [])[0] || {}).value;
                            var personProperty = ((data.entities.personProperty || [])[0] || {}).value;
                            var personPropertyQualifier = ((data.entities.personPropertyQualifier || [])[0] || {}).value;
                            var timePeriod = ((data.entities.timePeriod|| [])[0] || {}).value;

                            if (personProperty === 'read' && timePeriod) {
                                cxApiRequest('/traffic/data',{
                                        siteId: '9222302702321341959', start:'-7200', stop:'-0',
                                        filters:[{type:'user', group: type, item: message.user}],
                                        fields:['url']
                                    }, function (error, response, body) {
                                    if (error || response.statusCode !== 200) {
                                        bot.reply(message, 'Error ' + error);
                                    } else {
                                        body.events && body.events.sort(function(a, b) { return b.time - a.time; });
                                        if (body.events && body.events[0]) {
                                            bot.reply(message, 'You read: ' + body.events[0].url);
                                        } else {
                                            bot.reply(message, 'I don\'t know what you read last.');
                                        }

                                    }
                                });
                            } else if (personProperty === 'read about' && timePeriod && personPropertyQualifier) {
                                cxApiRequest('/traffic/keyword',{
                                    siteId: '9222302702321341959', start:'-7200', stop:'-0',
                                    filters:[{type:'user', group: type, item: message.user}],
                                    groups: ['person'], count: 5
                                }, function (error, response, body) {
                                    if (error || response.statusCode !== 200) {
                                        bot.reply(message, 'Error ' + error);
                                    } else {
                                        if (body.groups && body.groups[0] && body.groups[0].items && body.groups[0].items[0]) {
                                            var persons = body.groups[0].items.reduce(function(c, e, i, a) { return c + (i > 0 ? (i === a.length-1 ? ' and ' : ', ') : '') + e.item; }, '');
                                            bot.reply(message, 'You read about: ' + persons + '.');
                                        } else {
                                            bot.reply(message, 'I don\'t know who you read about ' + timePeriod + '.');
                                        }

                                    }
                                });


                            } else if (personProperty === 'interest profile' || personProperty === 'profile') {
                                console.log('Profile: ' + JSON.stringify(body.profile));
                                var categories = [];
                                body.profile.forEach(function (profileEntry) {
                                    var groupMatch = false;
                                    var groupWeight = 0;
                                    profileEntry.groups.forEach(function (groupEntry) {
                                        if (groupEntry.group === 'cxd-categories' && profileEntry.item.indexOf('/') < 0) {
                                            categories.push({item: profileEntry.item, weight: groupEntry.weight});
                                        }
                                    });
                                });
                                var profileText = '';
                                categories.sort(function (a, b) { return b.weight - a.weight; });
                                categories = categories.slice(0, 5);
                                categories.forEach(function (category) {
                                    profileText += ' - (' + (100 * category.weight).toPrecision(3) + '%) ';
                                    for (var i = 0; i < category.weight; i += 0.02) {
                                        profileText += type === 'slk' ? ':black_large_square:' : '#';
                                    }
                                    profileText += ' ' + category.item + '';
                                    profileText += '\n';
                                });
                                bot.reply(message, 'Profile: \n' + profileText);
                            } else {
                                // var personPropertyValue = user[personProperty];
                                // console.log(JSON.stringify([personReference, personProperty, personPropertyValue]));
                                bot.reply(message, '(no response)');//  + personPropertyValue);
                            }

                        } else if (data.entities.itemType) {

                            // {"siteId":"9222302702321341959", "groups":["url"], "fields":["events","uniqueUsers"], "orderBy":"uniqueUsers", "count":3}

                            cxApiRequest('/traffic/event', {
                                start: -3600,
                                siteId: '9222302702321341959',
                                groups: ['url'],
                                fields: ['events', 'uniqueUsers'],
                                filters: [{type: 'keyword', group: 'pageclass', item: 'article'}],
                                orderBy: 'uniqueUsers', count: 3
                            }, function (error, response, body) {

                                if (!error && response.statusCode === 200) {
                                    var replyText = 'The top three articles are: \n';

                                    body.groups.forEach(function (group) {
                                        group.items.forEach(function (item) {
                                            replyText += item.item + ' \n';
                                        })
                                    });
                                    bot.reply(message, replyText);
                                }
                            });
                        } else {
                            bot.reply(message, 'I didn\'t quite get what you meant.');
                    }
                }).catch(console.error);
        }
    });
}


// Configure Express (user linking and the web chatbot)
var app = express();
var server = http.createServer(app);
app.set('port', 10520);
app.enable('trust proxy'); // Trust "X-Forwarded-For"
app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/message', function(req, res, next) {
    var bot = { reply: function(message, text) {
        res.send(JSON.stringify({text: text }));
    }};
    var message = { text: req.body.text, user: req.body.cxId };
    botReply(bot, message, 'cx');
});


app.use('/map', function(req, res, next) {
    state.users[req.body.type][req.body.id] = req.body.cxId;
    state.users.cxense[req.body.cxId] = {};

    cxApiRequest('/profile/user/external/link/update', {
        type: req.body.type,
        id: req.body.id,
        cxid: req.body.cxId
    }, function (error, response, body) {
        if (!error || response.statusCode !== 200) {
            cxApiRequest('/profile/user', { type: req.body.type, id: req.body.id }, function (error, response, body) {
                if (error || response.statusCode !== 200) {
                    res.send(JSON.stringify({result: 'ERROR: No profile!'}));
                } else {
                    res.send(JSON.stringify({result: 'OK'}));
                }
            });
        } else {
            console.log('Map error: ' + (error || response.statusCode))
            res.send(JSON.stringify({result: 'Error'}));
        }
    });

    console.log('Got map request "' + req.url + '" from user agent type: ' + req.headers['user-agent'])
});

app.use('/', function(req, res, next) {
    console.log('Got request: ' + req.path);
    next();
}, express.static(__dirname + '/public'));

app.use(express.static(__dirname + '/public'));

// Start Express
server.listen(app.get('port'));
console.log('Listening on port ' + app.get('port'));
