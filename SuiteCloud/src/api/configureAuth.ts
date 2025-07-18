/**
 * @file src/utils/api/configureAuth.ts
 */

import { STOP_RUNNING } from "../config/env";
import { AuthManager, AuthOptions, AuthState } from "./server/AuthManager";

let auth: AuthManager | null = null;
let authInitialized = false;

export async function instantiateAuthManager(options?: AuthOptions): Promise<void> {
    try {
        // Create AuthManager with optional configuration
        auth = new AuthManager(options);
        authInitialized = true;
    } catch (error) {
        authInitialized = false;
        throw new Error(`[configureAuth.instantiateAuthManager()] Failed to instantiate AuthManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getAuthManager(): Promise<AuthManager> {
    if (!isAuthInitialized() || !auth) {
        await instantiateAuthManager();
    }
    
    // auth should never be null at this point, but TypeScript safety check
    if (!auth) {
        throw new Error(`[configureAuth.getAuthManager()] AuthManager failed to initialize properly.`);
    }
    
    return auth;
}

/**
 * when called, performs the following:
 * 1. `if` a request to this function is already in progress `and` queueing is enabled, `then` add new {@link auth.PendingRequest} to {@link auth.pendingRequests} queue
 * and reject any requests in the queue that are older than 2 minutes (and remove them from {@link auth.pendingRequests})
 * 2. `if` the state is not {@link AuthState.IDLE}, wait for 1 second and call this function again
 * 3. `if` `currentToken` = return value from {@link auth.getCurrentValidToken} is not null,
 * `then` set {@link AuthManager.lastTokenResponse} to `currentToken`, 
 * call {@link auth.resolvePendingRequests}`(currentToken.access_token)`, 
 * and return `currentToken.access_token`
 * 4. `else` `currentToken` is null (Need to acquire new token), so set {@link auth.state} to `REFRESHING`,
 * `then` set the new `tokenResponse` = {@link auth.performTokenRefresh}`()` 
 * `if` get a refreshError set `tokenResponse` = {@link auth.performFullAuthorization}`()`
 * 5. `set` {@link auth.state} to {@link AuthState.IDLE} and {@link auth.lastTokenResponse} to `tokenResponse`
 * @returns **`Promise<string>`** - The access token
 * */
export async function getAccessToken(): Promise<string> {
    if (!isAuthInitialized() || !auth) {
        await instantiateAuthManager();
    }
    
    // auth should never be null at this point, but TypeScript safety check
    if (!auth) {
        throw new Error(`[configureAuth.getAccessToken()] AuthManager failed to initialize properly.`);
    }
    
    return auth.getAccessToken();
}

/**
 * Check if auth has been initialized
 * @returns **`authInitialized`** `boolean`
 */
export function isAuthInitialized(): boolean {
    return authInitialized;
}

/**
 * Get the current auth state and status information
 * @returns Object containing auth state, token validity, and pending requests
 */
export async function getAuthStatus(): Promise<{
    state: AuthState;
    hasValidToken: boolean;
    pendingRequests: number;
    isInitialized: boolean;
}> {
    if (!isAuthInitialized() || !auth) {
        return {
            state: AuthState.IDLE,
            hasValidToken: false,
            pendingRequests: 0,
            isInitialized: false
        };
    }
    
    const status = auth.getTokenStatus();
    return {
        ...status,
        isInitialized: true
    };
}

/**
 * Create a new AuthManager instance with custom configuration
 * This is useful when you need multiple AuthManager instances or specific configuration
 * @param options Custom AuthOptions for the new instance
 * @returns A new AuthManager instance
 */
export function createAuthManager(options?: AuthOptions): AuthManager {
    return new AuthManager(options);
}

/**
 * Validate the current token without refreshing it
 * @returns Promise<boolean> indicating if the current token is valid
 */
export async function validateCurrentToken(): Promise<boolean> {
    if (!isAuthInitialized() || !auth) {
        return false;
    }
    
    return auth.validateCurrentToken();
}

/**
 * Destroy the current AuthManager instance and clean up resources
 * This will clear the singleton instance and require re-initialization
 */
export function destroyAuthManager(): void {
    if (auth) {
        auth.destroy();
        auth = null;
        authInitialized = false;
    }
}

/** 
 * Cleanup on process exit 
 * - "This pattern ensures that the application doesn't leave behind 
 * dangling resources like open HTTP servers listening on ports, active timers, 
 * or unresolved promises when the process is terminated." 
 * - "...prevents resource leaks and ensures the application can be cleanly 
 * restarted without port conflicts or other issues."
 * */
process.on('exit', () => {
    destroyAuthManager();
});
/**
 * listens for `'SIGINT'` `(Signal Interrupt)`
 * - "typically sent when a user presses Ctrl+C in the terminal or when an 
 * application receives an interrupt signal" 
 * */
process.on('SIGINT', () => {
    destroyAuthManager();
    STOP_RUNNING(0, `[configureAuth] process listener received SIGINT`);
});
/**
 * listens for `'SIGTERM'` `(Signal Terminate)` 
 * - "commonly used by process managers, container orchestrators like Docker, 
 * or system administrators to request a graceful shutdown of the application"
 * */
process.on('SIGTERM', () => {
    destroyAuthManager();
    STOP_RUNNING(0, `[configureAuth] process listener received SIGTERM`);
});
