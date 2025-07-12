/**
 * @file src/utils/api/post.ts
 */
import axios from "axios";
import { writeObjectToJson as write, getCurrentPacificTime, indentedStringify } from "../io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "./url";
import { AxiosContentTypeEnum } from "../../server";
import { 
    RecordRequest, RecordResponse, RecordOptions, RecordResponseOptions,
    RecordResult,
} from "./types";
import { BATCH_SIZE, partitionArrayBySize, SB_REST_SCRIPTS, TWO_SECONDS } from "./configureRequests";


/**
 * @param accessToken `string`
 * @param scriptId `number` - the script ID of the RESTlet to call
 * @param deployId `number` - the deploy ID of the RESTlet to call
 * @param payload `Record<string, any> | any` - the payload to send to the RESTlet
 * @param contentType {@link AxiosContentTypeEnum}`.JSON | AxiosContentTypeEnum.PLAIN_TEXT`. default = {@link AxiosContentTypeEnum.JSON},
 * @returns **`response`** - `Promise<any>` - the response from the RESTlet
 */
export async function POST(
    accessToken: string, 
    scriptId: number, 
    deployId: number,
    payload: Record<string, any> | any,
    contentType: AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT = AxiosContentTypeEnum.JSON,
): Promise<any> {
    if (!scriptId || !deployId) {
        mlog.error('post.ts POST().scriptId or deployId is undefined. Cannot call RESTlet.');
        throw new Error('post.ts POST().scriptId or deployId is undefined. Cannot call RESTlet.');
    }
    if (!accessToken) {
        mlog.error('post.ts POST().accessToken is undefined. Cannot call RESTlet.');
        throw new Error('post.ts POST().accessToken is undefined. Cannot call RESTlet.');
    }
    if (!payload) {
        mlog.error('post.ts POST().payload is undefined. Cannot call RESTlet.');
        throw new Error('post.ts POST().payload is undefined. Cannot call RESTlet.');
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
        mlog.error('Error in post.ts POST():');//, error);
        write({timestamp: getCurrentPacificTime(), caught: error}, ERROR_DIR, 'ERROR_POST.json');
        throw new Error('Failed to call RESTlet with payload');
    }
}