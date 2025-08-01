/**
 * @file src/parse_configurations/salesorder/salesOrderEvaluatorFunctions.ts
 */
import { parseLogger as plog, 
    mainLogger as mlog, DEBUG_LOGS, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
} from "../../config";
import { 
    CleanStringOptions,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
    clean, 
    equivalentAlphanumericStrings as equivalentAlphanumeric,
    extractLeaf, 
} from "../../utils/regex";
import { SalesOrderColumnEnum as SO, } from "./salesOrderConstants";
import { isNullLike as isNull, anyNull, hasKeys, hasNonTrivialKeys, isNonEmptyString } from "src/utils/typeValidation";
import { getSkuDictionary, hasSkuInDictionary } from "src/config/dataLoader";
import { RecordTypeEnum } from "src/utils/ns/Enums";
import { isCleanStringOptions } from "src/utils/typeGuards";

/**
 * @example
 * const idDict = {
 *   'SO': '9999',
 *   'Num': '0000'
 *   'PO': '1111',
 * };
 * result = 'SO:9999_NUM:0000_PO:1111(TRAN_TYPE)<salesorder>';
 */
export const transactionExternalId = (
    row: Record<string, any>,
    recordType: RecordTypeEnum | string,
    typeColumn: string = SO.TRAN_TYPE,
    keyCleanOptions?: CleanStringOptions,
    ...idColumns: string[]
): string => {
    if (keyCleanOptions && !isCleanStringOptions(keyCleanOptions)) {
        mlog.error(`[externalId()] Invalid cleanKeyOptions:`);
        return '';
    }
    const idDict: { [key: string]: string } = {};
    for (const col of idColumns) {
        const cleanKey = clean(col, keyCleanOptions);
        if (!cleanKey) { continue; }
        idDict[cleanKey] = clean(row[col]);
    }
    let tranType = clean(row[typeColumn], { 
        replace: [{searchValue: ' ', replaceValue: '_'}], 
        case: { toUpper: true } 
    });
    let result = Object.keys(idDict).map((key) => {
        return `${key}:${idDict[key] ? idDict[key] : 'UNDEFINED'}`;
    }).join('_') + `(${tranType})<${recordType}>`;
    return result;
}

/**
 * from NetSuite documentation: "If your customer is paying by check, enter the number here.
 * If your customer is issuing a purchase order, enter the PO number here."
 * @param row `Record<string, any>`
 * @param checkNumberColumn `string`
 * @param poNumberColumn `string`
 * @returns **`otherReferenceNumber`** `string` - the check number or PO number.
 */
export const otherReferenceNumber = (
    row: Record<string, any>,
    checkNumberColumn: string = SO.CHECK_NUMBER,
    poNumberColumn: string = SO.PO_NUMBER,
): string => {
    const checkNumber = clean(row[checkNumberColumn]);
    const poNumber = clean(row[poNumberColumn]);
    return (checkNumber 
        ? `Check #: ${checkNumber}` : poNumber 
        ? `${poNumber}` : '');
}


export const memo = (
    row: Record<string, any>,
    memoPrefix?: string,
    typeColumn: string = SO.TRAN_TYPE,
    ...idColumns: string[]
): string => {
    let result = isNonEmptyString(memoPrefix) ? memoPrefix : 'Summary';
    result = result.trim() + ': {\n'
    const summary: Record<string, any> = {
        'Type': clean(row[typeColumn]) || 'UNDEFINED',
    }
    for (const col of idColumns) {
        summary[col] = clean(row[col]) || 'UNDEFINED';
    }
    for (const [key, value] of Object.entries(summary)) {
        result += `${key}: ${value}\n`;
    }
    result += '}\n'
    return result;
} 



/**
 * @deprecated
 * @TODO **handle hasSkuExists logic in post processing instead of here.**
 * 
 * Gets the internal ID for an item SKU (asynchronous version).
 * Automatically loads the SKU dictionary if not already loaded.
 * 
 * @param row `Record<string, any>`
 * @param itemColumn `string`
 * @returns Promise that resolves to the **`internalId`** `string` of the item in the row, or an empty string if the item is null.
 */
const itemSkuAsync = async (
    row: Record<string, any>,
    itemColumn: string = SO.ITEM
): Promise<string> => {
    if (anyNull(row, itemColumn, row[itemColumn])) {
        return '';
    }
    const sku = extractLeaf(clean(row[itemColumn]));
    if (!sku) {
        throw new Error(`[itemSkuAsync()] Could not extract SKU from: '${row[itemColumn]}'`);
    }
    const hasSkuExists = await hasSkuInDictionary(sku);
    if (!hasSkuExists) {
        throw new Error(`[itemSkuAsync()] Unrecognized item sku: '${sku}' (from '${row[itemColumn]}')`);
    }
    const skuDict = await getSkuDictionary();
    return skuDict[sku];
}