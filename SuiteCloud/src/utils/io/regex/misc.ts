/**
 * @file src/utils/io/regex/misc.ts
 */
import { isNonEmptyArray } from "../../typeValidation";
import { mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../../config";

/**
 * `re` = `/^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*$/`
 * 1. matches `YYYY-MM-DD` (ISO) format.
 * 2. matches `MM/DD/YYYY` format. assumes `MM/DD/YYYY` format if the first part is less than or equal to 12 I think.
 */
export const DATE_STRING_PATTERN = new RegExp(
    /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*$/
);

/** e.g. `"Pangyo-ro, Bundag-Gu, Seongnam-si"` */
export const KOREA_ADDRESS_LATIN_TEXT_PATTERN = new RegExp(
    /^\s*([a-zA-Z]{2,}-[a-zA-Z]{2,},\s*){1,}[a-zA-Z]{2,}-[a-zA-Z]{2,}\s*$/
);

/**
 * - checks if matches `skuPattern = /(?<=^.*:)([^: ])*(?= .*$)/`
 * - checks if included in `skuExceptions = ['DISCOUNT (Discount)', 'S&H (Shipping)']`
 * @param skuValue `string` - the initial column value to extract SKU from
 * @returns **`sku`**: `string` - the extracted SKU or empty string
 */
export function extractSku(skuValue: string): string {
    const skuExceptions = ['DISCOUNT (Discount)', 'S&H (Shipping)'];
    const skuPattern = new RegExp(/(?<=^.*:)([^: ])*(?= ?.*$)/);
    if (skuExceptions.includes(skuValue)) {
        return skuValue.split(' ')[0]; // return the skuValue as is if it is an exception
    }
    let result = '';
    if (skuValue.includes(' (')) {
        result = skuValue.split(' (')[0];
        // const match = skuValue.match(skuPattern);
        // if (isNonEmptyArray(match)) {
        //     return match[0].trim();
        // } 
    }
    if (result.includes(':')) { 
        let classifierSplit = result.split(':');
        return classifierSplit[classifierSplit.length-1]
    } // else it's an item class and not an actual item sku ?
    // mlog.warn(
    //     `[extractSku()] Unable to extract sku from value: '${skuValue}'`, `current result: '${result}'`
    // );
    return result;

}
