var config = require('config');
var express = require('express');
var compress = require('compression');
var bodyParser = require('body-parser');

// SERVER
// ==============================================
var app = express();
var port = process.env.PORT || 9001;

app.listen(port);

console.log("Listening on port " + port);

// Enable Compression
app.use(compress());
app.use(bodyParser.urlencoded({ extended: false }));

// ROUTES
// ==============================================

var router = express.Router({
  strict: app.get('strict routing')
});

router.use(function(req, res, next) {
  res.header("Access-Control-Allow-Methods", "GET,POST");
  next();
});


// Home page route
router.get('/', function(req, res) {
    res.send(config.get('default.title'))
});

require('./routes')(router);

app.use('/', router);
