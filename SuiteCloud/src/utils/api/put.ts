/**
 * @file src/utils/api/put.ts
 */
import axios from "axios";
import { writeObjectToJson as write, getCurrentPacificTime, indentedStringify } from "../io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "./url";
import { getAccessToken, AxiosContentTypeEnum } from "../../server";
import { 
    PostRecordRequest, PostRecordResponse, PostRecordOptions, RecordResponseOptions,
    RecordResult,
} from "./types";
import { BATCH_SIZE, partitionArrayBySize, SB_REST_SCRIPTS, TWO_SECONDS } from "./configureRequests";


const UPSERT_RECORD_SCRIPT_ID = SB_REST_SCRIPTS.PUT_UpsertRecord.scriptId as number;
const UPSERT_RECORD_DEPLOY_ID = SB_REST_SCRIPTS.PUT_UpsertRecord.deployId as number;
/**
 * enforces max number of 100 records per post call (see {@link BATCH_SIZE}) 
 * - e.g. if `payload.postOptions.length` > BATCH_SIZE_100,
 * then split into multiple payloads of at most 100 records each
 * @param payload {@link PostRecordRequest}
 * @param scriptId `number`
 * @param deployId `number`
 * @returns **`responses`** — `Promise<`{@link PostRecordResponse}`[]>`
 */
export async function upsertRecordPayload(
    payload: PostRecordRequest,
    scriptId: number=UPSERT_RECORD_SCRIPT_ID, 
    deployId: number=UPSERT_RECORD_DEPLOY_ID,
): Promise<PostRecordResponse[]> {
    if (!payload || Object.keys(payload).length === 0) {
        mlog.error(`upsertRecordPayload() 'payload' parameter is undefined or empty. Cannot call RESTlet. Exiting...`);
        STOP_RUNNING(1);
    }
    const { postOptions, responseOptions } = payload;
    const upsertRecordArray = (Array.isArray(postOptions) 
        ? postOptions : [postOptions]
    );
    const responseDataArr: PostRecordResponse[] = [];
    // normalize payload size
    const batches: PostRecordOptions[][] = partitionArrayBySize(
        upsertRecordArray, BATCH_SIZE
    );
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
            const accessToken = await getAccessToken();
            const res = await PUT(
                accessToken, scriptId, deployId, { 
                    postOptions: batch, 
                    responseOptions: responseOptions, 
                } as PostRecordRequest,
            );
            await DELAY(TWO_SECONDS, null);
            if (!res || !res.data) {
                mlog.warn(`upsertRecordPayload() batchIndex=${i} res.data is undefined. Skipping...`);
                continue;
            }
            const resData = res.data as PostRecordResponse;
            responseDataArr.push(resData);
            const summary = (resData.results as RecordResult[])
                .reduce((acc, postResult) => {
                    acc[postResult.recordType] = (acc[postResult.recordType] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>
            );
            mlog.debug(
                `upsertRecordPayload() finished batch ${i+1} of ${batches.length};`,
                `numResults/numRequested = (${resData?.results?.length || 0}/${batch.length})`,
                TAB+`summary:`, indentedStringify(summary)
            );
            continue;
        } catch (error) {
            mlog.error(`Error in put.ts upsertRecordPayload().upsertRecordArray.PUT(batchIndex=${i}):`);
            write({timestamp: getCurrentPacificTime(), caught: error}, ERROR_DIR, `ERROR_upsertRecordPayload_batch_${i}.json`);
            continue;
        }
    }
    return responseDataArr;
}

/**
 * @param accessToken `string`
 * @param scriptId `number` - the script ID of the RESTlet to call
 * @param deployId `number` - the deploy ID of the RESTlet to call
 * @param payload `Record<string, any> | any` - the payload to send to the RESTlet
 * @param contentType {@link AxiosContentTypeEnum}`.JSON | AxiosContentTypeEnum.PLAIN_TEXT`. default = {@link AxiosContentTypeEnum.JSON},
 * @returns **`response`** - `Promise<any>` - the response from the RESTlet
 */
export async function PUT(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    payload: Record<string, any> | any,
    contentType: AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT = AxiosContentTypeEnum.JSON,
): Promise<any> {
    if (!scriptId || !deployId) {
        mlog.error('put.ts PUT().scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('put.ts PUT().scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        mlog.error('put.ts PUT().accessToken is undefined. Cannot call RESTlet.');
        throw new Error('put.ts PUT().accessToken is undefined. Cannot call RESTlet.');
    }
    if (!payload) {
        mlog.error('put.ts PUT().payload is undefined. Cannot call RESTlet.');
        throw new Error('put.ts PUT().payload is undefined. Cannot call RESTlet.');
    }
    /** = `'${`{@link RESTLET_URL_STEM}`}?script=${scriptId}&deploy=${deployId}'` */
    const restletUrl = createUrlWithParams(RESTLET_URL_STEM, {
        script: scriptId,
        deploy: deployId,
    }).toString();
    try {
        const response = await axios.put(restletUrl, payload, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
            },
        });
        return response;
    } catch (error) {
        mlog.error('Error in put.ts PUT():');//, error);
        write({timestamp: getCurrentPacificTime(), caught: error}, ERROR_DIR, 'ERROR_PUT.json');
        throw new Error('Failed to call RESTlet with payload');
    }
}