/**
 * @file src/utils/api/callApi.ts
 */
import axios from "axios";
import { writeObjectToJson as write } from "../io";
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "src/config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR  } from "../../config/env";
import { createUrlWithParams } from "./url";
import { getAccessToken, AxiosCallEnum, AxiosContentTypeEnum } from "src/server";
import { BatchPostRecordRequest, BatchPostRecordResponse, PostRecordOptions, RetrieveRecordByIdRequest, ScriptDictionary } from "./types";

export const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
export const BATCH_SIZE = 100;

const BATCH_UPSERT_SCRIPT_ID = SB_REST_SCRIPTS.POST_BatchUpsertRecord.scriptId as number;
const BATCH_UPSERT_DEPLOY_ID = SB_REST_SCRIPTS.POST_BatchUpsertRecord.deployId as number;
/**
 * 
 * @param {Array<any>} arr `Array<any>`
 * @param {number} batchSize `number`
 * @returns {Array<Array<any>>} `batches` — `Array<Array<any>>`
 */
export function partitionArrayBySize(
    arr: Array<any>, 
    batchSize: number
): Array<Array<any>> {
    let batches = [];
    for (let i = 0; i < arr.length; i += batchSize) {
        batches.push(arr.slice(i, i + batchSize));
    }
    return batches;
}

export type PostPayload = AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT;

/**
 * enforces max batch size of 100 records per payload e.g. if `payload.upsertRecordArray` > 100,
 * then split into multiple payloads of at most 100 records each
 * @param payload {@link BatchPostRecordRequest}
 * @param scriptId `number`
 * @param deployId `number`
 * @returns `responses` — `Promise<any[]>`
 */
export async function postRecordPayload(
    payload: BatchPostRecordRequest, 
    scriptId: number=BATCH_UPSERT_SCRIPT_ID, 
    deployId: number=BATCH_UPSERT_DEPLOY_ID,
): Promise<any[]> {
    if (!payload || Object.keys(payload).length === 0) {
        log.error('postRecordPayload() payload is undefined or empty. Cannot call RESTlet.');
        STOP_RUNNING(1);
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('postRecordPayload() getAccessToken() is undefined. Cannot call RESTlet.');
        STOP_RUNNING(1);
    }
    const { upsertRecordArray, upsertRecordDict, responseProps } = payload;
    const responses: any[] = [];
    // normalize payload size
    const batches: PostRecordOptions[][] = [];
    if (!upsertRecordDict && Array.isArray(upsertRecordArray) && upsertRecordArray.length > BATCH_SIZE) {
        batches.push(...partitionArrayBySize(upsertRecordArray, BATCH_SIZE));
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            let batchPayloadSummary: Record<string, number> = {};
            for (const options of upsertRecordArray) {
                const recordType = options.recordType;
                if (recordType) {
                    if (!batchPayloadSummary[recordType]) {
                        batchPayloadSummary[recordType] = 0;
                    }
                    batchPayloadSummary[recordType]++;
                }
            } 
            try {
                const res = await POST(
                    accessToken, scriptId, deployId,
                    { 
                        upsertRecordArray: batch, 
                        responseProps: responseProps 
                    } as BatchPostRecordRequest,
                );
                responses.push(res);
                await DELAY(1000); 
                log.debug(
                    `finished batch ${i+1} of ${batches.length}`, 
                    TAB + `batchPayloadSummary: ${JSON.stringify(batchPayloadSummary)}`
                );
            } catch (error) {
                log.error(`Error in callApi.ts postRecordPayload().upsertRecordArray.POST(batchIndex=${i}):`, error);
                throw error;
            }
        }
    } else {// else if ((upsertRecordDict && !upsertRecordArray) || upsertRecordArray) {
        // @TODO: handle upsertRecordDict size normalization
        // i.e. when (Object.values(upsertRecordDict).some((array) => Array.isArray(array) 
        // && array.length > BATCH_SIZE))
        try {
            const res = await POST(accessToken, scriptId, deployId, payload);
            responses.push(res);
        } catch (error) {
            log.error('Error in callApi.ts postRecordPayload().upsertRecordDict.POST():', error);
            throw error;
        }
    } 
    return responses;
}

export async function retrieveRecordById(
    payload: RetrieveRecordByIdRequest,
    scriptId: number=SB_REST_SCRIPTS.GET_RetrieveRecordById.scriptId,
    deployId: number=SB_REST_SCRIPTS.GET_RetrieveRecordById.deployId,
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
        log.error('Error in callApi.ts retrieveRecordById()', error);
        throw error;
    }
}


/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {Record<string, any>} payload 
 * @param {PostPayload} contentType {@link PostPayload}. default = {@link AxiosContentTypeEnum.JSON},
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
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, {
        script: scriptId,
        deploy: deployId,
    }).toString(); //`${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`;
    try {
        const response = await axios.post(restletUrl, payload, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
            },
        });
        return response;
    } catch (error) {
        log.error('Error in callApi.ts POST():');//, error);
        write({error: error}, 'ERROR_POST.json', OUTPUT_DIR);
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
 * @param {string} accessToken `string`
 * @param {string | number} scriptId `number`
 * @param {string | number} deployId `number`
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