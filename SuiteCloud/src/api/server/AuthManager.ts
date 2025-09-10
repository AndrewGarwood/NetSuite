/**
 * @file src/api/server/AuthManager.ts
 */
import express, { Request, Response } from "express";
import { Server } from "node:http";
import axios from "axios";
import open from "open";
import bodyParser from "body-parser";
import path from "node:path";
import fs from "node:fs";
import { 
    SERVER_PORT, REDIRECT_URI, AUTH_URL, TOKEN_URL, 
    REST_CLIENT_ID as CLIENT_ID, REST_CLIENT_SECRET as CLIENT_SECRET,
    SCOPE, STATE, getProjectFolders,
    isEnvironmentInitialized
} from "../../config/env";
import { createUrlWithParams } from "../url";
import { AxiosContentTypeEnum, TokenResponse, GrantTypeEnum, AuthOptions, AuthState, PendingRequest, TokenMetadata, TokenStatus } from "./types";
import { 
    indentedStringify,
    writeObjectToJsonSync as write 
} from "typeshi/dist/utils/io/writing";
import { 
    isFile,
    readJsonFileAsObject as read
} from "typeshi/dist/utils/io/reading";
import { getCurrentPacificTime, calculateDifferenceOfDateStrings, TimeUnitEnum } from "typeshi/dist/utils/io/dateTime";
import { 
    mainLogger as mlog, apiLogger as alog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    simpleLogger as slog
} from "../../config/setupLog";
import * as validate from "@typeshi/argumentValidation";
import { getSourceString } from "@typeshi/io";
import { extractFileName } from "@typeshi/regex";
import { isInteger, isNonEmptyString, isNumeric } from "@typeshi/typeValidation";
import { isTokenResponse } from "@api/server/types/TokenResponse.TypeGuards";
import crypto from "crypto";

export { AuthManager };

const F = extractFileName(__filename);

// ============================================================================
// CONSTANTS
// ============================================================================
/**
 * Default {@link AuthOptions} for {@link AuthManager.options}
 * @property {number} maxRetries = `3`
 * @property {number} retryDelayMs = `1000`
 * @property {number} tokenBufferMs = `5 * 60 * 1000` // 5 minutes
 * @property {number} validationIntervalMs = `30 * 1000` // 30 seconds
 * @property {boolean} enableQueueing = `true`
 */
const DEFAULT_AUTH_OPTIONS: Required<AuthOptions> = {
    maxRetries: 3,
    retryDelayMs: 1000,
    tokenBufferMs: 5 * 60 * 1000, // 5 minutes
    validationIntervalMs: 30 * 1000, // 30 seconds
    enableQueueing: true
};
// const TOKEN_DIR = path.join(__dirname, 'tokens');
// /** = `'__dirname/tokens/STEP2_tokens.json'`  */
// const STEP2_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP2_tokens.json');
// /** = `'__dirname/tokens/STEP3_tokens.json'` */
// const STEP3_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP3_tokens.json');
// /** = `'__dirname/tokens/token_metadata.json'` */
// const TOKEN_METADATA_PATH = path.join(TOKEN_DIR, 'token_metadata.json');
const STEP2_FILENAME = 'STEP2_tokens.json';
const STEP3_FILENAME = 'STEP3_tokens.json';
const METADATA_FILENAME = 'token_metadata.json';

// ============================================================================
// CLASS: AUTH MANAGER
// ============================================================================

class AuthManager {
    private state: AuthState = AuthState.IDLE;
    private server: Server | null = null;
    private app: express.Application;
    private pendingRequests: PendingRequest[] = [];
    private lastTokenResponse: TokenResponse | null = null;
    private tokenMetadata: TokenMetadata | null = null;
    private validationTimer: NodeJS.Timeout | null = null;
    private options: Required<AuthOptions>;

    constructor(options: AuthOptions = {}) {
        this.options = { ...DEFAULT_AUTH_OPTIONS, ...options };
        this.app = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.initializeTokenMetadata();
        this.startTokenValidation();
    }

    // ============================================================================
    // TOKEN METADATA MANAGEMENT
    // ============================================================================
    /**
     * @returns **`tokDir`** `string`
     */
    private getTokenDir(): string {
        const source = getSourceString(__filename, this.getTokenDir.name);
        if (!isEnvironmentInitialized()) {
            throw new Error([`${source} environment not initialized`,
                ` > unable to get token dir`,
                ` > call initializeEnvironment() first`
            ].join(TAB));
        }
        return getProjectFolders().tokDir;
    }

    private initializeTokenMetadata(): void {
        const source = getSourceString(__filename, this.initializeTokenMetadata.name);
        const metaPath = path.join(this.getTokenDir(), METADATA_FILENAME);
        try {
            if (isFile(metaPath)) {
                this.tokenMetadata = read(metaPath) as TokenMetadata;
            } else {
                this.tokenMetadata = {
                    status: TokenStatus.MISSING,
                    expiresAt: 0,
                    lastValidated: 0,
                    refreshCount: 0,
                    errorCount: 0
                };
                this.saveTokenMetadata();
            }
        } catch (error) {
            mlog.warn(`${source} Failed to load token metadata, error:`, error);
            this.tokenMetadata = {
                status: TokenStatus.MISSING,
                expiresAt: 0,
                lastValidated: 0,
                refreshCount: 0,
                errorCount: 0
            };
            this.saveTokenMetadata();
        }
    }
    /** tries to {@link write}`(this.tokenMetadata, `{@link TOKEN_METADATA_PATH}`);`*/
    private saveTokenMetadata(): void {
        const source = getSourceString(__filename, this.saveTokenMetadata.name);
        const metaPath = path.join(this.getTokenDir(), METADATA_FILENAME);
        try {
            if (this.tokenMetadata) {
                write(this.tokenMetadata, metaPath);
            }
        } catch (error) {
            mlog.error(`${source} Failed to save token metadata`, error);
        }
    }
    /** assigns new values to {@link tokenMetadata} then calls {@link saveTokenMetadata} */
    private updateTokenMetadata(updates: Partial<TokenMetadata>): void {
        if (this.tokenMetadata) {
            Object.assign(this.tokenMetadata, updates);
            this.tokenMetadata.lastValidated = Date.now();
            this.saveTokenMetadata();
        }
    }

    // ========================================================================
    // TOKEN VALIDATION AND STATUS
    // ========================================================================
    /**
     * @param token {@link TokenResponse}
     * @returns **`tokenStatus`** - {@link TokenStatus}
     * - {@link TokenStatus.VALID} `if` `now >= expiresAt - this.options.tokenBufferMs`
     * - {@link TokenStatus.EXPIRED} `if` `now < expiresAt - this.options.tokenBufferMs`
     * - {@link TokenStatus.MISSING} `if` `!tokenResponse || !tokenResponse.access_token`
     * - {@link TokenStatus.INVALID} `if` `!tokenResponse.expires_in || !tokenResponse.lastUpdated`
     */
    private validateTokenResponse(token: TokenResponse): TokenStatus {
        const source = getSourceString(__filename, this.validateTokenResponse.name);
        // slog.debug(`${source} (START)`)
        try {
            validate.objectArgument(source, {token, isTokenResponse});
            validate.numberArgument(source, { 'token.lastUpdated': token.lastUpdated }, true);
            validate.numericStringArgument(source, { 'token.expires_in': token.expires_in }, true, true);
        } catch (error: any) {
            mlog.error(`${source} token type validation failed`, indentedStringify(error));
            return TokenStatus.INVALID;
        }
        if (!isTokenResponse(token)) {
            return TokenStatus.INVALID;
        }
        if (!isInteger(token.lastUpdated)) {
            mlog.error(`${source} lastUpdated is not an integer`,
                `typeof = ${typeof token.lastUpdated}`,
                `value  = '${token.lastUpdated}'`
            );
            return TokenStatus.INVALID;
        }
        // if (!isNumeric(token.expires_in, true, true)) {
        //     return TokenStatus.INVALID;
        // }
        // const expiresIn = (isInteger(token.expires_in) 
        //     ? token.expires_in 
        //     : Number(token.expires_in)
        // );
        try {
            // const expiresInMs = expiresIn * 1000;
            // const expiresAt = token.lastUpdated + expiresInMs;
            const now = Date.now();
            if (now >= this.getTokenExpiresAt(token) - this.options.tokenBufferMs) {
                slog.debug(`${source} returning status = expired`)
                return TokenStatus.EXPIRED;
            }
            // slog.debug(` -- returning status = valid`);
            return TokenStatus.VALID;
        } catch (error) {
            mlog.error(`${source} Error validating token response:`, error);
            slog.debug(`${source} returning status = invalid`);
            return TokenStatus.INVALID;
        }
    }
    /**
     * @param token {@link TokenResponse}, requires `token.lastUpdated` be defined
     * @returns **`expiresAt`** `number` 
     * - `if` valid token, return `Number(token.expires_in)` * 1000 + `token.lastUpdated`
     * - `else` return `Date.now()` @TODO decide if should throw error instead...
     */
    private getTokenExpiresAt(token: TokenResponse): number {
        const source = getSourceString(__filename, this.getTokenExpiresAt.name);
        if (!isTokenResponse(token) || !isInteger(token.lastUpdated)) {
            mlog.error([`${source} Invalid argument: token (TokenResponse)`,
                `returning expiresAt === now`
            ].join(TAB));
            return Date.now();
        }
        const expiresIn = (isInteger(token.expires_in) 
            ? token.expires_in 
            : Number(token.expires_in)
        );
        const expiresInMs = expiresIn * 1000;
        const expiresAt = token.lastUpdated + expiresInMs;
        return expiresAt;
    }

    private withinTokenExpirationBuffer(token: TokenResponse): boolean {
        // const source = getSourceString(__filename, this.withinTokenExpirationBuffer.name);
        const expiresAt = this.getTokenExpiresAt(token);
        const now = Date.now();
        return (now < expiresAt && now >= expiresAt - this.options.tokenBufferMs);
    }

    /**
     * - try `return token =` {@link read}`(filePath)` as {@link TokenResponse}
     * @param filePath `string`
     * @returns **`token`** - {@link TokenResponse}` | null`
     */
    private loadTokenFromFile(filePath: string): TokenResponse | null {
        const source = getSourceString(__filename, this.loadTokenFromFile.name, filePath);
        if (!isFile(filePath)) return null;
        try {
            const token = read(filePath) as TokenResponse;
            return token;
        } catch (error) {
            mlog.warn(`${source} Failed to load token from ${filePath}:`, error);
            return null;
        }
    }
    // @TODO
    // private getTokenPath(): TokenResponse | null {
    //     return null;
    // }
    // private getMetaPath(): TokenMetadata | null {
    //     return null;
    // }

    /**
     * tries to get valid token response from either:
     * 1. `STEP3` (the refreshed {@link TokenResponse.access_token}) or 
     * 2. `STEP2` (the original TokenResponse.access_token)
     * @returns `{ token: `{@link TokenResponse}`; source: string } | null`
     */
    public getCurrentValidToken(): { token: TokenResponse; source: string } | null {
        const step3Token = this.loadTokenFromFile(path.join(this.getTokenDir(), STEP3_FILENAME));
        if (step3Token && this.validateTokenResponse(step3Token) === TokenStatus.VALID) {
            return { token: step3Token, source: 'STEP3' };
        }
        const step2Token = this.loadTokenFromFile(path.join(this.getTokenDir(), STEP2_FILENAME));
        if (step2Token && this.validateTokenResponse(step2Token) === TokenStatus.VALID) {
            return { token: step2Token, source: 'STEP2' };
        }
        return null;
    }

    // ========================================================================
    // TOKEN REFRESH AND AUTHORIZATION
    // ========================================================================
    /**timeout for specified amount of milliseconds */
    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * @param operation `function: () => Promise<T>` - the operation to retry
     * @param operationName `string` - name of the operation for logging
     * @param maxRetries `number` - maximum number of retries for the operation, defaults to `this.options.maxRetries`
     * @returns **`Promise<T>`** - result of the operation
     */
    private async retryOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        maxRetries: number = this.options.maxRetries
    ): Promise<T> {
        const source = getSourceString(__filename, this.retryOperation.name, operationName);
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                alog.debug(`${source} attempt ${attempt}/${maxRetries}`);
                const result = await operation();
                // Reset error count on success
                if (this.tokenMetadata) {
                    this.updateTokenMetadata({ errorCount: 0 });
                }
                return result;
            } catch (error: any) {
                lastError = error as Error;
                if (this.tokenMetadata) {
                    this.updateTokenMetadata({ 
                        errorCount: this.tokenMetadata.errorCount + 1 
                    });
                }
                mlog.warn(`${source} attempt ${attempt} of ${maxRetries} failed:`, error?.message);
                if (attempt < maxRetries) { // Exponential backoff
                    const delayMs = this.options.retryDelayMs * Math.pow(2, attempt - 1); 
                    alog.debug(`${source} Retrying ${operationName} in ${delayMs}ms...`);
                    await this.delay(delayMs);
                }
            }
        }
        throw new Error(`${source} ${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }
    /**
     * calls {@link retryOperation}
     * @param authCode `string`
     * @returns **`tokenResponse`** - `Promise<`{@link TokenResponse}`>`
     * - writes `tokenResponse` to {@link STEP2_TOKENS_PATH}
     */
    private async exchangeAuthCode(authCode: string): Promise<TokenResponse> {
        const source = getSourceString(__filename, this.exchangeAuthCode.name);
        const operation = async () => {
            mlog.debug([`${source} starting operation...`,
                `isNonEmptyString(authCode) ? ${isNonEmptyString(authCode)}`
            ].join(', '));
            const params = this.generateGrantParams({code: authCode});
            const response = await axios.post(TOKEN_URL, params.toString(), {
                headers: { 
                    'Content-Type': AxiosContentTypeEnum.FORM_URL_ENCODED 
                },
                auth: { 
                    username: CLIENT_ID, 
                    password: CLIENT_SECRET 
                },
                timeout: 10000 // 10 second timeout
            });
            if (!response.data || !(response.data as any).access_token) {
                mlog.error(`${source} Invalid token response: missing 'access_token'`)
                throw new Error(`${source} Invalid token response: missing 'access_token'`);
            }
            const tokenResponse = response.data as TokenResponse;
            slog.debug(` -- isTokenResponse(response.data) ? ${isTokenResponse(response.data)}`);
            // Ensure expires_in is a number for calculations
            if (typeof tokenResponse.expires_in === 'string') {
                tokenResponse.expires_in = parseInt(tokenResponse.expires_in, 10);
            }
            tokenResponse.lastUpdated = Date.now();
            tokenResponse.lastUpdatedLocaleString = getCurrentPacificTime();
            slog.debug(` -- writing TokenResponse to STEP2_TOKENS_PATH...`)
            write(tokenResponse, path.join(this.getTokenDir(), STEP2_FILENAME));
            const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            slog.debug(` -- calling this.updateTokenMetadata()`)
            this.updateTokenMetadata({
                status: TokenStatus.VALID,
                expiresAt,
                refreshCount: 0
            });
            return tokenResponse;
        };
        return this.retryOperation(operation, this.exchangeAuthCode.name);
    }
    /**
     * @description 
     * performs the {@link retryOperation} 'refreshOperation' consisting of the following steps:
     * 1. get `params` = {@link generateGrantParams}`({refreshToken})`
     * 2. get `response` = `axios.post` to {@link TOKEN_URL} with the generated `params`
     * 3. check if `response` is valid
     * 4. set `tokenResponse` to `response.data` as {@link TokenResponse} and set `tokenResponse.lastUpdated` to {@link getCurrentPacificTime}
     * 5. {@link write} `tokenResponse` to `STEP3_TOKENS_PATH` file, call {@link updateTokenMetadata}, then return `tokenResponse`
     * @param refreshToken `string`
     * @returns **`tokenResponse`** - `Promise<`{@link TokenResponse}`>`
     * @throws {Error} `if` `response` from request to {@link TOKEN_URL} is invalid in any of the following ways:
     * 1. is `undefined`
     * 2. does not have `response.data` property, 
     * 3. `response.data` does not have `access_token` property
     */
    private async exchangeRefreshToken(
        refreshToken: string
    ): Promise<TokenResponse> {
        const source = getSourceString(__filename, this.exchangeRefreshToken.name);
        const operation = async () => {
            mlog.debug([`${source} start operation`, 
                `isNonEmptyString(refreshToken) ? ${isNonEmptyString(refreshToken)}`
            ].join(', '));
            const params = this.generateGrantParams({refreshToken});
            const response = await axios.post(TOKEN_URL, params.toString(), {
                headers: { 
                    'Content-Type': AxiosContentTypeEnum.FORM_URL_ENCODED 
                },
                auth: { 
                    username: CLIENT_ID, 
                    password: CLIENT_SECRET 
                },
                timeout: 10000 // 10 second timeout
            });
            if (!response || !response.data || !(response.data as any).access_token) {
                throw new Error(`${source} Invalid TokenResponse: empty or missing access_token`);
            }
            slog.debug(` -- isTokenResponse(response.data) ? ${isTokenResponse(response.data)}`)
            const tokenResponse = response.data as TokenResponse;
            if (typeof tokenResponse.expires_in === 'string') {
                tokenResponse.expires_in = parseInt(tokenResponse.expires_in, 10);
            }
            tokenResponse.lastUpdated = Date.now();
            tokenResponse.lastUpdatedLocaleString = getCurrentPacificTime();
            slog.debug(` -- writing token response to step3 path....`)
            write(tokenResponse, path.join(this.getTokenDir(), STEP3_FILENAME));
            this.updateTokenMetadata({
                status: TokenStatus.VALID,
                expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
                refreshCount: (this.tokenMetadata?.refreshCount || 0) + 1
            });
            return tokenResponse;
        }
        return this.retryOperation(operation, this.exchangeRefreshToken.name);
    }
    /**
     * @param callBackTimeoutMs `number` = `2 * 60 * 1000` (2 minutes) 
     * @returns **`authCode`** `Promise<string>`
     */
    private async getAuthCode(
        callBackTimeoutMs: number = 2 * 60 * 1000
    ): Promise<string> {
        const source = getSourceString(F, this.getAuthCode.name);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.closeServer();
                reject(new Error(
                    `${source} Authorization timeout - no callback received within ${
                        callBackTimeoutMs / (60 * 1000)} minute(s)`
                ));
            }, callBackTimeoutMs);
            this.app.get('/callback', (req: Request, res: Response) => {
                clearTimeout(timeout);
                const authCode = req.query.code as string;
                const error = req.query.error as string;
                const errorDescription = req.query.error_description as string ?? 'Unknown error';
                if (error) {
                    let msg = `${source} Authorization failed: ${error} - ${errorDescription}`;
                    res.status(400).send(msg);
                    this.closeServer();
                    reject(new Error(msg));
                    return;
                }
                if (!authCode) {
                    let msg = `${source} Authorization failed: No authorization code received`;
                    res.status(400).send(msg);
                    this.closeServer();
                    reject(new Error(msg));
                    return;
                }
                /**`<html><body><h2>...</h2><p>...</p><script>{time out 5 seconds, close window}</script></body></html>` */
                const SUCCESSFUL_AUTH_CODE_HTML = (
                    `<html>`
                        +`<body>`
                            + `<h2>Authorization Successful!</h2>`
                            + `<p>You can now close this window.</p>`
                            + `<script>setTimeout(() => window.close(), 5000);</script>`
                        + `</body>`
                    +`</html>`
                );
                res.send(SUCCESSFUL_AUTH_CODE_HTML);
                this.closeServer();
                resolve(authCode);
            });
            this.server = this.app.listen(parseInt(SERVER_PORT), () => {
                const authLink = createUrlWithParams(AUTH_URL, {
                    response_type: 'code',
                    redirect_uri: REDIRECT_URI,
                    client_id: CLIENT_ID,
                    scope: SCOPE,
                    state: crypto.randomBytes(32).toString('hex')
                }).toString();
                slog.info([`${source} Server listening on port ${SERVER_PORT} for OAuth callback`, 
                    ' -- Opening authorization URL...'
                ].join(NL));
                open(authLink).catch((err: any) => {
                    let msg = `${source} Failed to open authorization URL: ${err.message}`
                    mlog.error(msg);
                    clearTimeout(timeout);
                    this.closeServer();
                    reject(new Error(msg));
                });
            });
            this.server.on('error', (error) => {
                let msg = `${source} OAuth server error: ${error.message}`
                clearTimeout(timeout);
                mlog.error(msg);
                reject(new Error(msg));
            });
        });
    }

    private closeServer(): void {
        if (this.server) {
            this.server.close(() => {
                slog.debug('[AuthManager.closeServer()] OAuth server closed');
            });
            this.server = null;
        }
    }

    private generateGrantParams(
        options: {code?: string; refreshToken?: never} 
        | {code?: never; refreshToken?: string}
    ): URLSearchParams {
        const source = getSourceString(__filename, this.generateGrantParams.name);
        if (options.code && options.refreshToken) {
            throw new Error(`${source} Invalid param 'options'; received both 'code' and 'refreshToken' properties`);
        }
        const params = new URLSearchParams({ redirect_uri: REDIRECT_URI });
        if (options.code) {
            params.append('code', options.code);
            params.append('grant_type', GrantTypeEnum.AUTHORIZATION_CODE);
        } else if (options.refreshToken) {
            params.append('refresh_token', options.refreshToken);
            params.append('grant_type', GrantTypeEnum.REFRESH_TOKEN);
        } else {
            throw new Error(`${source} Invalid param 'options': options must have property 'code' or 'refreshToken'`);
        }
        return params;
    }

    // ========================================================================
    // MAIN TOKEN ACQUISITION LOGIC
    // ========================================================================

    private async performTokenRefresh(): Promise<TokenResponse> {
        const source = getSourceString(F, this.performTokenRefresh.name);
        mlog.info(`${source} Attempting token refresh...`);
        // Try to get existing tokens for refresh
        const step2Token = this.loadTokenFromFile(path.join(this.getTokenDir(), STEP2_FILENAME));
        const step3Token = this.loadTokenFromFile(path.join(this.getTokenDir(), STEP3_FILENAME));
        // Get the most recent refresh token
        let refreshToken: string | null = null;
        if (step3Token 
            && isNonEmptyString(step3Token.refresh_token)
            && this.withinTokenExpirationBuffer(step3Token)) { // this.validateTokenResponse(step3Token) === TokenStatus.VALID) {
            refreshToken = step3Token.refresh_token;
            slog.debug(`Using step3Token refresh token --------`);
        } else if (step2Token 
            && isNonEmptyString(step2Token.refresh_token)
            && this.withinTokenExpirationBuffer(step2Token)) { // this.validateTokenResponse(step2Token) === TokenStatus.VALID) {
            refreshToken = step2Token.refresh_token;
            slog.debug(`Using step2Token refresh token --------`);
        } else {
            mlog.warn([
                `${source} No valid token from step3Token or step2Token`,
            ].join(TAB));
        }
        if (refreshToken) {
            try {
                const refreshedTokens = await this.exchangeRefreshToken(refreshToken);
                slog.info(' -- Token refresh successful');
                return refreshedTokens;
            } catch (error: any) {
                mlog.warn([
                    `${source} Token refresh failed`+(error && error.message ? error.message : ''),
                    `Falling back to full authorization`,
                ].join(NL));
            }
        } else {
            mlog.warn(`${source} No refresh token available, performing full authorization`);
        }
        return this.performFullAuthorization();
    }
    /** 
     * performs step 1 and step 2 of the OAuth authorization flow:
     * - {@link getAuthCode} -> {@link exchangeAuthCode} return {@link TokenResponse} */
    private async performFullAuthorization(): Promise<TokenResponse> {
        const source = getSourceString(F, this.performFullAuthorization.name);
        slog.info(`${source} Starting full OAuth authorization flow...`);
        const authCode = await this.getAuthCode();
        if (isNonEmptyString(authCode)) slog.info(` -- obtained authCode, attempting exchange for token...`);
        const tokenResponse = await this.exchangeAuthCode(authCode);
        slog.info(`${source} Full authorization flow completed successfully!`);
        return tokenResponse;
    }

    private resolvePendingRequests(token: string): void {
        const requests = [...this.pendingRequests];
        this.pendingRequests = [];
        requests.forEach(request => {
            try {
                request.resolve(token);
            } catch (error) {
                mlog.error('[AuthManager.resolvePendingRequests()] Error resolving pending request:', error);
            }
        });
    }

    private rejectPendingRequests(error: Error): void {
        const requests = [...this.pendingRequests];
        this.pendingRequests = [];
        requests.forEach(request => {
            try {
                request.reject(error);
            } catch (err) {
                mlog.error('[AuthManager.rejectPendingRequests()] Error rejecting pending request:', err);
            }
        });
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    public async getAccessToken(): Promise<string> {
        const source = getSourceString(F, this.getAccessToken.name);
        if (this.state !== AuthState.IDLE && this.options.enableQueueing) {
            mlog.debug(`${source} Token acquisition in progress, queueing request...`);   
            return new Promise<string>((resolve, reject) => {
                const request: PendingRequest = {
                    resolve,
                    reject,
                    timestamp: Date.now()
                };
                this.pendingRequests.push(request);
                const cutoff = Date.now() - 2 * 60 * 1000;
                this.pendingRequests = this.pendingRequests.filter(req => {
                    if (req.timestamp < cutoff) {
                        req.reject(new Error(`${source} Request timeout - queued too long`));
                        return false;
                    }
                    return true;
                });
            });
        }
        if (this.state !== AuthState.IDLE) {
            await this.delay(1000);
            return this.getAccessToken();
        }
        try {
            const current = this.getCurrentValidToken();
            if (current) {
                alog.debug(`${source} Using valid '${current.source}' token`);
                this.lastTokenResponse = current.token;
                this.resolvePendingRequests(current.token.access_token);
                return current.token.access_token;
            }
            this.state = AuthState.REFRESHING;
            mlog.info(`${source} No valid token found, acquiring new token...`);
            let tokenResponse: TokenResponse;
            try { // try refresh first
                tokenResponse = await this.performTokenRefresh();
                this.state = AuthState.IDLE;
            } catch (refreshError) {
                mlog.warn(`${source} Token refresh failed, attempting full authorization:`, refreshError);
                this.state = AuthState.AUTHORIZING;
                tokenResponse = await this.performFullAuthorization();
                this.state = AuthState.IDLE;
            }
            this.lastTokenResponse = tokenResponse;
            slog.info(`${source} Token acquisition successful`);
            this.resolvePendingRequests(tokenResponse.access_token);
            return tokenResponse.access_token;
            
        } catch (error: any) {
            this.state = AuthState.ERROR;
            mlog.error(`${source} Token acquisition failed:`, error);  
            this.updateTokenMetadata({ status: TokenStatus.INVALID }); 
            const errorMessage = `Failed to acquire access token: ${error instanceof Error ? error.message : 'Unknown error'}`;
            const finalError = new Error(errorMessage);
            this.rejectPendingRequests(finalError);
            // Reset state after 5 second delay
            setTimeout(() => {
                if (this.state === AuthState.ERROR) {
                    this.state = AuthState.IDLE;
                }
            }, 5000);
            throw finalError;
        }
    }
    
    public getTokenStatus(): { 
        state: AuthState; 
        metadata: TokenMetadata | null; 
        hasValidToken: boolean;
        pendingRequests: number;
    } {
        const current = this.getCurrentValidToken();
        return {
            state: this.state,
            metadata: this.tokenMetadata,
            hasValidToken: current !== null,
            pendingRequests: this.pendingRequests.length
        };
    }
    /**
     * 
     * @returns **`isValid`** `Promise<boolean>`
     */
    public async validateCurrentToken(): Promise<boolean> {
        const current = this.getCurrentValidToken();
        if (!current) {
            this.updateTokenMetadata({ status: TokenStatus.MISSING });
            return false;
        }
        
        const status = this.validateTokenResponse(current.token);
        this.updateTokenMetadata({ status });
        
        return status === TokenStatus.VALID;
    }

    // ========================================================================
    // TOKEN VALIDATION BACKGROUND PROCESS
    // ========================================================================

    private startTokenValidation(): void {
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
        }
        this.validationTimer = setInterval(async () => {
            try {
                if (this.state === AuthState.IDLE) {
                    await this.validateCurrentToken();
                }
            } catch (error) {
                mlog.warn('[AuthManager.startTokenValidation()] Background token validation failed:', error);
            }
        }, this.options.validationIntervalMs);
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    public destroy(): void {
        const source = getSourceString(__filename, this.destroy.name);
        const authWasActive = (
            this.state !== AuthState.IDLE || this.server !== null
        );
        this.closeServer();
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = null;
        }
        this.rejectPendingRequests(new Error(`${source} OAuth manager destroyed`));
        
        this.state = AuthState.IDLE;
        if (authWasActive) mlog.warn(`${source} OAuth manager destroyed, authWasActive: ${authWasActive}`);
    }
}

