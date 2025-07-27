/**
 * @file src/utils/io/regex/misc.ts
 */
import { isNonEmptyArray } from "../typeValidation";
import { mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL 
} from "../../config";
/**
 * = `= /^[^/\\:*?"<>|]+(\.[^/\\:*?"<>|]+)$/`
 */
export const FILE_NAME_WITH_EXTENSION_PATTERN = /^[^/\\:*?"<>|]+(\.[^/\\:*?"<>|]+)$/; 
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
 * @param value `string` - the string value from which to extract `leaf`
 * @param removeClasses `boolean` - remove string prefixes from result `leaf`
 * - `Default` = `true` 
 * - e.g. `'CLASSA:SKU-1'` -> `sku` with classes removed = `'SKU-1'`
 * @param classDelimiter `string` - the character used to delimit the item's classes
 * - `Default` = `':'` (colon character) 
 * - e.g. `classDelimiter` of `'CLASSA:SKU-1'` = `':'`
 * @returns **`leaf`**: `string` - the extracted `leaf` or the original value if no extraction performed
 */
export function extractLeaf(
    value: string, 
    removeClasses: boolean = true, 
    classDelimiter: string = ':',
): string {
    // const skuExceptions: Record<string, string> = {
    //     'DISCOUNT (Discount)': 'DISCOUNT', 
    //     'S&H (Shipping)': 'S&H',
    //     'SHOW DISCOUNT': 'SHOW DISCOUNT'
    // };
    // const skuPattern = new RegExp(/(?<=^.*:)([^: ])*(?= ?.*$)/);
    // if (Object.keys(skuExceptions).includes(value)) {
    //     return skuExceptions[value];
    // }
    let result = '';
    if (value.includes(' (')) {
        result = value.split(' (')[0];
        // const match = skuValue.match(skuPattern);
        // if (isNonEmptyArray(match)) {
        //     return match[0].trim();
        // } 
    }
    if (removeClasses && result.includes(classDelimiter)) { 
        let classifierSplit = result.split(classDelimiter);
        return classifierSplit[classifierSplit.length-1]
    } // else it's an item class and not an actual item sku ?
    // mlog.warn(
    //     `[extractSku()] Unable to extract sku from value: '${skuValue}'`, `current result: '${result}'`
    // );
    return result || value;

}
