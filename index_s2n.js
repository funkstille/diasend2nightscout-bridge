/**
 * Author: Funk Stille
 * https://github.com/funkstille
 */
var request = require('request');
var qs = require('querystring');
var crypto = require('crypto');
var meta = require('./package.json');


// Defaults
var server = "api.diasend.com";
var bridge = readENV('DIASEND_SERVER')
    if (bridge && bridge.indexOf(".") > 1) {
    server = bridge;
   } 
var diasend_client_id = "a486o3nvdu88cg0sos4cw8cccc0o0cg.api.diasend.com";
var diasend_client_id_new = readENV('DIASEND_APP_CLIENT_ID')
    if (diasend_client_id_new && diasend_client_id_new.indexOf(".") > 1) {
    diasend_client_id = diasend_client_id_new;
   } 
var diasend_client_secret = "8imoieg4pyos04s44okoooowkogsco4";
var diasend_client_secret_new = readENV('DIASEND_APP_CLIENT_SECRET')
    if (diasend_client_secret_new && diasend_client_secret_new.indexOf(".") > 1) {
    diasend_client_secret = diasend_client_secret_new;
   } 
var diasend_scope = "PATIENT DIASEND_MOBILE_DEVICE_DATA_RW";
var diasend_oauth_url = "https://" + server + "/1/oauth2/token";
var diasend_data_url = "https://" + server + "/1/patient/data#";


var Defaults = {
  "applicationId":"d89443d2-327c-4a6f-89e5-496bbb0317db"
, "agent": [meta.name, meta.version].join('/')
, login: 'https://' + server + '/ShareWebServices/Services/General/LoginPublisherAccountByName'
, accept: 'application/json'
, 'content-type': 'application/json'
, LatestGlucose: 'https://' + server + '/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues'
// ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
, nightscout_upload: '/api/v1/entries.json'
, nightscout_battery: '/api/v1/devicestatus.json'
, MIN_PASSPHRASE_LENGTH: 12
};


// Trends are not build in diasend

// assemble the POST body for the login endpoint
function login_payload (opts) {
  var body = {
    "password": opts.password
  , "applicationId" : opts.applicationId || Defaults.applicationId
  , "accountName": opts.accountName
  };
  return body;
}

// Login to Dexcom's server.
// Hier muss dann OAUTH2 hin

function authorize (opts, then) {
  var url = opts.login || Defaults.login;
  var body = login_payload(opts);
  var headers = { 'User-Agent': opts.agent || Defaults.agent
                , 'Content-Type': Defaults['content-type']
                , 'Accept': Defaults.accept };
  var req ={ uri: url, body: body, json: true, headers: headers, method: 'POST'
           , rejectUnauthorized: false };
  // Asynchronously calls the `then` function when the request's I/O
  // is done.
  return request(req, then);
}

// Assemble query string for fetching data.
// Anpassen auf DIASEND

function fetch_query (opts) {
  // ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
  var q = {
    sessionID: opts.sessionID
  , minutes: opts.minutes || 1440
  , maxCount: opts.maxCount || 1
  };
  var url = (opts.LatestGlucose || Defaults.LatestGlucose) + '?' + qs.stringify(q);
  return url;
}

// Asynchronously fetch data from Dexcom's server.
// Will fetch `minutes` and `maxCount` records.
function fetch (opts, then) {
  var url = fetch_query(opts);
  var body = "";
  var headers = { 'User-Agent': Defaults.agent
                , 'Content-Type': Defaults['content-type']
                , 'Content-Length': 0
                , 'Accept': Defaults.accept };

  var req ={ uri: url, body: body, json: true, headers: headers, method: 'POST'
           , rejectUnauthorized: false };
  return request(req, then);
}

// Authenticate and fetch data from Dexcom.
// umbauen auf DIASEND

function do_everything (opts, then) {
  var login_opts = opts.login;
  var fetch_opts = opts.fetch;
  authorize(login_opts, function (err, res, body) {

    fetch_opts.sessionID = body;
    fetch(fetch_opts, function (err, res, glucose) {
      then(err, glucose);

    });
  });

}

// Map Dexcom's property values to Nightscout's.
// Umbau DIASEND

function dex_to_entry (d) {
/*
[ { DT: '/Date(1426292016000-0700)/',
    ST: '/Date(1426295616000)/',
    Trend: 4,
    Value: 101,
    WT: '/Date(1426292039000)/' } ]
*/
  var regex = /\((.*)\)/;
  var wall = parseInt(d.WT.match(regex)[1]);
  var date = new Date(wall);
  var entry = {
    sgv: d.Value
  , date: wall
  , dateString: date.toISOString( )
  , trend: d.Trend
  , direction: trendToDirection(d.Trend)
  , device: 'share2'
  , type: 'sgv'
  };
  return entry;
}

// Record data into Nightscout.

function report_to_nightscout (opts, then) {
  var shasum = crypto.createHash('sha1');
  var hash = shasum.update(opts.API_SECRET);
  var headers = { 'api-secret': shasum.digest('hex')
                , 'Content-Type': Defaults['content-type']
                , 'Accept': Defaults.accept };
  var url = opts.endpoint + Defaults.nightscout_upload;
  var req = { uri: url, body: opts.entries, json: true, headers: headers, method: 'POST'
            , rejectUnauthorized: false };
  return request(req, then);

}

function nullify_battery_status (opts, then) {
  var shasum = crypto.createHash('sha1');
  var hash = shasum.update(opts.API_SECRET);
  var headers = { 'api-secret': shasum.digest('hex')
                , 'Content-Type': Defaults['content-type']
                , 'Accept': Defaults.accept };
  var url = opts.endpoint + Defaults.nightscout_battery;
  var body = { uploaderBattery: false };
  var req = { uri: url, body: body, json: true, headers: headers, method: 'POST'
            , rejectUnauthorized: false };
  return request(req, then);
}

function engine (opts) {

  var runs = 0;
  var failures = 0;
  function my ( ) {
    console.log('RUNNING', runs, 'failures', failures);
    if (my.sessionID) {
      var fetch_opts = Object.create(opts.fetch);
      if (runs === 0) {
        console.log('First run, fetching', opts.firstFetchCount);
        fetch_opts.maxCount = opts.firstFetchCount;
      }
      fetch_opts.sessionID = my.sessionID;
      fetch(fetch_opts, function (err, res, glucose) {
        if (res && res.statusCode < 400) {
          to_nightscout(glucose);
        } else {
          my.sessionID = null;
          refresh_token( );
        }
      });
    } else {
      failures++;
      refresh_token( );
    }
  }

  function refresh_token ( ) {
    console.log('Fetching new token');
    authorize(opts.login, function (err, res, body) {
      if (!err && body && res && res.statusCode == 200) {
        my.sessionID = body;
        failures = 0;
        my( );
      } else {
        failures++;
        var responseStatus = res ? res.statusCode : "response not found";
        console.log("Error refreshing token", err, responseStatus, body);
        if (failures >= opts.maxFailures) {
          throw "Too many login failures, check DEXCOM_ACCOUNT_NAME and DEXCOM_PASSWORD";
        }
      }
    });
  }

  function to_nightscout (glucose) {
    var ns_config = Object.create(opts.nightscout);
    if (glucose) {
      runs++;
      // Translate to Nightscout data.
      var entries = glucose.map(dex_to_entry);
      console.log('Entries', entries);
      if (opts && opts.callback && opts.callback.call) {
        opts.callback(null, entries);
      }
      if (ns_config.endpoint) {
        if (runs === 0) {
          nullify_battery_status(ns_config, function (err, resp) {
            if (err) {
              console.warn('Problem reporting battery', arguments);
            } else {
              console.log('Battery status hidden');
            }
          });
        }
        ns_config.entries = entries;
        // Send data to Nightscout.
        report_to_nightscout(ns_config, function (err, response, body) {
          console.log("Nightscout upload", 'error', err, 'status', response.statusCode, body);

        });
      }
    }
  }

  my( );
  return my;
}

// Provide public, testable API
engine.fetch = fetch;
engine.authorize = authorize;
engine.authorize_fetch = do_everything;
engine.Defaults = Defaults;
module.exports = engine;

function readENV(varName, defaultValue) {
    //for some reason Azure uses this prefix, maybe there is a good reason
    var value = process.env['CUSTOMCONNSTR_' + varName]
        || process.env['CUSTOMCONNSTR_' + varName.toLowerCase()]
        || process.env[varName]
        || process.env[varName.toLowerCase()];

    return value || defaultValue;
}

// If run from commandline, run the whole program.
if (!module.parent) {
  if (readENV('API_SECRET').length < Defaults.MIN_PASSPHRASE_LENGTH) {
    var msg = [ "API_SECRET environment variable should be at least"
              , Defaults.MIN_PASSPHRASE_LENGTH, "characters" ];
    var err = new Error(msg.join(' '));
    throw err;
    process.exit(1);
  }
  if (readENV('DEXCOM_ACCOUNT_NAME', '@').match(/\@/)) {
    var msg = [ "environment variable"
              , "DEXCOM_ACCOUNT_NAME should be"
              , "Dexcom Share user name, not an email address"];
    var err = new Error(msg.join(' '));
    throw err;
    process.exit(1);
  }
  var args = process.argv.slice(2);
  var config = {
    accountName: readENV('DEXCOM_ACCOUNT_NAME')
  , password: readENV('DEXCOM_PASSWORD')
  };
  var ns_config = {
    API_SECRET: readENV('API_SECRET')
  , endpoint: readENV('NS', 'https://' + readENV('WEBSITE_HOSTNAME'))
  };
  var interval = readENV('SHARE_INTERVAL', 60000 * 2.5);
  interval = Math.max(60000, interval);
  var fetch_config = { maxCount: readENV('maxCount', 1)
    , minutes: readENV('minutes', 1440)
  };
  var meta = {
    login: config
  , fetch: fetch_config
  , nightscout: ns_config
  , maxFailures: readENV('maxFailures', 3)
  , firstFetchCount: readENV('firstFetchCount', 3)
  };
  switch (args[0]) {
    case 'login':
      authorize(config, console.log.bind(console, 'login'));
      break;
    case 'fetch':
      config = { sessionID: args[1] };
      fetch(config, console.log.bind(console, 'fetched'));
      break;
    case 'testdaemon':
      setInterval(engine(meta), 2500);
      break;
    case 'run':
      // Authorize and fetch from Dexcom.
      do_everything(meta, function (err, glucose) {
        console.log('From Dexcom', err, glucose);
        if (glucose) {
          // Translate to Nightscout data.
          var entries = glucose.map(dex_to_entry);
          console.log('Entries', entries);
          if (ns_config.endpoint) {
            ns_config.entries = entries;
            // Send data to Nightscout.
            report_to_nightscout(ns_config, function (err, response, body) {
              console.log("Nightscout upload", 'error', err, 'status', response.statusCode, body);

            });
          }
        }
      });
      break;
    default:
      setInterval(engine(meta), interval);
      break;
      break;
  }
}

