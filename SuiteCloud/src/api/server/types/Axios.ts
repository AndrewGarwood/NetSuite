/**
 * @file src/api/server/types/AxiosEnums.ts
 */

/**
 * @enum {string} **`GrantTypeEnum`**
 * @description Enum for OAuth2 grant types.
 * @property {string} AUTHORIZATION_CODE - Authorization code grant type.
 * @property {string} REFRESH_TOKEN - Refresh token grant type.
 */
export enum GrantTypeEnum {
    AUTHORIZATION_CODE='authorization_code',
    REFRESH_TOKEN='refresh_token',
}

/**
 * @enum {string} **`AxiosCallEnum`**
 * @description Enum for Axios HTTP methods.
 * @property {string} GET - HTTP GET method.
 * @property {string} POST - HTTP POST method.
 * @property {string} PUT - HTTP PUT method.
 * @property {string} DELETE - HTTP DELETE method.
 */
export enum AxiosCallEnum {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
}


/**
 * @enum {string} **`AxiosContentTypeEnum`**
 * @description Enum for Content-Type headers.
 * @property {string} JSON - application/json
 * @property {string} TEXT - text/plain
 * @property {string} XML - application/xml
 * @property {string} FORM_URLENCODED - application/x-www-form-urlencoded
 */
export enum AxiosContentTypeEnum {
    JSON = 'application/json',
    PLAIN_TEXT = 'text/plain',
    XML = 'application/xml',
    FORM_URL_ENCODED = 'application/x-www-form-urlencoded',
}