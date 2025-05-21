/**
 * @file src/utils/api/callApi.ts
 */
import axios, { create } from "axios";
import { mainLogger as log } from "src/config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY  } from "../../config/env";
import { AxiosCallEnum, AxiosContentTypeEnum } from "../../server/types/AxiosEnums";
import { createUrlWithParams } from "./url";
import { getAccessToken } from "src/server/authServer";
import { BatchPostRecordRequest, RetrieveRecordByIdRequest, ScriptDictionary } from "./types";

export const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
export const BATCH_SIZE = 100;

/**
 * 
 * @param {Array<any>} arr `Array<any>`
 * @param {number} batchSize `number`
 * @returns {Array<Array<any>>} `batches` — `Array<Array<any>>`
 */
export function partitionArrayBySize(arr: Array<any>, batchSize: number): Array<Array<any>> {
    let batches = [];
    for (let i = 0; i < arr.length; i += batchSize) {
        batches.push(arr.slice(i, i + batchSize));
    }
    return batches;
}

export type PostPayload = AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT;


export async function postPayload(
    payload: BatchPostRecordRequest, 
    scriptId: number, 
    deployId: number,
): Promise<any> {
    let accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('sendPostPayload() getAccessToken() is undefined. Cannot call RESTlet.');
        STOP_RUNNING();
    }
    try {
        const res = await POST(
            accessToken,
            scriptId,
            deployId,
            payload,
        );
        return res;
    } catch (error) {
        log.error('Error in callApi.ts sendPostPayload()', error);
        throw error;
    }
}

export async function retrieveRecordById(
    payload: RetrieveRecordByIdRequest,
    scriptId: number=Number(SB_REST_SCRIPTS.GET_RetrieveRecordById.scriptId),
    deployId: number=Number(SB_REST_SCRIPTS.GET_RetrieveRecordById.deployId),
): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('accessToken is undefined. Cannot call RESTlet.');
        STOP_RUNNING();
    }
    try {
        const res = await GET(
            accessToken,
            scriptId,
            deployId,
            payload,
        )
        return res;
    } catch (error) {
        log.error('Error in callApi.ts callRetrieveRecordById()', error);
        throw error;
    }
}


/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {Record<string, any>} payload 
 * @returns {Promise<any>}
 */
export async function POST(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    payload: Record<string, any> | any,
    contentType: PostPayload = AxiosContentTypeEnum.JSON,
): Promise<any> {
    if (!scriptId || !deployId) {
        log.error('callApi.ts POST() scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        log.error('callApi.ts POST() getAccessToken() is undefined. Cannot call RESTlet.');
        throw new Error('getAccessToken() is undefined. Cannot call RESTlet.');
    }
    if (!payload) {
        log.error('callApi.ts POST() payload is undefined. Cannot call RESTlet.');
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
        log.error('Error in callApi.ts POST():', error);
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
export async function GET(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    params: Record<string, any>,
): Promise<any> {
    if (!params) {
        log.error('GET() params is undefined. Cannot call RESTlet.');
        throw new Error('params is undefined. Cannot call RESTlet.');
    }
    if (!scriptId || !deployId) {
        log.error('GET() scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        log.error('GET() getAccessToken() is undefined. Cannot call RESTlet.');
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
        log.error('Error in api.ts GET():', error);
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
export async function REST(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    callType: AxiosCallEnum,
    contentType: AxiosContentTypeEnum = AxiosContentTypeEnum.JSON,
): Promise<any> {
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, {
        script: scriptId,
        deploy: deployId,
    }).toString(); //`${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`;
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
        log.error('Error in callApi.ts REST():', error);
        throw new Error('Failed to call RESTlet');
    }
}