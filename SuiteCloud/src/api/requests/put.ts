/**
 * @file src/api/requests/put.ts
 */
import axios from "axios";
import { writeObjectToJson as write, getCurrentPacificTime, indentedStringify, getFileNameTimestamp, isRecordOptions } from "../../utils/io";
import { apiLogger as alog, mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "../url";
import { AxiosContentTypeEnum } from "../server";
import { 
    RecordRequest, RecordResponse, RecordOptions, RecordResponseOptions,
    RecordResult,
} from "../types";
import { BATCH_SIZE, partitionArrayBySize, SB_REST_SCRIPTS, TWO_SECONDS } from "../configureRequests";
import { getAccessToken } from "../configureAuth";
import path from "node:path";
import * as validate from "../../utils/argumentValidation";
import { isEmptyArray } from "src/utils/typeValidation";

const UPSERT_RECORD_SCRIPT_ID = SB_REST_SCRIPTS.PUT_UpsertRecord.scriptId as number;
const UPSERT_RECORD_DEPLOY_ID = SB_REST_SCRIPTS.PUT_UpsertRecord.deployId as number;
/**
 * enforces a max number of records per post call (see {@link BATCH_SIZE}) 
 * - e.g. if `payload.postOptions.length` > BATCH_SIZE_100,
 * then split into multiple payloads of at most 50 records each
 * @param payload {@link RecordRequest}
 * @param scriptId `number`
 * @param deployId `number`
 * @returns **`responses`** — `Promise<`{@link RecordResponse}`[]>`
 */
export async function upsertRecordPayload(
    payload: RecordRequest,
    scriptId: number=UPSERT_RECORD_SCRIPT_ID, 
    deployId: number=UPSERT_RECORD_DEPLOY_ID,
): Promise<RecordResponse[]> {
    const source = `${__filename}.upsertRecordPayload`;
    validate.numberArgument(source, {scriptId}, true);
    validate.numberArgument(source, {deployId}, true);
    validate.objectArgument(source, {payload});
    const { recordOptions, responseOptions } = payload;
    const upsertRecordArray = (Array.isArray(recordOptions) 
        ? recordOptions : isRecordOptions(recordOptions) ? [recordOptions] : []
    );
    if (isEmptyArray(upsertRecordArray)) return []
    // for (const record of upsertRecordArray) {
    //     if (record.meta) delete record.meta;
    // }
    const responseDataArr: RecordResponse[] = [];
    const batches: RecordOptions[][] = partitionArrayBySize(
        upsertRecordArray, BATCH_SIZE
    );
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
            const accessToken = await getAccessToken();
            const res = await PUT(
                accessToken, scriptId, deployId, { 
                    recordOptions: batch, 
                    responseOptions: responseOptions, 
                } as RecordRequest,
            );
            if (!res || !res.data) {
                mlog.warn(`[put.upsertRecordPayload()] batchIndex=${i} res.data is undefined. Skipping...`);
                continue;
            }
            const resData = res.data as RecordResponse;
            responseDataArr.push(resData);
            const summary = (resData.results as RecordResult[])
                .reduce((acc, result) => {
                    acc[result.recordType] = (acc[result.recordType] || 0) + 1;
                    return acc;
                }, {} as Record<string, any>
            );
            summary.numSuccess = (resData?.results?.length || 0);
            summary.numFailed = (resData?.rejects?.length || 0);
            summary.batchSize = batch.length;
            // summary.successRatio = (resData?.results?.length || 0) / batch.length;
            mlog.info(
                `[put.upsertRecordPayload()] finished batch ${i+1} of ${batches.length};`,
                ( summary.numFailed > 0 ? TAB+`summary: ${indentedStringify(summary)}` : '')
            );
            await DELAY(TWO_SECONDS, null);
            continue;
        } catch (error) {
            mlog.error(`[put.upsertRecordPayload()] Error in put payload (batchIndex=${i}):`, 
                (error as any)
            );
            write(
                {timestamp: getCurrentPacificTime(), batchIndex: i, caught: (error as any)}, 
                path.join(ERROR_DIR, `ERROR_upsertRecordPayload_batch_${i}.json`)
            );
            continue;
        }
    }
    return responseDataArr;
}

/**
 * @param accessToken `string` - see {@link getAccessToken}
 * @param scriptId `number`
 * @param deployId `number`
 * @param payload `Record<string, any> | any` - the payload to send to the RESTlet
 * @param contentType {@link AxiosContentTypeEnum}`.JSON | AxiosContentTypeEnum.PLAIN_TEXT`. default = {@link AxiosContentTypeEnum.JSON},
 * @returns **`response`** - `Promise<any>` - the response from the RESTlet
 */
async function PUT(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    payload: Record<string, any> | any,
    contentType: AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT = AxiosContentTypeEnum.JSON,
): Promise<any> {
    const source = `${__filename}.PUT`;
    validate.multipleStringArguments(source, {accessToken, contentType});
    validate.numberArgument(source, {scriptId}, true);
    validate.numberArgument(source, {deployId}, true);
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
        mlog.error(`[PUT()] ERROR: ${(error as any).message 
                ? (error as any).message 
                : JSON.stringify(error as any)
            }`
        );
        write(
            {timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_${source}.json`)
        );
        throw new Error('[PUT()] Failed to call RESTlet with payload');
    }
}