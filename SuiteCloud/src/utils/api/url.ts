/**
 * @file src/utils/api/url.ts
 */

import { REDIRECT_URI } from "src/config/env";
import { GrantTypeEnum } from "src/server/types";
import { exchangeAuthCodeForTokens, exchangeRefreshTokenForNewTokens } from "src/server/authServer";


export type SearchParamValue = string | number | boolean;
/**
 * Creates a URL object with search parameters from a dictionary.
 * @note do not encode values in the dictionary, as they will be encoded by the URL automatically when appended to searchParams.
 * @param {string} baseUrl - The base URL as a string.
 * @param {Record<string, SearchParamValue | Array<SearchParamValue>>} searchParamsDict - An object containing key-value pairs for search parameters ({@link SearchParamValue} = `string | number | boolean`).
 * @returns {URL} A new {@link URL} object with the search parameters added.
 * @example createUrlWithParams(baseUrl: "https://example.com/api", searchParamsDict: { record: "true", hydrate: "FAVORITE" }) => url 
 * url.toString() = "https://example.com/api?record=true&hydrate=FAVORITE"
 */
export function createUrlWithParams(
    baseUrl: string, 
    searchParamsDict: { [s: string]: SearchParamValue | Array<SearchParamValue>; }
): URL {
    if (!baseUrl || typeof baseUrl !== "string") {
        throw new Error("baseUrlString must be a valid string.");
    }
    if (!searchParamsDict || typeof searchParamsDict !== "object") {
        throw new Error("searchParamsDict must be a valid object.");
    }

    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(searchParamsDict)) {
        if (typeof value === "string") {
            url.searchParams.append(key, value);
        } else if (Array.isArray(value)) {
            value.forEach(val => url.searchParams.append(key, String(val)));
        } else {
            throw new Error(`Value for key ${key} must be a primitives or an array of primitives.`);
        }
    }
    return url;
}


/**
 * @param code - The authorization code received from the OAuth callback. is defined when this function is called in {@link exchangeAuthCodeForTokens}`(authCode)` 
 * - code !== undefined -> grant_type=authorization_code
 * @param refreshToken - The refresh token received from the initial token response. is defined when this function is called in {@link exchangeRefreshTokenForNewTokens}`(refreshToken)` 
 * - refreshToken !== undefined -> grant_type=refresh_token
 * @param redirectUri - The redirect URI used in the OAuth flow. Default is {@link REDIRECT_URI}.
 * @returns {URLSearchParams} params, see {@link URLSearchParams}
 * @reference {@link https://nodejs.org/api/url.html#class-urlsearchparams}
 */
export function generateAxiosParams(
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
