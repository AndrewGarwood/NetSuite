import express, {Request, Response} from 'express';
import { Server } from 'node:http';
import axios from 'axios'; //~\node_modules\@types\axios\index.d.ts
import open from 'open';
import bodyParser from 'body-parser';
import { 
    STOP_RUNNING, SERVER_PORT, REDIRECT_URI, AUTH_URL, TOKEN_URL, 
    REST_CLIENT_ID as CLIENT_ID, REST_CLIENT_SECRET as CLIENT_SECRET,
    SCOPE, STATE, RESTLET_URL_STEM, OUTPUT_DIR, READLINE as rl
} from '../config/env';
import { AxiosContentTypeEnum, TokenResponse, GrantTypeEnum } from './types';
import { writeObjectToJson, getCurrentPacificTime, readJsonFileAsObject, printConsoleGroup } from 'src/utils/io';


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

/**@see {@link Server} */
let server: any;

/**
 * @description close the {@link server}: {@link Server} listening for oauth 2.0 callback if it is running.
 * @returns {void}
 */
export const CLOSE_SERVER = (): void => {
    if (server) {
        server.close(() => {
            console.log('Server closed successfully.');
        });
    }
}

/**  
 * @description OAUTH2 STEP 1. use {@link AUTH_URL}, with search params {{@link REDIRECT_URI}, 
 * {@link CLIENT_ID}, {@link SCOPE}, {@link STATE}} to form authorization link and 
 * initiate OAuth callback to be resolved with the callback response's authorization code. 
 */
export async function getAuthCode(): Promise<string> {
    return new Promise((resolve, reject) => {
        app.get('/callback', (req: Request, res: Response) => {
            const authCode = req.query.code as string;
            // console.log('getAuthCode() req', req);

            if (authCode) {
                res.send('Authorization code received. You can close this window.');
                resolve(authCode);
            } else {
                res.send('Authorization code not received. Please try again.');
                console.error('Error in authServer.ts getAuthCode(): Authorization code not received');
                reject(new Error('Authorization code not received'));
            }
        });
        server = app.listen(SERVER_PORT, () => {
            console.log(`Server is listening on port ${SERVER_PORT} for oauth callback...`);
            const authLink = `${AUTH_URL}?response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${CLIENT_ID}&scope=${SCOPE}&state=${STATE}`;
            console.log(`Opening authURL: ${authLink}`);
            // open(authLink, {app: {name: 'chrome', arguments: ['--incognito']}}).catch((err) => {
            open(authLink).catch((err) => {    
                console.error('Error in authServer.ts getAuthCode() when opening authURL:', err);
                reject(err);
            });
        });
    });
}
/**
 * @description OAUTH2 STEP 2. Exchange the authorization code for {@link TokenResponse}
 * @param {string} authCode - The authorization code received from the OAuth callback.
 * @returns {Promise<TokenResponse>} .{@link TokenResponse} containing the access token and refresh token.
 */
export async function exchangeAuthCodeForTokens(authCode: string): Promise<TokenResponse> {
    console.log(`Begin exchangeAuthCodeForTokens() with authCode: ${authCode}`);
    const params = generateAxiosParams(authCode, undefined, REDIRECT_URI);
    console.log('\texchangeAuthCodeForToken() params:', params);
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
        // console.log('\texchangeAuthCodeForTokens() response:', response);
        if (!response || !response.data) {
            console.error('Error in authServer.ts exchangeAuthCodeForTokens(): No response data received');
            throw new Error('No response data received after axios.post(...) in authServer.ts exchangeAuthCodeForTokens()');
        }
        return response.data as TokenResponse;
    } catch (error) {
        console.error('Error in authServer.ts exchangeAuthCodeForTokens():', error);
        throw new Error('Failed to exchange authorization code for token');
    }
}

/** 
 * @description OAUTH2 STEP 3. Use the refresh token to get a new {@link TokenResponse} with a new access token.
 * @param {string} refreshToken - The refresh token received from the initial token response.
 * @returns {Promise<TokenResponse>} .{@link TokenResponse} containing the new access token and refresh token.
 */
export async function exchangeRefreshTokenForNewTokens(refreshToken: string): Promise<TokenResponse> {
    // console.log(`Begin exchangeRefreshTokenForNewTokens()`);
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
        // console.log('\t exchangeRefreshTokenForNewTokens() response.data:', response.data);
        return response.data as TokenResponse;
    } catch (error) {
        console.error('Error in authServer.ts exchangeRefreshTokenForNewTokens():', error);
        throw new Error('Failed to refresh access token');
    }
}

/**
 * @param code - The authorization code received from the OAuth callback. is defined when this function is called in {@link exchangeAuthCodeForTokens}`(authCode)` code != undefined -> grant_type=authorization_code
 * @param refreshToken - The refresh token received from the initial token response. is defined when this function is called in {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` refreshToken != undefined -> grant_type=refresh_token
 * @param redirectUri - The redirect URI used in the OAuth flow. Default is {@link REDIRECT_URI}.
 * @returns {URLSearchParams} params, see {@link URLSearchParams}
 * @reference https://nodejs.org/api/url.html#class-urlsearchparams
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



// --- Main Flow ---
/**
 * @description Initiates the OAuth 2.0 authorization flow using localhost server. 
 * - use refreshedTokens.access_token in REST calls to deployed RESTlets.
 * @property {boolean} [initiateToRefresh] - If `true`, refresh the access token using the refresh token from the previous token response. Default is `false`.
 * - `false`: first call {@link getAuthCode}`()` to get the authorization code, then call {@link exchangeAuthCodeForTokens}`(code)` to get the access token.
 * - `true`: store return value of {@link readJsonFileAsObject}`(pathToOriginalTokens).refresh_token`, then call {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` to get the new access token.
 * @property {string} [pathToOriginalTokens] - The file path to the original token response JSON file. Default is `'tokens.json'`.
 * @returns {Promise<TokenResponse | null>} `refreshedTokens` @see {@link TokenResponse}
 * 
 */
export async function initiateAuthFlow(
    initiateToRefresh: boolean=false, 
    pathToOriginalTokens: string=`${OUTPUT_DIR}/STEP2_tokens.json`,
): Promise<TokenResponse | null | undefined> {
    try {
        if (!initiateToRefresh) {
            // Step 1: Get the authorization code
            const authCode = await getAuthCode();
            writeObjectToJson(
                {lastUpdated: getCurrentPacificTime(), authCode: authCode}, 
                'STEP1_code.json', 
                OUTPUT_DIR
            );
            console.log('Step 1 Complete! Authorization authCode received. Closing server...');
            CLOSE_SERVER();
            
            // Step 2: Exchange code for tokens
            const tokenResponse: TokenResponse = await exchangeAuthCodeForTokens(authCode);
            tokenResponse.lastUpdated = getCurrentPacificTime();
            writeObjectToJson(
                tokenResponse,
                'STEP2_tokens.json',
                OUTPUT_DIR
            );
            printConsoleGroup({
                label: `Step 2 Complete!`, 
                details: [
                    `Refreshed TokenResponse received at ${getCurrentPacificTime()}`, 
                    `and saved to '${OUTPUT_DIR}/STEP2_tokens.json'`
                ]
            });
            return tokenResponse;        
        } else { // Step 3: Refresh the token
            const tokenResponse = readJsonFileAsObject(pathToOriginalTokens) as TokenResponse;
            if (!tokenResponse) {
                console.error('Error: authServer.initiateAuthFlow(true, _) TokenResponse not found. Please run the authorization flow first, initiateAuthFlow(false)');
                return null;
            }
            if (!tokenResponse.refresh_token) {
                console.error('Error: authServer.initiateAuthFlow(true, _) refresh_token not found in TokenResponse. Please run the authorization flow first, initiateAuthFlow(false)');
                return null;
            }
            const refreshedTokens: TokenResponse = await exchangeRefreshTokenForNewTokens(tokenResponse.refresh_token);
            refreshedTokens.lastUpdated = getCurrentPacificTime();
            writeObjectToJson(
                refreshedTokens,
                'STEP3_tokens.json',
                OUTPUT_DIR
            );
            printConsoleGroup({
                label: `Step 3 Complete!`, 
                details: [
                    `Refreshed TokenResponse received at ${getCurrentPacificTime()}`, 
                    `and saved to '${OUTPUT_DIR}/STEP3_tokens.json'`
                ]
            });
            return refreshedTokens;
        }
        // Step 4: Call RESTlet with the access token
    } catch (error) {
        console.error('Error in authServer.ts initiateAuthFlow():', error);
        return null;
    }
}
