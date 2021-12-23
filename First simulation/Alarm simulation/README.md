 Mock OAuth2 Server

This project is an OAuth2 server implementation for testing purposes (see [RFC 6749](https://tools.ietf.org/html/rfc6749) 
for a description of OAuth2). It's useful for testing client applications that authenticate to other services via OAuth. 
Rather than using the external service, which requires API keys and credentials for users, you can use this service as
a stub for the external service. It accepts any email address and password combination. It does not provide any sort
of long term storage of access or refresh tokens.

## Using for ST Schema Development

To configure a SmartThings ST Schema connector to use this service, remix the service and set the `EXPECTED_CLIENT_ID`
and `EXPECTED_CLIENT_SECRET` variables in the `.env` file to values of you choosing. You don't have to set these values
but doing so will allow you to restrict the use of your server to only your ST schema integrations. 

When the server restarts after you edit the variable it will log the values you should use to configure the ST Schema
connector in the [SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace/).
The default values, if you don't specify your own client ID and 
secret, are:
```
Client ID:         dummy-client-id
Client Secret:     dummy-client-secret
Authorization URI: /oauth/login
Refresh Token URL: /oauth/token
```

## Configuration

List of environment variables:

|Variable name|Default value|Description|
|--------------|------------|----------|
|`EXPECTED_CLIENT_ID`|`dummy-client-id`|The [client identifier](https://tools.ietf.org/html/rfc6749#section-2.2) which your SUT should send to the OAuth2 server in authentication requests and access token requests.|
|`EXPECTED_CLIENT_SECRET`|`dummy-client-secret`|The [client secret](https://tools.ietf.org/html/rfc6749#section-2.3.1) which your SUT should send to the OAuth2 server in access token requests.|
|`AUTH_REQUEST_PATH`|`/oauth/login`|The HTTP path of the OAuth2 [authorization endpoint](https://tools.ietf.org/html/rfc6749#section-3.1) which the fake server listens on|
|`ACCESS_TOKEN_REQUEST_PATH`|`/oauth/token`|The HTTP path of the [access token request](https://tools.ietf.org/html/rfc6749#section-4.1.3) which the fake server listens on|
|`PERMITTED_REDIRECT_URLS`|`https://c2c-us.smartthings.com/oauth/callback, https://c2c-eu.smartthings.com/oauth/callback, https://c2c-ap.smartthings.com/oauth/callback`|comma-separated list of permitted [redirection endpoints](https://tools.ietf.org/html/rfc6749#section-3.1.2)|

To modify any of these variable edit the `.env` file in this project