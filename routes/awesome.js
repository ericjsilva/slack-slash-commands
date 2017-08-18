var config = require('config');

var genUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

Slack = require('node-slackr');

var postDynamoDB = function (data) {
    var awsCredentials = config.get('awesome.aws.credentials');
    var ddb = {
        tableName: config.get('awesome.aws.dynamo.tablename')
    };
    var DynamoDB = require('aws-dynamodb')(awsCredentials);

    DynamoDB
        .table(ddb.tableName)
        .insert({
            ID: data.ID,
            UserName: data.userName,
            Text: data.text,
            CreatedDateTime: data.isodate
        }, function (err, data) {
            console.log(err, data)
        });
};

var postGDoc = function (data) {

    var Spreadsheet = require('edit-google-spreadsheet');

    Spreadsheet.load({
        debug: true,
        spreadsheetId: config.get('awesome.google.spreadsheetId'),
        worksheetId: config.get('awesome.google.worksheetId'),

        "oauth2": config.get('awesome.google.oauth2')

    }, function sheetReady(err, spreadsheet) {
        if (err) throw err;

        spreadsheet.receive(function (err, rows, info) {
            if (err) throw err;
            var rowNum = info.lastRow + 1;
            console.log('Next Row Num is: ' + rowNum);

            var obj = {};
            obj[rowNum] = [[data.userName, data.text, data.gdocDate, data.ID]];
            console.log(obj);
            spreadsheet.add(obj);
            spreadsheet.send(function (err) {
                if (err) throw err;
            });
        });
    });
};

module.exports = function (router) {
    router.post('/awesome', function (req, res) {

        var slackWebhookUrl = config.get('awesome.slack.url');
        var slackToken = config.get('awesome.slack.token');
        var originChannelName = req.body.channel_name;
        //console.log("REQUEST: \n" + JSON.stringify(req.body));
        //console.log("Origin Channel: " + originChannelName);

        var format = require('date-format');
        var timestamp = new Date();

        var data = {
            token: req.body.token,
            ID: genUUID(),
            userName: req.body.user_name,
            cmd: req.body.command,
            text: req.body.text,
            isodate: timestamp.toISOString(),
            gdocDate: format.asString('MM/dd/yyyy hh:mm:ss', timestamp)
        };

        //console.log("TOKEN: " + token);
        //console.log("USER: " + userName);
        //console.log("CMD: " + cmd);
        //console.log("TEXT: " + text);

        // Check that the slack token is valid.
        if (data.token != slackToken) {
            res.sendStatus(403);
            res.end();
        }

        // Check for empty string passed in.
        if (!data.text || data.text.trim().length === 0) {
            res.send('Your awesome thing appears to be empty. Be awesome and try again.');
            res.end();
        } else {

            // get the channel where the command was called from.
            var postOriginChannel = '';
            if (originChannelName != 'privategroup') {
                postOriginChannel = ['#', originChannelName].join('');
            }

            // Get the target channel name
            var channels = config.get('awesome.slack.post_channel');
            // If the name of the target channel is different than the origin, post to both channels.
            if (postOriginChannel != channels) {
                channels = [config.get('awesome.slack.post_channel'), postOriginChannel];
            }

            slack = new Slack(slackWebhookUrl, {
                username: config.get('awesome.slack.post_username'),
                channel: channels,
                icon_emoji: config.get('awesome.slack.post_emoji')
            });

            var message = {
                text: "*Awesome | " + data.userName + "*\n" + data.text
            };

            if (data.cmd === '/awesome') {

                if (awesome.config.aws.enabled) {
                    postDynamoDB(data);
                }
                if (awesome.config.google.enabled) {
                    postGDoc(data);
                }

                slack.notify(message);
                res.send('Thanks for recording your Awesome thing (' + data.text + ')');
            } else {
                res.end();
            }
        }
    });
};




