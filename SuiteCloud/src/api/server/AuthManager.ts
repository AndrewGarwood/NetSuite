/**
 * @file src/api/server/AuthManager.ts
 */
import express, { Request, Response } from 'express';
import { Server } from 'node:http';
import axios from 'axios';
import open from 'open';
import bodyParser from 'body-parser';
import path from 'node:path';
import fs from 'node:fs';
import { 
    TOKEN_DIR, SERVER_PORT, REDIRECT_URI, AUTH_URL, TOKEN_URL, 
    REST_CLIENT_ID as CLIENT_ID, REST_CLIENT_SECRET as CLIENT_SECRET,
    SCOPE, STATE
} from '../../config/env';
import { createUrlWithParams } from '../url';
import { AxiosContentTypeEnum, TokenResponse, GrantTypeEnum } from './types';
import { 
    writeObjectToJson as write 
} from '../../utils/io/writing';
import { 
    readJsonFileAsObject as read
} from '../../utils/io/reading';
import { getCurrentPacificTime } from '../../utils/io/dateTime';
import { 
    mainLogger as mlog, apiLogger as alog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    INFO_LOGS as INFO 
} from '../../config/setupLog';

export { AuthManager, TokenStatus, AuthState, type AuthOptions, type TokenMetadata };

// ============================================================================
// TYPES
// ============================================================================
/**
 * @enum {string} **`TokenStatus`**
 * @property {string} VALID - Token is valid and not expired.
 * @property {string} EXPIRED - Token is expired.
 * @property {string} MISSING - Token is missing or not found.
 * @property {string} INVALID - Token is invalid or malformed.
 */
enum TokenStatus {
    VALID = 'VALID',
    EXPIRED = 'EXPIRED',
    MISSING = 'MISSING',
    INVALID = 'INVALID'
}

/**
 * @enum {string} **`AuthState`**
 * @property {string} IDLE - No token acquisition in progress.
 * @property {string} REFRESHING - Token refresh in progress.
 * @property {string} AUTHORIZING - Full authorization in progress.
 * @property {string} ERROR - Error occurred during token acquisition.
 */
enum AuthState {
    IDLE = 'IDLE',
    REFRESHING = 'REFRESHING',
    AUTHORIZING = 'AUTHORIZING',
    ERROR = 'ERROR'
}

/**
 * @interface **`TokenMetadata`**
 * @property {TokenStatus} status - Current status of the token.
 * @property {number} expiresAt - Expiration time of the token in milliseconds since epoch
 * @property {number} lastValidated - Last validation time of the token in milliseconds since epoch
 * @property {number} refreshCount - Number of times the token has been refreshed.
 * @property {number} errorCount - Number of errors encountered during token acquisition.
 */
interface TokenMetadata {
    status: TokenStatus;
    expiresAt: number; // Unix timestamp in milliseconds
    lastValidated: number; // Unix timestamp in milliseconds
    refreshCount: number;
    errorCount: number;
}

/**
 * @interface **`AuthOptions`**
 * @property {number} [maxRetries] - Maximum number of retries for token refresh.
 * @property {number} [retryDelayMs] - Delay in milliseconds between retries.
 * @property {number} [tokenBufferMs] - Buffer time in milliseconds before token expiration to refresh.
 * @property {number} [validationIntervalMs] - Interval in milliseconds for token validation checks
 * @property {boolean} [enableQueueing] - Enable queueing of requests when token acquisition is in progress.
 */
interface AuthOptions {
    maxRetries?: number;
    retryDelayMs?: number;
    tokenBufferMs?: number; // How early to refresh before expiration
    validationIntervalMs?: number;
    enableQueueing?: boolean;
}

/**
 * @interface **`PendingRequest`**
 * @property {function} resolve - Function to resolve the pending request with the token.
 * @property {function} reject - Function to reject the pending request with an error.
 * @property {number} timestamp - Timestamp when the request was created.
 */
interface PendingRequest {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
    timestamp: number;
}

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
/** = `'src/server/tokens/STEP2_tokens.json'`  */
const STEP2_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP2_tokens.json');
/** = `'src/server/tokens/STEP3_tokens.json'` */
const STEP3_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP3_tokens.json');
/** = `'src/server/tokens/token_metadata.json'` */
const TOKEN_METADATA_PATH = path.join(TOKEN_DIR, 'token_metadata.json');

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
     * - `if` `(fs.existsSync(`{@link TOKEN_METADATA_PATH}`))` 
     * - `then` try set `this.tokenMetadata = `{@link read}`(TOKEN_METADATA_PATH) as `{@link TokenMetadata}; 
     * - `else` set `this.tokenMetadata` to a blank {@link TokenMetadata} object
     * */
    private initializeTokenMetadata(): void {
        try {
            if (fs.existsSync(TOKEN_METADATA_PATH)) {
                this.tokenMetadata = read(TOKEN_METADATA_PATH) as TokenMetadata;
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
            mlog.warn('[AuthManager.initializeTokenMetadata()] Failed to load token metadata, error:', error);
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
        try {
            if (this.tokenMetadata) {
                write(this.tokenMetadata, TOKEN_METADATA_PATH);
            }
        } catch (error) {
            mlog.error('[AuthManager.saveTokenMetadata()] Failed to save token metadata:', error);
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
     * @param tokenResponse {@link TokenResponse} - use tokenResponse to determine value of these variables:
     * 1. `lastUpdateMs` = `new Date(tokenResponse.lastUpdated).getTime()`
     * 2. `expiresInMs` = `tokenResponse.expires_in * 1000`
     * 3. `expiresAt` = `lastUpdatedMs + expiresInMs`
     * 4. `now` = `Date.now()`
     * 5. `isExpired` = `now >= expiresAt - this.options.tokenBufferMs`
     * @returns **`tokenStatus`** — {@link TokenStatus}
     * - {@link TokenStatus.VALID} `if` `now >= expiresAt - this.options.tokenBufferMs`
     * - {@link TokenStatus.EXPIRED} `if` `now < expiresAt - this.options.tokenBufferMs`
     * - {@link TokenStatus.MISSING} `if` `!tokenResponse || !tokenResponse.access_token`
     * - {@link TokenStatus.INVALID} `if` `!tokenResponse.expires_in || !tokenResponse.lastUpdated`
     */
    private validateTokenResponse(tokenResponse: TokenResponse): TokenStatus {
        if (!tokenResponse || !tokenResponse.access_token) {
            return TokenStatus.MISSING;
        }
        if (!tokenResponse.expires_in || !tokenResponse.lastUpdated) {
            return TokenStatus.INVALID;
        }
        try {
            const lastUpdatedMs = new Date(tokenResponse.lastUpdated).getTime();
            const expiresInMs = tokenResponse.expires_in * 1000;
            const expiresAt = lastUpdatedMs + expiresInMs;
            const now = Date.now();
            if (now >= expiresAt - this.options.tokenBufferMs) {
                return TokenStatus.EXPIRED;
            }
            return TokenStatus.VALID;
        } catch (error) {
            mlog.error('[AuthManager.validateTokenResponse()] Error validating token response:', error);
            return TokenStatus.INVALID;
        }
    }
    /**
     * - try `return token =` {@link read}`(filePath)` as {@link TokenResponse}
     * @param filePath `string`
     * @returns **`token`** — {@link TokenResponse} | `null`
     */
    private loadTokenFromFile(filePath: string): TokenResponse | null {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const token = read(filePath) as TokenResponse;
            return token || null;
        } catch (error) {
            mlog.warn(`[AuthManager.loadTokenFromFile()] Failed to load token from ${filePath}:`, error);
            return null;
        }
    }
    /**
     * tries to get valid token response from either:
     * 1. `STEP3` (the refreshed {@link TokenResponse.access_token}) or 
     * 2. `STEP2` (the original TokenResponse.access_token)
     * @returns `{ token: `{@link TokenResponse}`; source: string } | null`
     */
    public getCurrentValidToken(): { token: TokenResponse; source: string } | null {
        const step3Token = this.loadTokenFromFile(STEP3_TOKENS_PATH);
        if (step3Token 
            && this.validateTokenResponse(step3Token) === TokenStatus.VALID) {
                return { token: step3Token, source: 'STEP3' };
        }
        const step2Token = this.loadTokenFromFile(STEP2_TOKENS_PATH);
        if (step2Token 
            && this.validateTokenResponse(step2Token) === TokenStatus.VALID) {
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
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                alog.debug(`[AuthManager.retryOperation()] ${operationName} attempt ${attempt}/${maxRetries}`);
                const result = await operation();
                // Reset error count on success
                if (this.tokenMetadata) {
                    this.updateTokenMetadata({ errorCount: 0 });
                }
                return result;
            } catch (error) {
                lastError = error as Error;
                if (this.tokenMetadata) {
                    this.updateTokenMetadata({ 
                        errorCount: this.tokenMetadata.errorCount + 1 
                    });
                }
                mlog.warn(`[AuthManager.retryOperation()] ${operationName} attempt ${attempt} of ${maxRetries} failed:`, error);
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delayMs = this.options.retryDelayMs * Math.pow(2, attempt - 1); 
                    alog.debug(`[AuthManager.retryOperation()] Retrying ${operationName} in ${delayMs}ms...`);
                    await this.delay(delayMs);
                }
            }
        }
        throw new Error(`[AuthManager.retryOperation()] ${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
    }
    /**
     * performs the {@link retryOperation} 'authCodeOperation'
     * @param authCode `string`
     * @returns **`tokenResponse`** — `Promise<`{@link TokenResponse}`>`
     */
    private async exchangeAuthCode(authCode: string): Promise<TokenResponse> {
        const operation = async () => {
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
                throw new Error('Invalid token response: missing access_token');
            }
            const tokenResponse = response.data as TokenResponse;
            tokenResponse.lastUpdated = getCurrentPacificTime();
            write(tokenResponse, STEP2_TOKENS_PATH);
            const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            this.updateTokenMetadata({
                status: TokenStatus.VALID,
                expiresAt,
                refreshCount: 0
            });
            return tokenResponse;
        };
        return this.retryOperation(operation, 'exchangeAuthCode');
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
     * @returns **`tokenResponse`** — `Promise<`{@link TokenResponse}`>`
     * @throws {Error} `if` `response` from request to {@link TOKEN_URL} is invalid in any of the following ways:
     * 1. is `undefined`
     * 2. does not have `response.data` property, 
     * 3. `response.data` does not have `access_token` property
     */
    private async exchangeRefreshToken(
        refreshToken: string
    ): Promise<TokenResponse> {
        const operation = async () => {
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
                throw new Error('[AuthManager.exchangeRefreshToken()] Invalid refresh token response: missing access_token');
            }
            const tokenResponse = response.data as TokenResponse;
            tokenResponse.lastUpdated = getCurrentPacificTime();
            // Save to STEP3 file
            write(tokenResponse, STEP3_TOKENS_PATH);
            this.updateTokenMetadata({
                status: TokenStatus.VALID,
                expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
                refreshCount: (this.tokenMetadata?.refreshCount || 0) + 1
            });
            return tokenResponse;
        }
        return this.retryOperation(operation, 'exchangeRefreshToken');
    }
    /**
     * @returns `Promise<string>`
     */
    private async getAuthCode(): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.closeServer();
                reject(new Error('Authorization timeout - no callback received within 5 minutes'));
            }, 5 * 60 * 1000); // 5 minute timeout
            this.app.get('/callback', (req: Request, res: Response) => {
                clearTimeout(timeout);
                const authCode = req.query.code as string;
                const error = req.query.error as string;
                const errorDescription = req.query.error_description as string;
                if (error) {
                    res.status(400).send(`Authorization failed: ${error} - ${errorDescription || 'Unknown error'}`);
                    this.closeServer();
                    reject(new Error(`OAuth authorization failed: ${error} - ${errorDescription}`));
                    return;
                }
                if (!authCode) {
                    res.status(400).send('Authorization failed: No authorization code received');
                    this.closeServer();
                    reject(new Error('No authorization code received from OAuth callback'));
                    return;
                }
                /**`<html><body><h2>...</h2><p>...</p><script>{time out for 2 seconds then close window}</script></body></html>` */
                const SUCCESSFUL_AUTH_CODE_HTML = (
                    `<html>`
                        +`<body>`
                            + `<h2>Authorization Successful!</h2>`
                            + `<p>You can now close this window.</p>`
                            + `<script>setTimeout(() => window.close(), 2000);</script>`
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
                    state: require('crypto').randomBytes(32).toString('hex')
                }).toString();
                mlog.info(`[AuthManager.getAuthCode()] Server listening on port ${SERVER_PORT} for OAuth callback`, 
                    NL+'Opening authorization URL...');
                open(authLink).catch((err) => {
                    mlog.error('[AuthManager.getAuthCode()] Failed to open authorization URL:', err);
                    clearTimeout(timeout);
                    this.closeServer();
                    reject(new Error(`Failed to open authorization URL: ${err.message}`));
                });
            });
            this.server.on('error', (error) => {
                clearTimeout(timeout);
                mlog.error('[AuthManager.getAuthCode()] Server error:', error);
                reject(new Error(`[AuthManager.getAuthCode()] OAuth server error: ${error.message}`));
            });
        });
    }

    private closeServer(): void {
        if (this.server) {
            this.server.close(() => {
                mlog.debug('[AuthManager.closeServer()] OAuth server closed');
            });
            this.server = null;
        }
    }

    private generateGrantParams(
        options: {code?: string; refreshToken?: never} 
        | {code?: never; refreshToken?: string}
    ): URLSearchParams {
        if (options.code && options.refreshToken) {
            throw new Error(`[AuthManager.generateGrantParams()] Invalid param 'options'; received both 'code' and 'refreshToken' properties`);
        }
        const params = new URLSearchParams({ redirect_uri: REDIRECT_URI });
        if (options.code) {
            params.append('code', options.code);
            params.append('grant_type', GrantTypeEnum.AUTHORIZATION_CODE);
        } else if (options.refreshToken) {
            params.append('refresh_token', options.refreshToken);
            params.append('grant_type', GrantTypeEnum.REFRESH_TOKEN);
        } else {
            throw new Error(`[AuthManager.generateGrantParams()] Invalid param 'options': options must have property 'code' or 'refreshToken'`);
        }
        return params;
    }

    // ========================================================================
    // MAIN TOKEN ACQUISITION LOGIC
    // ========================================================================

    private async performTokenRefresh(): Promise<TokenResponse> {
        mlog.info('[AuthManager.performTokenRefresh()] Attempting token refresh...');
        // Try to get existing tokens for refresh
        const step2Token = this.loadTokenFromFile(STEP2_TOKENS_PATH);
        const step3Token = this.loadTokenFromFile(STEP3_TOKENS_PATH);
        // Get the most recent refresh token
        let refreshToken: string | null = null;
        if (step3Token?.refresh_token) {
            refreshToken = step3Token.refresh_token;
        } else if (step2Token?.refresh_token) {
            refreshToken = step2Token.refresh_token;
        }
        if (refreshToken) {
            try {
                const refreshedTokens = await this.exchangeRefreshToken(refreshToken);
                mlog.info('[AuthManager.performTokenRefresh()] Token refresh successful');
                return refreshedTokens;
            } catch (error) {
                mlog.warn('[AuthManager.performTokenRefresh()] Token refresh failed, falling back to full authorization:', error);
            }
        } else {
            mlog.warn('[AuthManager.performTokenRefresh()] No refresh token available, performing full authorization');
        }
        // Fallback to full authorization flow
        return this.performFullAuthorization();
    }
    /** 
     * performs step 1 and step 2 of the OAuth authorization flow:
     * - {@link getAuthCode} -> {@link exchangeAuthCode} return {@link TokenResponse} */
    private async performFullAuthorization(): Promise<TokenResponse> {
        mlog.info('[AuthManager.performFullAuthorization()] Starting full OAuth authorization flow...');
        const authCode = await this.getAuthCode();
        const tokenResponse = await this.exchangeAuthCode(authCode);
        mlog.info('[AuthManager.performFullAuthorization()] Full authorization flow completed successfully');
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
        if (this.state !== AuthState.IDLE && this.options.enableQueueing) {
            alog.debug('[AuthManager.getAccessToken()] Token acquisition in progress, queueing request...');   
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
                        req.reject(new Error('[AuthManager.getAccessToken()] Request timeout - queued too long'));
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
                alog.debug(`[AuthManager.getAccessToken()] Using valid '${current.source}' token`);
                this.lastTokenResponse = current.token;
                this.resolvePendingRequests(current.token.access_token);
                return current.token.access_token;
            }
            this.state = AuthState.REFRESHING;
            mlog.info('[AuthManager.getAccessToken()] No valid token found, acquiring new token...');
            let tokenResponse: TokenResponse;
            try { // try refresh first
                tokenResponse = await this.performTokenRefresh();
                this.state = AuthState.IDLE;
            } catch (refreshError) {
                mlog.warn('[AuthManager.getAccessToken()] Token refresh failed, attempting full authorization:', refreshError);
                this.state = AuthState.AUTHORIZING;
                tokenResponse = await this.performFullAuthorization();
                this.state = AuthState.IDLE;
            }
            this.lastTokenResponse = tokenResponse;
            mlog.info('[AuthManager.getAccessToken()] Token acquisition successful');
            this.resolvePendingRequests(tokenResponse.access_token);
            return tokenResponse.access_token;
            
        } catch (error) {
            this.state = AuthState.ERROR;
            mlog.error('[AuthManager.getAccessToken()] Token acquisition failed:', error);  
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
        const authWasActive = (
            this.state !== AuthState.IDLE || this.server !== null
        );
        this.closeServer();
        if (this.validationTimer) {
            clearInterval(this.validationTimer);
            this.validationTimer = null;
        }
        this.rejectPendingRequests(new Error('[AuthManager.destroy()] OAuth manager destroyed'));
        
        this.state = AuthState.IDLE;
        if (authWasActive) mlog.info('[AuthManager.destroy()] OAuth manager destroyed');
    }
}

