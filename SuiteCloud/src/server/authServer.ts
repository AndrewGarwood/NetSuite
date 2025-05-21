import express, {Request, Response} from 'express';
import { Server } from 'node:http';
import axios from 'axios'; //~\node_modules\@types\axios\index.d.ts
import open from 'open';
import bodyParser from 'body-parser';
import { 
    STOP_RUNNING, TOKEN_DIR, SERVER_PORT, REDIRECT_URI, AUTH_URL, TOKEN_URL, 
    REST_CLIENT_ID as CLIENT_ID, REST_CLIENT_SECRET as CLIENT_SECRET,
    SCOPE, STATE, READLINE as rl
} from '../config/env';
import { createUrlWithParams } from 'src/utils/api/url';
import { AxiosContentTypeEnum, TokenResponse, GrantTypeEnum } from './types';
import { writeObjectToJson, getCurrentPacificTime, readJsonFileAsObject, printConsoleGroup as print, calculateDifferenceOfDateStrings, TimeUnitEnum, } from 'src/utils/io';
import { mainLogger as log } from 'src/config/setupLog';
import path from 'node:path';
const STEP2_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP2_tokens.json') as string;
const STEP3_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP3_tokens.json') as string;
const REFRESH_TOKEN_IS_AVAILABLE = true;
const REFRESH_TOKEN_IS_NOT_AVAILABLE = false;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

/**@see {@link Server} from ~\node_modules\@types\node\http.d.ts*/
let server: Server | any | undefined;

/**
 * @description close the {@link server}: {@link Server} listening for oauth 2.0 callback if it is running.
 * @returns {void}
 */
export const CLOSE_SERVER = (): void => {
    if (server) {
        server.close(() => {
            log.info('Server closed successfully.');
        });
    } else {
        log.info('Server is not running or already closed.');
    }
}

/**  
 * @description **`OAUTH2 STEP 1`**. use {@link AUTH_URL}, with search params {{@link REDIRECT_URI}, 
 * {@link CLIENT_ID}, {@link SCOPE}, {@link STATE}} to form authorization link and 
 * initiate OAuth callback to be resolved with the callback response's authorization code. 
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
                log.error('Error in authServer.ts getAuthCode(): Authorization code not received');
                reject(new Error('Authorization code not received'));
            }
        });
        server = app.listen(SERVER_PORT, () => {
            console.log(`Server is listening on port ${SERVER_PORT} for oauth callback -> Opening authURL...`);
            const authLink = createUrlWithParams( 
                AUTH_URL, {
                    response_type: 'code',
                    redirect_uri: REDIRECT_URI,
                    client_id: CLIENT_ID,
                    scope: SCOPE,
                    state: STATE as string,
            }).toString();
            open(authLink).catch((err) => {    
                log.error('Error in authServer.ts getAuthCode() when opening authURL:', err);
                reject(err);
            });
        });
    });
}
/**
 * @description **`OAUTH2 STEP 2`**. Exchange the authorization code for {@link TokenResponse}
 * @param {string} authCode - The authorization code received from the OAuth callback.
 * @returns {Promise<TokenResponse>} .{@link TokenResponse} containing the access token and refresh token.
 */
export async function exchangeAuthCodeForTokens(authCode: string): Promise<TokenResponse> {
    // console.log(`Begin exchangeAuthCodeForTokens() with authCode: ${authCode}`);
    const params = generateAxiosParams(authCode, undefined, REDIRECT_URI);
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
        if (!response || !response.data) {
            log.error('Error in authServer.ts exchangeAuthCodeForTokens(): No response data received');
            throw new Error('No response data received after axios.post(...) in authServer.ts exchangeAuthCodeForTokens()');
        }
        return response.data as TokenResponse;
    } catch (error) {
        log.error('Error in authServer.ts exchangeAuthCodeForTokens():', error);
        throw new Error('Failed to exchange authorization code for token');
    }
}

/** 
 * @description **`OAUTH2 STEP 3`**. Use the refresh token to get a new {@link TokenResponse} with a new access token.
 * @param {string} refreshToken - The refresh token received from the initial token response.
 * @returns {Promise<TokenResponse>} .{@link TokenResponse} containing the new access token and refresh token.
 */
export async function exchangeRefreshTokenForNewTokens(refreshToken: string): Promise<TokenResponse> {
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
        log.error('Error in authServer.ts exchangeRefreshTokenForNewTokens():', error);
        throw new Error('Failed to refresh access token');
    }
}



// --- Main Flow ---
/**
 * @description Initiates the OAuth 2.0 authorization flow using localhost {@link server}: {@link Server}. 
 * - use `refreshedTokens.access_token` in REST calls to deployed RESTlets.
 * @property {boolean} [initiateToRefresh] - If `true`, refresh the access token using the refresh token from the previous token response. Default is `false`.
 * - `false`: first call {@link getAuthCode}`()` to get the authorization code, then call {@link exchangeAuthCodeForTokens}`(code)` to get the access token.
 * - `true`: store return value of {@link readJsonFileAsObject}`(pathToOriginalTokens).refresh_token`, then call {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` to get the new access token.
 * @property {string} [pathToOriginalTokens] - The file path to the original/previous token response JSON file. Default is '{@link TOKEN_DIR}/STEP2_tokens.json'.
 * @returns {Promise<TokenResponse | null>} `refreshedTokens`: {@link TokenResponse}
 * 
 */
export async function initiateAuthFlow(
    initiateToRefresh: boolean=false, 
    pathToOriginalTokens: string=STEP2_TOKENS_PATH,
): Promise<TokenResponse | null | undefined> {
    try {
        if (!initiateToRefresh) {
            // Step 1: Get the authorization code
            const authCode = await getAuthCode();
            CLOSE_SERVER();
            
            const tokenResponse: TokenResponse = await exchangeAuthCodeForTokens(authCode);
            tokenResponse.lastUpdated = getCurrentPacificTime();
            writeObjectToJson(
                tokenResponse,
                undefined,
                STEP2_TOKENS_PATH
            );
            return tokenResponse;        
        } else { // Step 3: Refresh the token
            const tokenResponse = readJsonFileAsObject(pathToOriginalTokens) as TokenResponse;
            if (!tokenResponse) {
                log.error('Error: authServer.initiateAuthFlow(true, _) TokenResponse not found.', 
                    'Please run the authorization flow first, initiateAuthFlow(false)');
                return null;
            }
            if (!tokenResponse.refresh_token) {
                log.error('Error: authServer.initiateAuthFlow(true, _) refresh_token not found in TokenResponse.', 
                    'Please run the authorization flow first, initiateAuthFlow(false)');
                return null;
            }
            const refreshedTokens: TokenResponse = await exchangeRefreshTokenForNewTokens(tokenResponse.refresh_token);
            refreshedTokens.lastUpdated = getCurrentPacificTime();
            writeObjectToJson(
                refreshedTokens,
                undefined,
                STEP3_TOKENS_PATH
            );
            return refreshedTokens;
        }
    } catch (error) {
        console.error('Error in authServer.ts initiateAuthFlow():', error);
        return null;
    }
}

/**
 * @param code - The authorization code received from the OAuth callback. Is defined when this function is called in {@link exchangeAuthCodeForTokens}`(authCode)` 
 * - code !== undefined -> grant_type=authorization_code
 * @param refreshToken - The refresh token received from the initial token response. Is defined when this function is called in {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` 
 * - refreshToken !== undefined -> grant_type=refresh_token
 * @param redirectUri - The redirect URI used in the OAuth flow. Default is {@link REDIRECT_URI}.
 * @returns {URLSearchParams} params, see {@link URLSearchParams}
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

/**
 * 
 * @returns {Promise<string>} - The access token to be used as `Bearer {accessToken}` in REST calls.
 */
export async function getAccessToken(): Promise<string> {
    let accessToken = readJsonFileAsObject(STEP3_TOKENS_PATH)?.access_token || readJsonFileAsObject(STEP2_TOKENS_PATH)?.access_token ||  '';
    let refreshToken = readJsonFileAsObject(STEP2_TOKENS_PATH)?.refresh_token || '';
    const accessTokenIsExpired = localTokensHaveExpired(STEP3_TOKENS_PATH);
    const refreshTokenIsExpired = localTokensHaveExpired(STEP2_TOKENS_PATH);
    try {
        if ((!accessToken || accessTokenIsExpired) && refreshToken && !refreshTokenIsExpired) {
            log.info(
                'Access token is expired or undefined, Refresh token is available.',
                'Initiating auth flow from exchangeRefreshTokenForNewTokens()...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_IS_AVAILABLE) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else if ((!accessToken || accessTokenIsExpired) && (!refreshToken || refreshTokenIsExpired)) {
            log.info(
                'Access token is expired or undefined. Refresh token is also undefined.', 
                'Initiating auth flow from the beginning...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow() as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else {
            log.info('Access token is valid. Proceeding with RESTlet call...');
        }
        CLOSE_SERVER();
        return accessToken as string;
    } catch (error) {
        log.error('Error in main.ts getAccessToken()', error);
        throw error;
    }
}

/**
 * 
 * @param filePath - path to the local json file containing the {@link TokenResponse}, defaults to {@link STEP2_TOKENS_PATH} = `${OUTPUT_DIR}/STEP2_tokens.json`
 * @description Checks if the TokenResponse stored locally in a json file have expired by comparing the current time with the last updated time and the expiration time.
 * - `TokenResponse.expires_in`'s default value is 3600 seconds (1 hour) as per OAuth2.0 standard.
 * @returns {boolean} `true` if a duration greater than or equal to the token lifespan (`TokenResponse.expires_in`) has passed since the last updated time, `false` otherwise.
 */
export function localTokensHaveExpired(filePath: string=STEP2_TOKENS_PATH): boolean {
    try {
        const tokenResponse = readJsonFileAsObject(filePath) as TokenResponse;
        if (!tokenResponse) {
            log.error('tokenResponse is undefined. Cannot check expiration.');
            return true;
        }
        if (!tokenResponse?.lastUpdated || !tokenResponse?.expires_in) {
            log.error('lastUpdated or expires_in key in local json file is undefined. Cannot check expiration.');
            return true;
        }
        const currentTime: string = getCurrentPacificTime();
        const lastUpdatedTime = String(tokenResponse?.lastUpdated);
        const tokenLifespan = Number(tokenResponse?.expires_in);
        const msDiff = calculateDifferenceOfDateStrings(lastUpdatedTime, currentTime, TimeUnitEnum.MILLISECONDS, true) as number;
        const haveExpired = (msDiff != 0 && msDiff >= tokenLifespan * 1000);
        return haveExpired;
    } catch (error) {
        log.error('Error in localTokensHaveExpired(), return default (true):', error);
        return true;
    } 
}