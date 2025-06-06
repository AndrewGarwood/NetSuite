/**
 * @file src/server/authServer.ts
 */
import express, {Request, Response} from 'express';
import { Server } from 'node:http';
import axios from 'axios'; //~\node_modules\@types\axios\index.d.ts
import open from 'open';
import bodyParser from 'body-parser';
import { 
    STOP_RUNNING, TOKEN_DIR, SERVER_PORT, REDIRECT_URI, AUTH_URL, TOKEN_URL, 
    REST_CLIENT_ID as CLIENT_ID, REST_CLIENT_SECRET as CLIENT_SECRET,
    SCOPE, STATE, READLINE as rl, validatePath
} from '../config/env';
import { createUrlWithParams } from 'src/utils/api/url';
import { AxiosContentTypeEnum, TokenResponse, GrantTypeEnum } from './types';
import { writeObjectToJson as write, getCurrentPacificTime, readJsonFileAsObject as read, printConsoleGroup as print, calculateDifferenceOfDateStrings, TimeUnitEnum, } from 'src/utils/io';
import { mainLogger as mlog, errorLogger as elog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from 'src/config/setupLog';
import path from 'node:path';
import { existsSync } from 'node:fs';

/** `src/server/tokens/STEP2_tokens.json` */
const STEP2_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP2_tokens.json') as string;
/** `src/server/tokens/STEP3_tokens.json` */
const STEP3_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP3_tokens.json') as string;
const REFRESH_TOKEN_IS_AVAILABLE = true;
const REFRESH_TOKEN_IS_NOT_AVAILABLE = false;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

/**@see {@link Server} from `\node_modules\@types\node\http.d.ts`*/
let server: Server | any | undefined;

/**
 * @description close the {@link server}: {@link Server} listening for oauth 2.0 
 * callback if it is running.
 * @returns {void}
 */
export const CLOSE_SERVER = (): void => {
    if (server) {
        server.close(() => {
            // mlog.info('Server closed successfully.');
        });
    } else {
        // mlog.info('Server is not running or already closed.');
    }
}

/**  
 * @description **`OAUTH2 STEP 1`**. use {@link AUTH_URL}, with search params = { {@link REDIRECT_URI}, 
 * {@link CLIENT_ID}, {@link SCOPE}, {@link STATE} } to form authorization link and 
 * initiate OAuth callback to be resolved with the callback response's authorization code. 
 * @returns **`authCode`** = `Promise<string>` containing the authorization code received from the OAuth callback.
 */
export async function getAuthCode(): Promise<string> {
    return new Promise((resolve, reject) => {
        app.get('/callback', (req: Request, res: Response) => {
            const authCode = req.query.code as string;
            if (authCode) {
                res.send('Authorization code received. You can close this window.');
                resolve(authCode);
            } else {
                res.send('Authorization code not received. Please try again.');
                mlog.error('Error in authServer.ts getAuthCode(): Authorization code not received');
                reject(new Error('Authorization code not received'));
            }
        });
        server = app.listen(SERVER_PORT, () => {
            mlog.info(`Server is listening on port ${SERVER_PORT} for oauth callback -> Opening authURL...`);
            const authLink = createUrlWithParams(AUTH_URL, {
                response_type: 'code',
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                scope: SCOPE,
                state: require('crypto').randomBytes(32).toString('hex') as string,
            }).toString();
            open(authLink).catch((err) => {    
                mlog.error('Error in authServer.ts getAuthCode() when opening authURL:', err);
                reject(err);
            });
        });
    });
}
/**
 * @description **`OAUTH2 STEP 2`**. Exchange the authorization code for {@link TokenResponse}
 * @param authCode `string` - The authorization code received from the OAuth callback.
 * @returns **`response.data`** = `Promise<`{@link TokenResponse}`>` containing the access token and refresh token.
 */
export async function exchangeAuthCodeForTokens(
    authCode: string
): Promise<TokenResponse> {
    const params = generateAxiosParams(
        authCode, undefined, REDIRECT_URI
    ).toString();
    try {
        const response = await axios.post(TOKEN_URL, params, {
            headers: { 
                'Content-Type': AxiosContentTypeEnum.FORM_URLENCODED 
            },
            auth: { 
                username: CLIENT_ID, 
                password: CLIENT_SECRET 
            },
        });
        if (!response || !response.data) {
            mlog.error('Error in authServer.ts exchangeAuthCodeForTokens(): No response data received');
            throw new Error('No response data received after axios.post(...) in authServer.ts exchangeAuthCodeForTokens()');
        }
        return response.data as TokenResponse;
    } catch (error) {
        mlog.error('Error in authServer.ts exchangeAuthCodeForTokens():', error);
        throw new Error('Failed to exchange authorization code for token');
    }
}

/** 
 * @description **`OAUTH2 STEP 3`**. Use the refresh token to get a new {@link TokenResponse} with a new access token.
 * @param refreshToken `string` - The refresh token received from the initial token response.
 * @returns **`response.data`** = `Promise<`{@link TokenResponse}`>` containing the *`new`* access token and refresh token.
 */
export async function exchangeRefreshTokenForNewTokens(
    refreshToken: string
): Promise<TokenResponse> {
    const params = generateAxiosParams(undefined, refreshToken, REDIRECT_URI);
    try {
        const response = await axios.post(TOKEN_URL, params.toString(), {
            headers: { 
                'Content-Type': AxiosContentTypeEnum.FORM_URLENCODED 
            },
            auth: { 
                username: CLIENT_ID, 
                password: CLIENT_SECRET 
            },
        });
        return response.data as TokenResponse;
    } catch (error) {
        mlog.error('Error in authServer.ts exchangeRefreshTokenForNewTokens():', error);
        throw new Error('Failed to refresh access token');
    }
}



// --- Main Flow ---
/**
 * @description Initiates the OAuth 2.0 authorization flow using localhost {@link server}: {@link Server}.
 * - stores tokens locally in a json file at {@link STEP2_TOKENS_PATH} or {@link STEP3_TOKENS_PATH}. 
 * - use `refreshedTokens.access_token` in REST calls to deployed RESTlets.
 * @param initiateToRefresh `boolean` - If `true`, refresh the access token using the refresh token from the previous token response. Default is `false`.
 * - `false`: first call {@link getAuthCode}`()` to get the authorization code, then call {@link exchangeAuthCodeForTokens}`(code)` to get the access token.
 * - `true`: store return value of {@link read}`(pathToOriginalTokens).refresh_token`, then call {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` to get the new access token.
 * @param pathToOriginalTokens `string` - The file path to the original/previous token response JSON file. Default is '{@link TOKEN_DIR}/STEP2_tokens.json'.
 * @returns **`refreshedTokens`** = `Promise<`{@link TokenResponse} | undefined`>`
 * @throws {Error} if the file does not exist or if there is an error in the authentication flow.
 */
export async function initiateAuthFlow(
    initiateToRefresh: boolean=false, 
    pathToOriginalTokens: string=STEP2_TOKENS_PATH,
): Promise<TokenResponse> {
    // if (initiateToRefresh || !existsSync(pathToOriginalTokens)) {
    //     elog.error(`initiateAuthFlow(initiateToRefresh=true) - File does not exist: ${pathToOriginalTokens}`,);
    //     throw new Error(`File does not exist: ${pathToOriginalTokens}. Please run the authorization flow first, initiateAuthFlow(false)`);
    // }
    if (!initiateToRefresh) {
        // Step 1: Get the authorization code
        const authCode = await getAuthCode();
        CLOSE_SERVER();
        
        const tokenResponse: TokenResponse = await exchangeAuthCodeForTokens(authCode);
        tokenResponse.lastUpdated = getCurrentPacificTime();
        write(tokenResponse, STEP2_TOKENS_PATH);
        return tokenResponse;        
    } else { // Step 3: Refresh the token
        const tokenResponse = read(pathToOriginalTokens) as TokenResponse;
        if (!tokenResponse) {
            mlog.error('Error: authServer.initiateAuthFlow(true, _) TokenResponse not found.', 
            TAB + 'Please run the authorization flow first, initiateAuthFlow(false)');
            throw new Error('initiateAuthFlow(initiateToRefresh=true) TokenResponse not found. Please run the authorization flow first, initiateAuthFlow(false)');
        }
        if (!tokenResponse.refresh_token) {
            mlog.error('Error: authServer.initiateAuthFlow(true, _) refresh_token not found in TokenResponse.', 
            TAB + 'Please run the authorization flow first, initiateAuthFlow(false)');
            throw new Error('initiateAuthFlow(initiateToRefresh=true) refresh_token not found in TokenResponse. Please run the authorization flow first, initiateAuthFlow(false)');
        }
        const refreshedTokens: TokenResponse = await exchangeRefreshTokenForNewTokens(tokenResponse.refresh_token);
        refreshedTokens.lastUpdated = getCurrentPacificTime();
        write(refreshedTokens, STEP3_TOKENS_PATH);
        return refreshedTokens;
    }
}

/**5 minutes in milliseconds */
const FIVE_MINUTES = 5 * 60 * 1000; 
/**
 * requires existence of two constants: {@link STEP2_TOKENS_PATH}, {@link STEP3_TOKENS_PATH} -
 * @returns **`accessToken`** = `Promise<string>` - The access token to be used as `Bearer {accessToken}` in REST calls.
 * @throws {Error} if there is an error in the authentication flow or if the access token cannot be retrieved.
 */

/**
 * @returns **`accessToken`** = `Promise<string>` - The access token to be used as `Bearer {accessToken}` in REST calls.
 * @throws {Error} if there is an error in the authentication flow or if the access token cannot be retrieved.
 */
export async function getAccessToken(): Promise<string> {
    const STEP3_tokenResponse = read(STEP3_TOKENS_PATH) as TokenResponse;
    const STEP2_tokenResponse = read(STEP2_TOKENS_PATH) as TokenResponse;
    let accessToken = STEP3_tokenResponse.access_token || STEP2_tokenResponse.access_token ||  '';
    let refreshToken = STEP2_tokenResponse.refresh_token || '';
    const accessTokenIsExpired = localTokensHaveExpired(STEP3_TOKENS_PATH);
    const refreshTokenIsExpired = localTokensHaveExpired(STEP2_TOKENS_PATH);
    try {
        if ((!accessToken || accessTokenIsExpired) && refreshToken && !refreshTokenIsExpired) {
            mlog.info(
                '(Access token is undefined or expired) AND (Refresh token is available and has not yet expired).',
                TAB + '-> Initiating auth flow from exchangeRefreshTokenForNewTokens()...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_IS_AVAILABLE) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else if ((!accessToken || accessTokenIsExpired) && (!refreshToken || refreshTokenIsExpired)) {
            mlog.info(
                '(Access token is undefined or expired) AND (Refresh token is undefined or expired).', 
                TAB + '-> Initiating auth flow from the beginning...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_IS_NOT_AVAILABLE) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else {
            mlog.info(`Access token is valid. Proceeding with REST call...`);
        }
        CLOSE_SERVER();
        return accessToken as string;
    } catch (error) {
        mlog.error('Error in main.ts getAccessToken()', error);
        throw error;
    }
}

/**
 * 
 * @param filePath `string` - path to the local json file containing the {@link TokenResponse}, defaults to {@link STEP2_TOKENS_PATH} = `${OUTPUT_DIR}/STEP2_tokens.json`
 * @description Checks if the TokenResponse stored locally in a json file have expired by comparing the current time with the last updated time and the expiration time.
 * - `TokenResponse.expires_in`'s default value is 3600 seconds (1 hour) as per OAuth2.0 standard.
 * @returns **`haveExpired`** = `boolean` 
 * - `true` if a duration greater than or equal to the token lifespan (`TokenResponse.expires_in`) has passed since the last updated time, 
 * - `false` otherwise.
 */
export function localTokensHaveExpired(filePath: string=STEP2_TOKENS_PATH): boolean {
    try {
        const tokenResponse = read(filePath) as TokenResponse;
        if (!tokenResponse) {
            mlog.error('tokenResponse is undefined. Cannot check expiration.');
            return true;
        }
        if (!tokenResponse?.lastUpdated || !tokenResponse?.expires_in) {
            mlog.error('lastUpdated or expires_in key in local json file is undefined. Cannot check expiration.');
            return true;
        }
        const currentTime: string = getCurrentPacificTime();
        const lastUpdatedTime = String(tokenResponse?.lastUpdated);
        const tokenLifespan = Number(tokenResponse?.expires_in);
        const msDiff = calculateDifferenceOfDateStrings(
            lastUpdatedTime, currentTime, TimeUnitEnum.MILLISECONDS, true
        ) as number;
        const haveExpired = (msDiff != 0 && msDiff >= tokenLifespan * 1000 - FIVE_MINUTES);
        if (haveExpired) {
            mlog.info(`Local access token has reached or exceeded 5 minute buffer`,
                TAB + `  tokenPath: ${filePath}.`,
                TAB + `lastUpdated: ${lastUpdatedTime}`, 
                TAB + `currentTime: ${currentTime}`
            );
        }
        return haveExpired;
    } catch (error) {
        mlog.error('Error in localTokensHaveExpired(), return default (true):', error);
        return true;
    } 
}

/**
 * @param filePath `string`
 * @returns **`tokenResponse`** = {@link TokenResponse} - The token response containing the access token and refresh token.
 */
export async function validateTokens(
    filePath: string=STEP2_TOKENS_PATH
): Promise<TokenResponse> {
    if (!filePath || !existsSync(filePath)) {
        elog.error(`validateTokens() - File does not exist: ${filePath}`,
            TAB + `Boolean(filePath): ${Boolean(filePath)}`,
            TAB + `existsSync(filePath): ${existsSync(filePath)}`,
            NL + `Restarting auth flow from the beginning...`
        );
        return await initiateAuthFlow(REFRESH_TOKEN_IS_NOT_AVAILABLE);
    }
    const tokenResponse = read(filePath) as TokenResponse;
    const {
        lastUpdated, expires_in: expiresIn, refresh_token: refreshToken
    } = tokenResponse;
    if (!lastUpdated || !expiresIn || !refreshToken) {
        elog.error(`validateTokens() - TokenResponse is missing required properties: lastUpdated, expires_in, refresh_token`,
            TAB + `lastUpdated: ${lastUpdated}`,
            TAB + `expires_in: ${expiresIn}`,
            TAB + `refresh_token: ${refreshToken}`,
            NL + `Restarting auth flow from the beginning...`
        );
        return await initiateAuthFlow(REFRESH_TOKEN_IS_NOT_AVAILABLE) as TokenResponse;
    }

    const expiresAt = new Date(lastUpdated as string).getTime() + expiresIn*1000;
    if (Date.now() > expiresAt - FIVE_MINUTES) { // refresh if <5 min remaining
        return await exchangeRefreshTokenForNewTokens(refreshToken);
    }
    return tokenResponse;
}


// Helper to check if a token is valid for at least 5 more minutes
function isTokenValid(lastUpdated?: string, expiresIn?: number): boolean {
    if (!lastUpdated || !expiresIn) return false;
    const expiresAt = new Date(lastUpdated).getTime() + expiresIn * 1000;
    return Date.now() < (expiresAt - FIVE_MINUTES);
}

/**
 * @param code - The authorization code received from the OAuth callback. Is defined when this function is called in {@link exchangeAuthCodeForTokens}`(authCode)` 
 * - code !== undefined -> grant_type=authorization_code
 * @param refreshToken - The refresh token received from the initial token response. Is defined when this function is called in {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` 
 * - refreshToken !== undefined -> grant_type=refresh_token
 * @param redirectUri - The redirect URI used in the OAuth flow. Default is {@link REDIRECT_URI}.
 * @returns **`params`** = {@link URLSearchParams}
 * @reference {@link https://nodejs.org/api/url.html#class-urlsearchparams}
 */
function generateAxiosParams(
    code?: string, 
    refreshToken?: string, 
    redirectUri: string=REDIRECT_URI
): URLSearchParams {
    if (code && refreshToken) {
        throw new Error('Both code and refreshToken cannot be provided at the same time. Please provide only one.');
    }
    const params = new URLSearchParams({redirect_uri: redirectUri});
    if (code) {
        params.append('code', code);
        params.append('grant_type', GrantTypeEnum.AUTHORIZATION_CODE);
    } else if (refreshToken) {
        params.append('refresh_token', refreshToken);
        params.append('grant_type', GrantTypeEnum.REFRESH_TOKEN);
    }
    return params;
}