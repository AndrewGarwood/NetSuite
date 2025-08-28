/**
 * @file src/api/configureRequests.ts
 */
import { mainLogger as mlog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    STOP_RUNNING,
} from "../config";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { extractFileName } from "@typeshi/regex";
import { getSourceString } from "@typeshi/io";

const F = extractFileName(__filename);

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
    const source = getSourceString(F, partitionArrayBySize.name)
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






