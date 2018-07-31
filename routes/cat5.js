var config = require('config');
const tokenizer = require('string-tokenizer');

var genUUID = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0,
      v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

Slack = require('node-slackr');

var postDynamoDB = function (data) {
  var awsCredentials = config.get('cat5.aws.credentials');
  var ddb = {
    tableName: config.get('cat5.aws.dynamo.tablename')
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
    spreadsheetId: config.get('cat5.google.spreadsheetId'),
    worksheetId: config.get('cat5.google.worksheetId'),

    "oauth2": config.get('cat5.google.oauth2')

  }, function sheetReady(err, spreadsheet) {
    if (err) throw err;

    spreadsheet.receive(function (err, rows, info) {
      if (err) throw err;
      var rowNum = info.lastRow + 1;
      console.log('Next Row Num is: ' + rowNum);

      var obj = {};
      obj[rowNum] = [
        [data.userName, data.text, data.duration, data.gdocDate, data.ID]
      ];
      console.log(obj);
      spreadsheet.add(obj);
      spreadsheet.send(function (err) {
        if (err) throw err;
      });
    });
  });
};

module.exports = function (router) {
  router.post('/cat5', function (req, res) {

    var slackWebhookUrl = config.get('cat5.slack.url');
    var slackToken = config.get('cat5.slack.token');
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
      res.send('Your Cat5 thing appears to be empty. Remember to use the format \'`/cat5 <thing>`\' and try again.');
      res.end();
    } else {

      // get the channel where the command was called from.
      var postOriginChannel = '';
      if (originChannelName != 'privategroup') {
        postOriginChannel = ['#', originChannelName].join('');
      }

      // Get the target channel name
      var channels = config.get('cat5.slack.post_channel');
      // If the name of the target channel is different than the origin, post to both channels.
      if (postOriginChannel != channels) {
        channels = [config.get('cat5.slack.post_channel'), postOriginChannel];
      }

      slack = new Slack(slackWebhookUrl, {
        username: config.get('cat5.slack.post_username'),
        channel: channels,
        icon_emoji: config.get('cat5.slack.post_emoji')
      });

      var message = {
        text: "*TopCat | " + data.userName + "*\n" + data.text
      };

      if (data.cmd === '/cat5') {

        if (config.cat5.aws.enabled) {
          postDynamoDB(data);
        }
        if (config.cat5.google.enabled) {
          postGDoc(data);
        }

        slack.notify(message);
        res.send('Thanks for recording your Cat5 thing (' + data.text + ')');
      } else {
        res.end();
      }
    }
  });
};