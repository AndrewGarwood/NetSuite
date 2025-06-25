/**
 * @file src/utils/api/callApi.ts
 */
import axios from "axios";
import { writeObjectToJson as write, getCurrentPacificTime, indentedStringify } from "../io";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "src/config/setupLog";
import { RESTLET_URL_STEM, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY, OUTPUT_DIR, ERROR_DIR  } from "../../config/env";
import { createUrlWithParams } from "./url";
import { AxiosCallEnum, AxiosContentTypeEnum } from "src/server";
import { AuthManager, AuthState } from "../../server/AuthManager";
import { 
    RecordRequest, RecordResponse, RecordOptions, RecordResponseOptions,
    RecordResult, DeleteRecordByTypeRequest, 
} from "./types";
import { ScriptDictionary } from "../ns";

export const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
export const BATCH_SIZE = 100;
export const TWO_SECONDS = 2000;
/** use to set the field `"isinactive"` to false when loading or creating records*/
export const NOT_DYNAMIC = false;

export const auth = new AuthManager();

/**
 * when called, performs the following:
 * 1. `if` a request to this function is already in progress `and` queueing is enabled, `then` add new {@link auth.PendingRequest} to {@link pendingRequests} queue
 * and reject any requests in the queue that are older than 2 minutes (and remove them from {@link auth.pendingRequests})
 * 2. `if` the state is not {@link AuthState.IDLE}, wait for 1 second and call this function again
 * 3. `if` `currentToken` = return value from {@link auth.getCurrentValidToken} is not null,
 * `then` set {@link auth.lastTokenResponse} to `currentToken`, 
 * call {@link auth.resolvePendingRequests}`(currentToken.access_token)`, 
 * and return `currentToken.access_token`
 * 4. `else` `currentToken` is null (Need to acquire new token), so set {@link auth.state} to `REFRESHING`,
 * `then` set the new `tokenResponse` = {@link auth.performTokenRefresh}`()` 
 * `if` get a refreshError set `tokenResponse` = {@link auth.performFullAuthorization}`()`
 * 5. `set` {@link auth.state} to {@link AuthState.IDLE} and {@link auth.lastTokenResponse} to `tokenResponse`
 * @returns **`Promise<string>`** - The access token
 * */
export async function getAccessToken(): Promise<string> {
    return auth.getAccessToken();
}

/** 
 * Cleanup on process exit 
 * - "This pattern ensures that the application doesn't leave behind 
 * dangling resources like open HTTP servers listening on ports, active timers, 
 * or unresolved promises when the process is terminated." 
 * - "...prevents resource leaks and ensures the application can be cleanly 
 * restarted without port conflicts or other issues."
 * */
process.on('exit', () => auth.destroy());
/**
 * listens for `'SIGINT'` `(Signal Interrupt)`
 * - "typically sent when a user presses Ctrl+C in the terminal or when an 
 * application receives an interrupt signal" 
 * */
process.on('SIGINT', () => {
    auth.destroy();
    STOP_RUNNING(0, `[configureRequests.AuthManager] process listener received SIGINT`);
});
/**
 * listens for `'SIGTERM'` `(Signal Terminate)` 
 * - "commonly used by process managers, container orchestrators like Docker, 
 * or system administrators to request a graceful shutdown of the application"
 * */
process.on('SIGTERM', () => {
    auth.destroy();
    STOP_RUNNING(0, `[configureRequests.AuthManager] process listener received SIGTERM`);
});

/**
 * @param arr `Array<any>`
 * @param batchSize `number`
 * @returns **`batches`** — `Array<Array<any>>`
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






