/**
 * @file src/server/types/TokenResponse.ts
 * @module TokenResponse
 * @see {@link https://www.oauth.com/oauth2-servers/access-tokens/}
 */
import { getCurrentPacificTime } from '../../utils/io/dateTime';
/**
 * @interface **`TokenResponse`**
 * @description Represents the response from the token endpoint.
 * @property {string} access_token - The access token.
 * @property {string} refresh_token - The refresh token.
 * @property {number} expires_in - The expiration time of the access token in seconds.
 * @property {string} [lastUpdated] - TThe last updated time of the token (optional). manually added by setting TokenResponse.lastUpdated = {@link getCurrentPacificTime}() at the time of the response.
 * - maybe change to just use `Date().getTime()`
 * @property {string} [token_type] - The type of the token (e.g., "Bearer").
 * @property {string} [scope] - The scope of the access token (optional).
 * @property {string} [error] - Error message if the request failed (optional).
 * @property {string} [error_description] - Description of the error (optional).
 * @property {any} [key: string] - Additional properties (optional).
*/
export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    /**
     * The last updated time of the token (optional). 
     * manually added by setting TokenResponse.lastUpdated = {@link getCurrentPacificTime}`()` at the time of the response. 
     * */
    lastUpdated?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
    [key: string]: any; // Allow additional properties
}