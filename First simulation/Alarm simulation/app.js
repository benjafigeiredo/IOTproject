// App with oauth and SmartThings connector funcionalities. 
"use strict";

const express = require("express"); // To running a server
const morgan = require("morgan"); // To generate specific logs for any request
const fs = require("fs"); // To interacting with the File System (read files, for example)
const _ = require("underscore"); // To facilitate the data structures management. 
const session = require("express-session"); // To saving <key, value> form data 
const randomstring = require("randomstring"); // To generate tokens
const bodyParser = require("body-parser"); // To parse and access to JSON data

const homePage = _.template(fs.readFileSync("./index.ejs").toString()); // homePage
const invalidPage = _.template(fs.readFileSync("./invalid.ejs").toString()); // invalidPage
const ui = _.template(fs.readFileSync("./input.ejs").toString()); // form to authentication 

const app = express();

// Middleware: intermediate state between local server and SmartThings cloud 

// Mock the ST-schema Discovery and refresh response (st-schema)
// for this Glitch webhook connector example
let discoveryResponse = require("./discoveryResponse.json");
const refreshResponse = require("./refreshResponse.json");

// Helper functions from ST-schema package to build st-schema responses
const {partnerHelper, CommandResponse} = require("st-schema");
const stPartnerHelper = new partnerHelper({}, {});

// stablish log format 
app.use(morgan(":method :url :status Authorization: :req[authorization] Debug info: :res[x-debug] Redirect: :res[location]"));

// stablish json language as communication type, also translate to friendly-js understanding
app.use(bodyParser.json({type: 'application/json'}));

// parsing bodies from URL data. 
app.use(bodyParser.urlencoded({ extended: false }));

// stablish client session with security parameters. 
app.use(session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: {secure: false}
}))

/* authentication variables (defined in .env or as default) */
const EXPECTED_CLIENT_ID = process.env.EXPECTED_CLIENT_ID || "dummy-client-id";
const EXPECTED_CLIENT_SECRET = process.env.EXPECTED_CLIENT_SECRET || "dummy-client-secret";
const AUTH_REQUEST_PATH = process.env.AUTH_REQUEST_PATH || "/oauth/login";
const ACCESS_TOKEN_REQUEST_PATH = process.env.ACCESS_TOKEN_REQUEST_PATH || "/oauth/token";
const ACCESS_TOKEN_PREFIX = process.env.ACCESS_TOKEN_PREFIX;
const PERMITTED_REDIRECT_URLS = process.env.PERMITTED_REDIRECT_URLS ? 
      process.env.PERMITTED_REDIRECT_URLS.split(",") : 
      ["https://c2c-us.smartthings.com/oauth/callback",
      "https://c2c-eu.smartthings.com/oauth/callback",
      "https://c2c-ap.smartthings.com/oauth/callback",
      "https://c2c-globald.stacceptance.com/oauth/callback",
      "https://c2c-globals.smartthingsgdev.com/oauth/callback",
      "https://c2c-globald.smartthingsgdev.com/oauth/callback",
      "https://c2c-globala.stacceptance.com/oauth/callback",
      "https://api.smartthings.com/oauth/callback"];

const code2token = {};
const refresh2personData = {};
const authHeader2personData = {};
const id_token2personData = {};
let redirect_uri;

/**************************************** oauth functions *********************************************/
// get current time
function now() 
{
    return Math.round(new Date().valueOf() / 1000);
}

// show error message 
function errorMsg(descr, expected, actual) 
{
    return "expected " + descr + ": " + expected + ", actual: " + actual;
}

// validate client id. If the SmartThings connector client id setted its the same than .env client id, then returns true. 
function validateClientId(actualClientId, res) 
{
    if (actualClientId === EXPECTED_CLIENT_ID)
    {
        return true;
    }
    res.writeHead(400, 
        {
            "X-Debug": errorMsg("client_id", EXPECTED_CLIENT_ID, actualClientId)
        });
    res.end();
    return false;
}


// to validate the authorization header. 
function validateAuthorizationHeader(header, res) 
{
    header = header.trim();
    if (!header.startsWith("Basic ")) 
    {
        return false;
    }
    header = header.substring("Basic ".length).trim();
    const decoded = new Buffer(header, "base64").toString("ascii");
    if (decoded === "") 
    {
        return false;
    }
    const segments = decoded.split(":");
    if (segments.length != 2) 
    {
        return false;
    }
    if (segments[0] !== EXPECTED_CLIENT_ID)
    {
        return false;
    }
    if (segments[1] !== EXPECTED_CLIENT_SECRET) 
    {
        return false;
    }
    return true;
}


// to validate the access token request
function validateAccessTokenRequest(req, res) 
{
    console.log('validateAccessTokenRequest', JSON.stringify(req.body, null, 2))
    let success = true, msg;

    if (req.body.grant_type !== "authorization_code" && req.body.grant_type !== "refresh_token") 
    {
        success = false;
        msg = errorMsg("grant_type", "authorization_code or refresh_token", req.body.grant_type);
    }

    if (req.body.grant_type === "refresh_token") 
    {
        let personData = refresh2personData[req.body.refresh_token];
        if (personData === undefined) 
        {
            success = false;
            msg = "invalid refresh token";
        }
    }

    if (!validateClientId(req.body.client_id, res)) 
    {
        success = false;
    }

    if (req.body.client_secret !== EXPECTED_CLIENT_SECRET) 
    {
        success = false;
        msg = errorMsg("client_secret", EXPECTED_CLIENT_SECRET, req.body.client_secret);
    }
    
    if (redirect_uri !== req.body.redirect_uri) 
    {
        success = false;
        msg = errorMsg("redirect_uri", req.session.redirect_uri, req.body.redirect_uri);
    }

    // send the error flow to front
    if (!success) 
    {
        const params = {};
        if (msg) 
        {
        params["X-Debug"] = msg;
        }
        res.writeHead(401, params);
    }
    return success;
}

// To create a token 
function createToken(name, email, expires_in, client_state) 
{
    const code = "C-" + randomstring.generate(3);
    const accesstoken = ACCESS_TOKEN_PREFIX + randomstring.generate(6);
    const refreshtoken = "REFT-" + randomstring.generate(6);
    const id_token = "IDT-" + randomstring.generate(6);
    const token = 
    {
        access_token: accesstoken,
        expires_in: expires_in,
        refresh_token: refreshtoken,
        id_token: id_token,
        state: client_state,
        token_type: "Bearer"
    };
    id_token2personData[id_token] = authHeader2personData["Bearer " + accesstoken] = 
    {
        email: email,
        email_verified: true,
        name: name
    };
    code2token[code] = token;
    refresh2personData[refreshtoken] = 
    {
        name: name,
        email: email,
        expires_in: expires_in
    };
    return code;
}


// Validate authentication 
function validateAuthPageRequest(req, res) 
{
    const errorMessages = [];
    if (req.query.client_id !== EXPECTED_CLIENT_ID) 
    {
        errorMessages.push(`Invalid client_id, received '${req.query.client_id}'`)
    }

    if (req.query.response_type !== "code") 
    {
        errorMessages.push( `Invalid response type, received '${req.query.response_type}' expected 'code'`)
    }

    // if (!(PERMITTED_REDIRECT_URLS.includes(req.query.redirect_uri))) {
    //   errorMessages.push(`Invalid redirect_uri, received '${req.query.redirect_uri}' expected one of ${PERMITTED_REDIRECT_URLS.join(', ')}`)
    // }

    if (errorMessages.length > 0) 
    {
        res.status(401);
        res.send(invalidPage({
        errorMessages: errorMessages
        }));
        return false
    }
    return true
}

/******************************** end oauth functions *****************************************/ 

/******************************* st-connector functions ***************************************/


// Handle discovery request interaction type from SmartThings
function discoveryRequest(requestId) 
{
    discoveryResponse.headers.requestId = requestId
    console.log(discoveryResponse);
    return discoveryResponse
}


// Handle command request interaction type from SmartThings
function commandRequest(requestId, devices) 
{
    let response = new CommandResponse(requestId)
    devices.map(({ externalDeviceId, deviceCookie, commands }) => 
    {
        const device = response.addDevice(externalDeviceId); // , deviceCookie
        stPartnerHelper.mapSTCommandsToState(device, commands)
    });
    console.log("response: %j", response);
    return response;
}


// Handle state refresh request interaction type from SmartThings
function stateRefreshRequest(requestId, devices) 
{
    let response = { "headers": { "schema": "st-schema", "version": "1.0", "interactionType": "stateRefreshResponse", "requestId": requestId }, "deviceState": [] }
    devices.map(({ externalDeviceId, deviceCookie }) => {
        console.log("externalDeviceId: ", externalDeviceId)
        let deviceResponse = refreshResponse[externalDeviceId]
        response.deviceState.push(deviceResponse)
        console.log("deviceResponse: ", deviceResponse)
    });
    
    console.log(response);
    return response;
}

// Mock method to log out the callback credentials issued by SmartThings
function grantCallbackAccess(callbackAuthentication) 
{
  console.log("grantCallbackAccess token is:", callbackAuthentication.code)
  console.log("grantCallbackAccess clientId is:", callbackAuthentication.clientId)
  return {}
}

/****************************** end st-connector functions ********************************************/ 


/*********************************** oauth pages/paths ************************************************/ 


// main page
app.get('/', (req, res) => 
{
    res.send(homePage({
        query: req.query
    }));
});


// authentication request (form) page
app.get(AUTH_REQUEST_PATH, (req, res) => 
{
    if (validateAuthPageRequest(req, res)) 
    {
        req.session.redirect_uri = req.query.redirect_uri;
        redirect_uri = req.query.redirect_uri;
        if (req.query.state) 
        {
            req.session.client_state = req.query.state;
        }
        res.send(ui({
            query: req.query,
            username: `${randomstring.generate(4)}@${randomstring.generate(4)}.com`,
            password: randomstring.generate(4)
        }));
    }
    res.end();
});

app.get("/login-as", (req, res) => 
{
    const code = createToken(req.query.name, req.query.email, req.query.expires_in, req.session.client_state);
    if (req.session.redirect_uri) 
    {
        let redirectUri = req.session.redirect_uri;
        let location = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=${code}`;
        if (req.session.client_state) 
        {
            location += "&state=" + req.session.client_state;
        }
        res.writeHead(307, {"Location": location});
        res.end();
    }
});

app.post(ACCESS_TOKEN_REQUEST_PATH, (req, res) => 
{
    if (validateAccessTokenRequest(req, res)) 
    {
        let code = null;
        if (req.body.grant_type === "refresh_token") 
        {
            const refresh = req.body.refresh_token;
            const personData = refresh2personData[refresh];
            code = createToken(personData.name, personData.email, personData.expires_in, null);
            delete refresh2personData[refresh];
        } 
        else 
        {
            code = req.body.code;
        }
        const token = code2token[code];
        if (token !== undefined) 
        {
            console.log("access token response body: ", token);
            res.send(token);
        }
    }
    res.end();
});

/***************************************** end oauth pages/paths *********************************************/ 

/*************************************** st-connector pages/paths ********************************************/

// [START Action]
app.post('/', function (req, res) 
{
    console.log('Request received: ' + JSON.stringify(req.body))
    
    let response
    const {headers, authentication, devices, callbackAuthentication, globalError, deviceState} = req.body
    const {interactionType, requestId} = headers;
    console.log("request type: ", interactionType);
    try {
        switch (interactionType) 
        {
            // discoveryRequest: ST request a list of devices. After this interaction, comes stateRefreshRequest
            case "discoveryRequest":
                response = discoveryRequest(requestId)
                break
            // ST requests that you issue commands for the specific devices 
            case "commandRequest":
                response = commandRequest(requestId, devices)
                break
            // ST requests the states of the indicated devices
            case "stateRefreshRequest":
                response = stateRefreshRequest(requestId, devices)
                break
            // callbacks allow your cloud connector to push a device's state to ST.
            // reciprocal Acess Tokens callbacks
            // grantCallbackAccess: Originates from ST. involved in initial token exchange
            case "grantCallbackAccess":
                response = grantCallbackAccess(callbackAuthentication)
                break
            // accessTokenRequest: Originates from our cloud. (implemented above, in the oauth section). Involved in initial token exchange.
            // accessTokenResponse: originates from ST. Involved in initial token exchange + refreshing the ST token.
            // refreshAcessTokens: Originates from your Cloud Connector. Involved in refreshing the SmartThings token.
            // another callbacks
            // stateCallback: is used by your Cloud Connector to update the state of a device that changed as a result of an interaction that did not originate from SmartThings.
            // discoveryCallback: allows your Cloud Connector to perform on-demand discovery.
            // integrationDeleted: notify when a connected service is deleted. 
            case "integrationDeleted":
                console.log("integration to SmartThings deleted");
                break
            // interactionResult notifies you of where issues were found in the response on a request from ST Schema.
            default:
                response = "error. not supported interactionType " + interactionType
                console.log(response)
                break;
        }
    } 
    catch (ex) 
    {
        console.log("failed with ex", ex)
    }
    res.send(response)

})



app.post('/command', (req, res) => 
{
    deviceStates[req.body.attribute] = req.body.value;
    for (const accessToken of Object.keys(accessTokens)) {
      const item = accessTokens[accessToken];
      const updateRequest = new StateUpdateRequest(process.env.ST_CLIENT_ID, process.env.ST_CLIENT_SECRET);
      const deviceState = [
        {
          externalDeviceId: 'external-device-1',
          states: [
            {
              component: 'main',
              capability: req.body.attribute === 'level' ? 'st.switchLevel' : 'st.switch',
              attribute: req.body.attribute,
              value: req.body.value
            }
          ]
        }
      ];
      updateRequest.updateState(item.callbackUrls, item.callbackAuthentication, deviceState)
    }
    res.send({});
    res.end()
  });

// export a module (when you access to the module, you access to the object and attributes)
module.exports = 
{
    app: app,
    EXPECTED_CLIENT_ID: EXPECTED_CLIENT_ID,
    EXPECTED_CLIENT_SECRET: EXPECTED_CLIENT_SECRET,
    AUTH_REQUEST_PATH : AUTH_REQUEST_PATH,
    ACCESS_TOKEN_REQUEST_PATH : ACCESS_TOKEN_REQUEST_PATH,
    ACCESS_TOKEN_PREFIX: ACCESS_TOKEN_PREFIX
};

/******************************** end st-connector pages/paths *************************************/