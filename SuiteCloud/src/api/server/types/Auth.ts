/**
 * @file src/api/server/types/Auth.ts
 */

export { 
    TokenStatus, TokenMetadata, AuthOptions, AuthState, PendingRequest 
};

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
