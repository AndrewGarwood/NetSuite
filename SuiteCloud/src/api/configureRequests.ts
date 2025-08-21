/**
 * @file src/api/configureRequests.ts
 */
import { mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, 
} from "../config";
import { ScriptDictionary } from "../utils/ns";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";

const F = path.basename(__filename).replace(/\.[a-z]{1,}$/, '');


export const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
export const BATCH_SIZE = 50;
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
    const source = `[${F}.${partitionArrayBySize.name}()]`
    try {
        validate.numberArgument(source, {batchSize}, true);
        validate.arrayArgument(source, {arrayToPartition: arr});
    } catch (error: any) {
        mlog.error(
            `${source} Unable to partition input array, returning empty array`, 
            `caught: ${error}`
        );
        return [];
    }
    let batches = [];
    for (let i = 0; i < arr.length; i += batchSize) {
        batches.push(arr.slice(i, i + batchSize));
    }
    return batches;
}






