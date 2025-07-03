/**
 * @file src/utils/api/get.ts
 * @TODO maybe rewrite the GET endpoing in GET_Record.js to have the request just be idProp, idVal, and recordType
 */
import axios from "axios";
import { writeObjectToJson as write, getCurrentPacificTime, indentedStringify } from "../io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "./url";
import { AxiosContentTypeEnum } from "../../server";
import { 
    GetRecordRequest, GetRecordResponse, idSearchOptions, idPropertyEnum, 
    RecordResponseOptions, RecordOperatorEnum, RecordTypeEnum, EntityRecordTypeEnum,
    SearchOperatorEnum
} from "./types";
import { getAccessToken, NOT_DYNAMIC, SB_REST_SCRIPTS } from "./configureRequests";
import { anyNull } from "../typeValidation";


export const GET_RECORD_SCRIPT_ID = SB_REST_SCRIPTS.GET_Record.scriptId as number;
export const GET_RECORD_DEPLOY_ID = SB_REST_SCRIPTS.GET_Record.deployId as number;

/**
 * @param request {@link GetRecordRequest}
 * @returns **`response`** - `Promise<`{@link GetRecordResponse}`>`
 */
export async function getRecordById(
    request: GetRecordRequest
): Promise<GetRecordResponse>
/**
 * @param recordType {@link RecordTypeEnum} | {@link EntityRecordTypeEnum}
 * @param recordId `string | number`
 * @param idProp {@link idPropertyEnum} - defaults to {@link idPropertyEnum.INTERNAL_ID}
 * @param responseOptions {@link RecordResponseOptions} - defaults to `{}` (empty object)
 * @returns **`response`** - `Promise<`{@link GetRecordResponse}`>`
 */
export async function getRecordById(
    recordType: RecordTypeEnum | string, 
    recordId: string | number, 
    idProp: idPropertyEnum,
    responseOptions: RecordResponseOptions
): Promise<GetRecordResponse>

/**
 * - {@link GET_RECORD_SCRIPT_ID} = `175`
 * - {@link GET_RECORD_DEPLOY_ID} = `1`
 *  */
export async function getRecordById(
    arg1: GetRecordRequest | RecordTypeEnum | string,
    arg2?: string | number,
    arg3?: idPropertyEnum,
    arg4?: RecordResponseOptions
): Promise<GetRecordResponse> {
    mlog.info(`[Start getRecordById()]`);
    const request = {} as GetRecordRequest;
    if (typeof arg1 === 'string') {
        if (anyNull(arg2, arg3)) {
            mlog.error('[get.ts getRecordById()] recordType or idValue is undefined. Cannot call RESTlet.');
            throw new Error('[get.ts getRecordById()] recordType or idValue is undefined. Cannot call RESTlet.');
        }
        const recordType = arg1;
        const recordId = arg2;
        const idProp = arg3;
        const responseOptions = arg4;
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
        return response.data as GetRecordResponse;
    } catch (error) {
        mlog.error('[Error in get.ts getRecordById()]:', error);
        write({error: error}, ERROR_DIR, 'ERROR_getRecordById.json');
        throw new Error('Failed to call RESTlet with request params: ' + JSON.stringify(request, null, 4));
    }
}

/**
 * @param accessToken `string`
 * @param scriptId `number`
 * @param deployId `number`
 * @param params `Record<string, any>` to pass as query parameters into the {@link URL}. constructed using {@link createUrlWithParams}
 * @returns **`response`** - `Promise<any>`
 */
export async function GET(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    params: Record<string, any>,
): Promise<any> {
    if (!params) {
        mlog.error('[get.ts GET()] params is undefined. Cannot call RESTlet.');
        throw new Error('[get.ts GET()] params is undefined. Cannot call RESTlet.');
    }
    if (!scriptId || !deployId) {
        mlog.error('[get.ts GET()] scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('[get.ts GET()] scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        mlog.error('[get.ts GET()] getAccessToken() is undefined. Cannot call RESTlet.');
        throw new Error('[get.ts GET()] getAccessToken() is undefined. Cannot call RESTlet.');
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
        mlog.error('[Error in get.ts GET()]:', error);
        write({error: error}, ERROR_DIR, 'ERROR_GET.json');
        throw new Error('Failed to call RESTlet with params');
    }
}