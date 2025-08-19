/**
 * @file src/api/requests/get.ts
 * @TODO maybe rewrite the GET endpoint in GET_Record.js to have the request just be idProp, idVal, and recordType
 */
import axios from "axios";
import { 
    writeObjectToJsonSync as write, getCurrentPacificTime, indentedStringify 
} from "typeshi/dist/utils/io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "../url";
import { AxiosContentTypeEnum } from "../server";
import { 
    idSearchOptions, idPropertyEnum, 
    RecordResponseOptions,
    isRecordResponseOptions,
    RecordResponse,
    RelatedRecordRequest,
    isRelatedRecordRequest,
} from "../types";
import { SB_REST_SCRIPTS } from "../configureRequests";
import { getAccessToken } from "../configureAuth";
import path from "node:path";
import { RecordTypeEnum } from "../../utils/ns/record/Record";
import { SearchOperatorEnum } from "../../utils/ns/search/Search";
import * as validate from "typeshi/dist/utils/argumentValidation";
import { GetRecordRequest } from "./types";

const F = path.basename(__filename).replace(/\.[a-z]{1,}$/, '');
export const GET_RECORD_SCRIPT_ID = SB_REST_SCRIPTS.GET_Record.scriptId as number;
export const GET_RECORD_DEPLOY_ID = SB_REST_SCRIPTS.GET_Record.deployId as number;

/**
 * @param request {@link GetRecordRequest}
 * @returns **`response`** - `Promise<`{@link RecordResponse}`>`
 */
export async function getRecordById(
    request: GetRecordRequest
): Promise<RecordResponse>
/**
 * @param recordType {@link RecordTypeEnum} | {@link EntityRecordTypeEnum}
 * @param recordId `string | number`
 * @param idProp {@link idPropertyEnum} - defaults to {@link idPropertyEnum.INTERNAL_ID}
 * @param responseOptions {@link RecordResponseOptions} - defaults to `{}` (empty object)
 * @returns **`response`** - `Promise<`{@link RecordResponse}`>`
 */
export async function getRecordById(
    recordType: RecordTypeEnum | string, 
    recordId: string | number, 
    idProp: idPropertyEnum,
    responseOptions: RecordResponseOptions
): Promise<RecordResponse>

/**
 * - {@link GET_RECORD_SCRIPT_ID} = `175`
 * - {@link GET_RECORD_DEPLOY_ID} = `1`
 *  */
export async function getRecordById(
    arg1: GetRecordRequest | RecordTypeEnum | string,
    recordId?: string | number,
    idProp?: idPropertyEnum,
    responseOptions?: RecordResponseOptions
): Promise<RecordResponse> {
    const source = `[get.getRecordById()]`
    const request = {} as GetRecordRequest;
    if (typeof arg1 === 'string') {
        validate.enumArgument(source, {recordType: arg1, RecordTypeEnum});
        validate.stringArgument(source, {idProp})
        validate.objectArgument(source, {responseOptions, isRecordResponseOptions})
        const recordType = arg1;
        const idValue = (idProp === idPropertyEnum.INTERNAL_ID 
            ? Number(recordId) 
            : String(recordId)
        );
        const searchOperator = (idProp === idPropertyEnum.INTERNAL_ID 
            ? SearchOperatorEnum.RECORD.ANY_OF 
            : SearchOperatorEnum.TEXT.IS
        );
        Object.assign(request, {
            recordType,
            idOptions: [{ idProp, idValue, searchOperator }] as idSearchOptions[],
            responseOptions,
        } as GetRecordRequest);
    } else {
        Object.assign(request, arg1);
    }
    try {
        const accessToken = await getAccessToken();
        const response = await GET(
            accessToken,
            GET_RECORD_SCRIPT_ID,
            GET_RECORD_DEPLOY_ID,
            request
        );
        return response.data as RecordResponse;
    } catch (error: any) {
        mlog.error([`${source} ERROR:`,
            `   name: ${error.name}`,
            `   code: ${error.code}`,
            `message: ${error.message}`,
            `  stack: ${error.stack}`
        ].join(TAB));
        write(
            {timestamp: getCurrentPacificTime(), caught: error}, 
            path.join(ERROR_DIR, 'ERROR_getRecordById.json')
        );
        throw new Error('Failed to call GET_Record RESTlet');
    }
}

export async function getRelatedRecord(
    request: RelatedRecordRequest
): Promise<RecordResponse> {
    const source = `[${F}.${getRelatedRecord.name}()]`;
    validate.objectArgument(source, {request, isRelatedRecordRequest});
    try {
        const accessToken = await getAccessToken();
        const response = await GET(
            accessToken,
            SB_REST_SCRIPTS.GET_RelatedRecord.scriptId,
            SB_REST_SCRIPTS.GET_RelatedRecord.deployId,
            request
        );
        return response.data as RecordResponse
    } catch (error: any) {
        mlog.error([`${source} ERROR:`,
            `   name: ${error.name}`,
            `   code: ${error.code}`,
            `message: ${error.message}`,
            `  stack: ${error.stack}`
        ].join(TAB));
        write(
            {timestamp: getCurrentPacificTime(), caught: error}, 
            path.join(ERROR_DIR, 'ERROR_getRelatedRecord.json')
        );
        throw new Error(`${source} Failed, unable to return RecordResponse`);
    }
}




/**
 * @param accessToken `string`
 * @param scriptId `number`
 * @param deployId `number`
 * @param params `Record<string, any>` to pass as query parameters into the {@link URL}. 
 * - constructed using {@link createUrlWithParams}
 * @returns **`response`** - `Promise<any>`
 */
export async function GET(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    params: Record<string, any>,
): Promise<any> {
    const source = `[get.GET()]`;
    validate.stringArgument(source, {accessToken});
    validate.numberArgument(source, {scriptId}, true);
    validate.numberArgument(source, {deployId}, true);
    validate.objectArgument(source, {params});
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
        let e = error as any || {}
        mlog.error([`${source} ERROR:`,
            `   name: ${e.name}`,
            `   code: ${e.code}`,
            `message: ${e.message}`,
            `  stack: ${e.stack}`
        ].join(TAB));
        write(
            {timestamp: getCurrentPacificTime(), caught: error}, 
            path.join(ERROR_DIR, 'ERROR_GET.json')
        );
        throw new Error('[get.GET()] Failed to call RESTlet with params');
    }
}