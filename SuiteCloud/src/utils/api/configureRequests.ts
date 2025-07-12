/**
 * @file src/utils/api/callApi.ts
 */
import { mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, 
} from "../../config";
import { ScriptDictionary } from "../ns";

export const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
export const BATCH_SIZE = 50;
export const TWO_SECONDS = 2000;
/** use to set the field `"isinactive"` to false when loading or creating records*/
export const NOT_DYNAMIC = false;

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






