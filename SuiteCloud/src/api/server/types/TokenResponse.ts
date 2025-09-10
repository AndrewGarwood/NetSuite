/**
 * @file src/api/server/types/TokenResponse.ts
 * @see {@link https://www.oauth.com/oauth2-servers/access-tokens/}
 */
/**
 * @interface **`TokenResponse`**
 * */
export interface TokenResponse {
    access_token: string;
    /** defined if tokenResponse is from exchangeAuthCode() */
    refresh_token?: string;
    /** Can come from server as `string` but should be normalized to `number` */
    expires_in: number | string;
    /** 
     * `number` time token was last updated in `milliseconds` 
     * - from `Date.now()`
     */
    lastUpdated?: number;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
    [key: string]: any;
}