import express, {Request, Response} from 'express';
import { Server } from 'node:http';
import axios from 'axios';
import open from 'open';
import bodyParser from 'body-parser';
import { 
    STOP_RUNNING, SERVER_PORT, REDIRECT_URI, AUTH_URL, TOKEN_URL, 
    REST_CLIENT_ID as CLIENT_ID, REST_CLIENT_SECRET as CLIENT_SECRET,
    SCOPE, STATE, OUTPUT_DIR
} from '../config/env';
import { AxiosContentTypeEnum, TokenResponse } from '../types/auth/Auth';
import { writeObjectToJson, getCurrentPacificTime, readJsonFileAsObject, printConsoleGroup } from 'src/utils/io/io_utils';


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
// Add this line to serve static files from the public directory
// app.use(express.static(path.join(__dirname, 'public')));

/**@see {@link Server} */
let server: any;

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
            writeObjectToJson(
                {authCode: authCode}, 
                'ouath2_step1_authCode.json', 
                OUTPUT_DIR
            );
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
        console.log('\texchangeAuthCodeForTokens() response:', response);
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
export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
    console.log(`Begin refreshTokens()`);
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
        console.log('\trefreshTokens() response:', response);
        return response.data as TokenResponse;
    } catch (error) {
        console.error('Error in authServer.ts refreshTokens():', error);
        throw new Error('Failed to refresh access token');
    }
}

/**
 * @param code - The authorization code received from the OAuth callback. is defined when this function is called in {@link exchangeAuthCodeForTokens}(authCode) code != undefined -> grant_type=authorization_code
 * @param refreshToken - The refresh token received from the initial token response. is defined when this function is called in {@link refreshTokens}(refreshToken) refreshToken != undefined -> grant_type=refresh_token
 * @param redirectUri - The redirect URI used in the OAuth flow. Default is {@link REDIRECT_URI}.
 * @returns {URLSearchParams} params, see {@link URLSearchParams}
 * @reference https://nodejs.org/api/url.html#class-urlsearchparams
 */
function generateAxiosParams(
    code?: string, 
    refreshToken?: string, 
    redirectUri: string=REDIRECT_URI
): URLSearchParams {
    const params = new URLSearchParams({redirect_uri: redirectUri});
    if (code) {
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
    } else if (refreshToken) {
        params.append('refresh_token', refreshToken);
        params.append('grant_type', 'refresh_token');
    }
    return params;
}



// --- Main Flow ---
/**
 * @description Initiates the OAuth 2.0 authorization flow using localhost server. 
 * - use refreshedTokens.access_token in REST calls to deployed RESTlets.
 * @property {boolean} initiateToRefresh - If true, refresh the access token using the refresh token from the previous token response.
 * @property {string} previousTokenResponseFilePath - The file path to the previous token response JSON file. Default is 'ouath2_step2_tokenResponse.json'.
 * @returns {Promise<TokenResponse | null>} refreshedTokens @see {@link TokenResponse}
 * 
 */
export async function initiateAuthFlow(
    initiateToRefresh: boolean, 
    previousTokenResponseFilePath: string=`${OUTPUT_DIR}/ouath2_step2_tokenResponse.json`,
): Promise<TokenResponse | null | undefined> {
    try {
        if (!initiateToRefresh) {
            // Step 1: Get the authorization code
            const code = await getAuthCode();
            // writeObjectToJson(
            //     {authCode: code}, 
            //     'ouath2_step1_authCode.json', 
            //     OUTPUT_DIR
            // );
            if (server) server.close();
            console.log('Step 1 Complete! Authorization code received. Closing server...');
            
            // Step 2: Exchange code for tokens
            let tokenResponse: TokenResponse = await exchangeAuthCodeForTokens(code);
            writeObjectToJson(
                tokenResponse,
                'ouath2_step2_tokenResponse.json',
                OUTPUT_DIR
            );
            printConsoleGroup({
                label: `Step 2 Complete!`, 
                logStatements: [
                    `Refreshed TokenResponse received at ${getCurrentPacificTime()}`, 
                    `and saved to '${OUTPUT_DIR}/ouath2_step2_tokenResponse.json'`
                ]
            });        
        } else { // Step 3: (Optional) Refresh the token if desired
            let tokenResponse = readJsonFileAsObject(previousTokenResponseFilePath) as TokenResponse;
            if (!tokenResponse) {
                console.error('Error: TokenResponse not found. Please run the authorization flow first, initiateAuthFlow(false)');
                return null;
            }
            const refreshedTokens: TokenResponse = await refreshTokens(tokenResponse.refresh_token);
            writeObjectToJson(
                refreshedTokens,
                'ouath2_step3_refreshedTokens.json',
                OUTPUT_DIR
            );
            printConsoleGroup({
                label: `Step 3 Complete!`, 
                logStatements: [
                    `Refreshed TokenResponse received at ${getCurrentPacificTime()}`, 
                    `and saved to '${OUTPUT_DIR}/ouath2_step3_refreshedTokens.json'`
                ]
            });
            return refreshedTokens;
        }
        // Step 4: Call RESTlet with the access token. see '../api.ts' and '../main.ts'
    } catch (error) {
        console.error('Error in authServer.ts initiateAuthFlow():', error);
        return null;
    }
}
