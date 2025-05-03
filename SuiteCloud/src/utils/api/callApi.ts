/**
 * @file src/utils/api/callApi.ts
 */
import axios from "axios";
import { RESTLET_URL_STEM } from "../../config/env";
import { AxiosCallEnum, AxiosContentTypeEnum } from "../../server/types/AxiosEnums";
import { createUrlWithParams } from "./url";

export type PostPayload = AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT;
/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {Record<string, any>} payload 
 * @returns {Promise<any>}
 */
export async function callPostRestletWithPayload(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    payload: Record<string, any> | any,
    contentType: PostPayload = AxiosContentTypeEnum.JSON,
): Promise<any> {
    if (!scriptId || !deployId) {
        console.error('callPostRestletWithPayload() scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        console.error('callPostRestletWithPayload() getAccessToken() is undefined. Cannot call RESTlet.');
        throw new Error('getAccessToken() is undefined. Cannot call RESTlet.');
    }
    if (!payload) {
        console.error('callPostRestletWithPayload() payload is undefined. Cannot call RESTlet.');
        throw new Error('payload is undefined. Cannot call RESTlet.');
    }
    const restletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`;
    try {
        const response = await axios.post(restletUrl, payload, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
            },
        });
        return response;
    } catch (error) {
        console.error('Error in api.ts callPostRestletWithPayload():', error);
        throw new Error('Failed to call RESTlet with payload');
    }
}

/**
 * 
 * @param accessToken 
 * @param scriptId 
 * @param deployId 
 * @param params `Record<string, any>` to pass as query parameters into the {@link URL}. constructed using {@link createUrlWithParams}
 * @returns {Promise<any>}
 */
export async function callGetRestletWithParams(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    params: Record<string, any>,
): Promise<any> {
    if (!params) {
        console.error('callGetRestletWithParams() params is undefined. Cannot call RESTlet.');
        throw new Error('params is undefined. Cannot call RESTlet.');
    }
    if (!scriptId || !deployId) {
        console.error('callGetRestletWithParams() scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        console.error('callGetRestletWithParams() getAccessToken() is undefined. Cannot call RESTlet.');
        throw new Error('getAccessToken() is undefined. Cannot call RESTlet.');
    }
    params.script = scriptId;
    params.deploy = deployId;
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, params).toString();
    try {
        const response = await axios.get(restletUrl, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': AxiosContentTypeEnum.JSON,
            },
        });
        return response;
    } catch (error) {
        console.error('Error in api.ts callGetRestletWithParams():', error);
        throw new Error('Failed to call RESTlet with params');
    }
}

/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {AxiosCallEnum} callType {@link AxiosCallEnum}
 * @param {AxiosContentTypeEnum} contentType {@link AxiosContentTypeEnum}
 * @returns {Promise<any>}
 */
export async function callRestlet(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    callType: AxiosCallEnum,
    contentType: AxiosContentTypeEnum = AxiosContentTypeEnum.JSON,
): Promise<any> {
    const restletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`;
    try {
        const response = await axios({
            method: callType,
            url: restletUrl,
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
            },
        });
        return response;
    } catch (error) {
        console.error('Error in api_calls.ts callRestlet():', error);
        throw new Error('Failed to call RESTlet');
    }
}
