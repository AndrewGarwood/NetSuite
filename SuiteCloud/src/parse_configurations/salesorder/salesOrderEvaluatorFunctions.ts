/**
 * @file src/parse_configurations/salesorder/salesOrderEvaluatorFunctions.ts
 */
import { parseLogger as plog, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
} from "../../config";
import { 
    CleanStringOptions,
    clean, 
    isCleanStringOptions
} from "typeshi:utils/regex";
import { SalesOrderColumnEnum as SO, } from "./salesOrderConstants";
import { 
    isNonEmptyString 
} from "typeshi:utils/typeValidation";
import { RecordTypeEnum } from "../../utils/ns/Enums";
import { FieldDictionary, RecordOptions } from "@api/types";

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
    fields: FieldDictionary,
    row: Record<string, any>,
    recordType: RecordTypeEnum | string,
    typeColumn: string = SO.TRAN_TYPE,
    keyCleanOptions?: CleanStringOptions,
    ...idColumns: string[]
): string => {
    if (isNonEmptyString(fields.externalid)) {
        return fields.externalid;
    }
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
 * `otherrefnum`
 * from NetSuite documentation: `"If your customer is paying by check, enter the number here.
 * If your customer is issuing a purchase order, enter the PO number here."`
 * @param row `Record<string, any>`
 * @param checkNumberColumn `string`
 * @param poNumberColumn `string`
 * @returns **`otherReferenceNumber`** `string` - the check number or PO number.
 */
export const otherReferenceNumber = (
    fields: FieldDictionary,
    row: Record<string, any>,
    checkNumberColumn: string = SO.CHECK_NUMBER,
    poNumberColumn: string = SO.PO_NUMBER,
): string => {
    const checkNumber = clean(row[checkNumberColumn]);
    const poNumber = clean(row[poNumberColumn]);
    return (checkNumber 
        ? `Check #: ${checkNumber}` : poNumber 
        ? `${poNumber}` : ''
    );
}


export const memo = (
    fields: FieldDictionary,
    row: Record<string, any>,
    memoPrefix?: string,
    typeColumn: string = SO.TRAN_TYPE,
    ...idColumns: string[]
): string => {
    let result = isNonEmptyString(memoPrefix) ? memoPrefix : 'Summary';
    result = result.trim() + ': {'
    const summary: Record<string, any> = {
        'Type': clean(row[typeColumn])
    }
    for (const col of idColumns) {
        summary[col] = clean(row[col]) ?? '';
    }
    for (const [key, value] of Object.entries(summary)) {
        result += `${key}: ${value}, `;
    }
    result = result.replace(/, $/, '');
    result += '} '
    return result;
} 