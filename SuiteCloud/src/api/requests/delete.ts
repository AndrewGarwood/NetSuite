/**
 * @file src/api/requests/delete.ts
 */
import axios from "axios";
import { 
    writeObjectToJson as write, getCurrentPacificTime, indentedStringify 
} from "../../utils/io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "../url";
import { AxiosContentTypeEnum } from "../server";
import { 
    DeleteRecordByTypeRequest, DeleteExcludeOptions, DeleteRecordByTypeResponse,
} from "../types";
import { SB_REST_SCRIPTS } from "../configureRequests";
import { getAccessToken } from "../configureAuth";
import path from "node:path";
import * as validate from "../../utils/argumentValidation";

const DELETE_RECORD_BY_TYPE_SCRIPT_ID = 
    SB_REST_SCRIPTS.DELETE_DeleteRecordByType.scriptId as number;
const DELETE_RECORD_BY_TYPE_DEPLOY_ID = 
    SB_REST_SCRIPTS.DELETE_DeleteRecordByType.deployId as number;

/**
 * @param accessToken `string`
 * @param scriptId `number`
 * @param deployId `number`
 * @param params `Record<string, any>` to pass as query parameters into the {@link URL}. constructed using {@link createUrlWithParams}
 * @returns **`response`** - `Promise<any>`
 */
async function DELETE(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    params: Record<string, any>,
): Promise<any> {
    const source = `${__filename}.DELETE`;
    validate.stringArgument(source, {accessToken});
    validate.numberArgument(source, {scriptId}, true);
    validate.numberArgument(source, {deployId}, true);
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
        mlog.error('Error in delete.DELETE():', error);
        write(
            {timestamp: getCurrentPacificTime(), error: error}, 
            path.join(ERROR_DIR, 'ERROR_DELETE.json')
        );
        throw new Error('Failed to call RESTlet with params: ' + JSON.stringify(params, null, 4));
    }
}

/**
 * @param payload {@link DeleteRecordByTypeRequest}
 * @param scriptId `number` - default = {@link DELETE_RECORD_BY_TYPE_SCRIPT_ID}
 * @param deployId `number` - default = {@link DELETE_RECORD_BY_TYPE_DEPLOY_ID}
 * @returns **`response`** - `Promise<any>`
 */
export async function deleteRecordByType(
    payload: DeleteRecordByTypeRequest,
    scriptId: number=DELETE_RECORD_BY_TYPE_SCRIPT_ID,
    deployId: number=DELETE_RECORD_BY_TYPE_DEPLOY_ID
): Promise<DeleteRecordByTypeResponse> {
    const source = `${__filename}.deleteRecordByType`;
    validate.numberArgument(source, {scriptId}, true);
    validate.numberArgument(source, {deployId}, true);
    validate.objectArgument(source, {payload});
    const accessToken = await getAccessToken();
    if (!accessToken) {
        mlog.error('[deleteRecordByType()] getAccessToken() is undefined. Cannot call RESTlet. Exiting...');
        return {} as DeleteRecordByTypeResponse;
    }
    try {
        const res = await DELETE(
            accessToken, 
            scriptId, 
            deployId, 
            payload
        );
        return res.data as DeleteRecordByTypeResponse;
    } catch (error) {
        mlog.error('Error in delete.deleteRecordByType()', error);
        write(
            {timestamp: getCurrentPacificTime(), error: error}, 
            path.join(ERROR_DIR, 'ERROR_deleteRecordByType.json')
        );
        throw error;
    }
}