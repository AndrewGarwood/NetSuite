/**
 * @file src/api/requests/delete.ts
 */
import axios from "axios";
import { 
    writeObjectToJsonSync as write, getCurrentPacificTime, indentedStringify, 
    getSourceString
} from "typeshi:utils/io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, getSandboxRestScript, getProjectFolders  } from "../../config/env";
import { createUrlWithParams } from "../url";
import { AxiosContentTypeEnum } from "../server";
import { getAccessToken } from "../configureAuth";
import path from "node:path";
import * as validate from "typeshi:utils/argumentValidation";
import { isSingleRecordRequest, RecordResponse, SingleRecordRequest } from "../types";
import { extractFileName } from "@typeshi/regex";

const F = extractFileName(__filename);

export async function deleteRecord(
    request: SingleRecordRequest
): Promise<RecordResponse> {
    const source = getSourceString(F, deleteRecord.name);
    validate.objectArgument(source, {request, isSingleRecordRequest})
    try {
        const accessToken = await getAccessToken();
        const response = await DELETE(
            accessToken, 
            getSandboxRestScript("DELETE_Record").scriptId, 
            getSandboxRestScript("DELETE_Record").deployId, 
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
            path.join(getProjectFolders().logDir, 'errors', 'ERROR_deleteRecord.json')
        );
        throw new Error(`${source} Failed, unable to return RecordResponse`);
    }
}

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
    const source = `[${F}.DELETE()]`;
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
            path.join(getProjectFolders().logDir, 'errors', 'ERROR_DELETE.json')
        );
        throw new Error('Failed to call RESTlet with params: ' + JSON.stringify(params, null, 4));
    }
}
