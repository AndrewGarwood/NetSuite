/**
 * @file src/utils/api/callApi.ts
 */
import axios from "axios";
import { writeObjectToJson as write, getCurrentPacificTime, indentedStringify } from "../io";
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "src/config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "./url";
import { getAccessToken, AxiosCallEnum, AxiosContentTypeEnum } from "src/server";
import { 
    BatchPostRecordRequest, BatchPostRecordResponse, PostRecordOptions, 
    PostRecordResult, RetrieveRecordByIdRequest, ScriptDictionary, DeleteRecordByTypeRequest } from "./types";

export const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
export const BATCH_SIZE = 100;
const TWO_SECOND_DELAY = 2000;

const BATCH_UPSERT_RECORD_SCRIPT_ID = SB_REST_SCRIPTS.POST_BatchUpsertRecord.scriptId as number;
const BATCH_UPSERT_RECORD_DEPLOY_ID = SB_REST_SCRIPTS.POST_BatchUpsertRecord.deployId as number;
const DELETE_RECORD_BY_TYPE_SCRIPT_ID = SB_REST_SCRIPTS.DELETE_DeleteRecordByType.scriptId as number;
const DELETE_RECORD_BY_TYPE_DEPLOY_ID = SB_REST_SCRIPTS.DELETE_DeleteRecordByType.deployId as number;
/**
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

/**
 * enforces max {@link BATCH_SIZE} of 100 records per payload e.g. if `payload.upsertRecordArray` > 100,
 * then split into multiple payloads of at most 100 records each
 * @param payload {@link BatchPostRecordRequest}
 * @param scriptId `number`
 * @param deployId `number`
 * @returns `responses` — `Promise<any[]>`
 */
export async function postRecordPayload(
    payload: BatchPostRecordRequest, 
    scriptId: number=BATCH_UPSERT_RECORD_SCRIPT_ID, 
    deployId: number=BATCH_UPSERT_RECORD_DEPLOY_ID,
): Promise<any[]> {
    if (!payload || Object.keys(payload).length === 0) {
        log.error('postRecordPayload() payload is undefined or empty. Cannot call RESTlet. Exiting...');
        STOP_RUNNING(1);
    }
    const { upsertRecordArray, upsertRecordDict, responseProps } = payload;
    const responses: any[] = [];
    // normalize payload size
    const batches: PostRecordOptions[][] = [];
    if (!upsertRecordDict 
        && Array.isArray(upsertRecordArray) 
        && upsertRecordArray.length > BATCH_SIZE
    ) {
        batches.push(...partitionArrayBySize(upsertRecordArray, BATCH_SIZE));
        
        for (let i = 0; i < batches.length; i++) {
            if (i < 53) continue; // continue where left off...
            const batch = batches[i];
            try {
                const accessToken = await getAccessToken();
                const res = await POST(
                    accessToken, scriptId, deployId,
                    { 
                        upsertRecordArray: batch, 
                        responseProps: responseProps 
                    } as BatchPostRecordRequest,
                );
                responses.push(res);
                await DELAY(TWO_SECOND_DELAY,
                    TAB + `finished batch ${i+1} of ${batches.length}`,
                    TAB + `batchIndex=${i} results: `, 
                    indentedStringify(((res.data as BatchPostRecordResponse).results as PostRecordResult[]).reduce((acc, postResult) => {
                            acc[postResult.recordType] = (acc[postResult.recordType] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>))
                );
                continue;
            } catch (error) {
                log.error(`Error in callApi.ts postRecordPayload().upsertRecordArray.POST(batchIndex=${i}):`, error);
                write({error: error}, ERROR_DIR, `ERROR_postRecordPayload_batch_${i}.json`);
                continue;
            }
        }
    } else {// else if ((upsertRecordDict && !upsertRecordArray) || upsertRecordArray) {
        // @TODO: handle upsertRecordDict size normalization
        // i.e. when (Object.values(upsertRecordDict).some((array) => Array.isArray(array) 
        // && array.length > BATCH_SIZE))   
        const accessToken = await getAccessToken();
        try {
            const res = await POST(accessToken, scriptId, deployId, payload);
            responses.push(res);
        } catch (error) {
            log.error('Error in callApi.ts postRecordPayload().upsertRecordDict.POST():', error);
            write({error: error}, ERROR_DIR, 'ERROR_postRecordPayload.json');
            throw error;
        }
    } 
    return responses;
}


/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {Record<string, any>} payload 
 * @param {PostPayload} contentType AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT. default = {@link AxiosContentTypeEnum.JSON},
 * @returns {Promise<any>}
 */
export async function POST(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    payload: Record<string, any> | any,
    contentType: AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT = AxiosContentTypeEnum.JSON,
): Promise<any> {
    if (!scriptId || !deployId) {
        log.error('callApi.ts POST().scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts POST().scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        log.error('callApi.ts POST().accessToken is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts POST().accessToken is undefined. Cannot call RESTlet.');
    }
    if (!payload) {
        log.error('callApi.ts POST().payload is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts POST().payload is undefined. Cannot call RESTlet.');
    }
    /** = `'${`{@link RESTLET_URL_STEM}`}?script=${scriptId}&deploy=${deployId}'` */
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, {
        script: scriptId,
        deploy: deployId,
    }).toString();
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
        write({error: error}, ERROR_DIR, 'ERROR_POST.json');
        throw new Error('Failed to call RESTlet with payload');
    }
}

/**
 * @param accessToken `string`
 * @param scriptId `number`
 * @param deployId `number`
 * @param params `Record<string, any>` to pass as query parameters into the {@link URL}. constructed using {@link createUrlWithParams}
 * @returns `response` - `{Promise<any>}`
 */
export async function GET(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    params: Record<string, any>,
): Promise<any> {
    if (!params) {
        log.error('callApi.ts GET() params is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts GET() params is undefined. Cannot call RESTlet.');
    }
    if (!scriptId || !deployId) {
        log.error('callApi.ts GET() scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts GET() scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        log.error('callApi.ts GET() getAccessToken() is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts GET() getAccessToken() is undefined. Cannot call RESTlet.');
    }
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, {
        script: scriptId,
        deploy: deployId,
        ...params,
    }).toString();
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
 * @param payload {@link DeleteRecordByTypeRequest}
 * @param scriptId `number` - default = {@link DELETE_RECORD_BY_TYPE_SCRIPT_ID}
 * @param deployId `number` - default = {@link DELETE_RECORD_BY_TYPE_DEPLOY_ID}
 * @returns `Promise<any>` - the response from the RESTlet
 */
export async function deleteRecordByType(
    payload: DeleteRecordByTypeRequest,
    scriptId: number=DELETE_RECORD_BY_TYPE_SCRIPT_ID,
    deployId: number=DELETE_RECORD_BY_TYPE_DEPLOY_ID
): Promise<any> {
    if (!payload || Object.keys(payload).length === 0) {
        log.error('postRecordPayload() payload is undefined or empty. Cannot call RESTlet. Exiting...');
        STOP_RUNNING(1);
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('postRecordPayload() getAccessToken() is undefined. Cannot call RESTlet. Exiting...');
        STOP_RUNNING(1);
    }
    try {
        const res = await DELETE(
            accessToken, 
            scriptId, 
            deployId, 
            payload
        );
        return res;
    } catch (error) {
        log.error('Error in callApi.ts deleteRecordByType()', error);
        write({error: error}, ERROR_DIR, 'ERROR_deleteRecordByType.json');
        throw error;
    }
}

/**
 * @param accessToken `string`
 * @param scriptId `number`
 * @param deployId `number`
 * @param params `Record<string, any>` to pass as query parameters into the {@link URL}. constructed using {@link createUrlWithParams}
 * @returns `response` - `{Promise<any>}`
 */
export async function DELETE(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    params: Record<string, any>,
): Promise<any> {
    if (!scriptId || !deployId) {
        log.error('callApi.ts DELETE() scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts DELETE() scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        log.error('callApi.ts DELETE() getAccessToken() is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts DELETE() getAccessToken() is undefined. Cannot call RESTlet.');
    }
    if (!params) {
        log.error('callApi.ts DELETE() params is undefined. Cannot call RESTlet.');
        throw new Error('callApi.ts DELETE() params is undefined. Cannot call RESTlet.');
    }
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, {
        script: scriptId,
        deploy: deployId,
        ...params,
    }).toString();
    try {
        const response = await axios.delete(restletUrl, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': AxiosContentTypeEnum.JSON,
            },
        });
        return response;
    } catch (error) {
        log.error('Error in callApi.ts DELETE():', error);
        write({error: error}, ERROR_DIR, 'ERROR_DELETE.json');
        throw new Error('Failed to call RESTlet with params: ' + JSON.stringify(params, null, 4));
    }
}


export async function retrieveRecordById(
    payload: RetrieveRecordByIdRequest,
    scriptId: number=SB_REST_SCRIPTS.GET_RetrieveRecordById.scriptId,
    deployId: number=SB_REST_SCRIPTS.GET_RetrieveRecordById.deployId,
): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('accessToken is undefined. Cannot call RESTlet.');
        STOP_RUNNING(1);
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
