/**
 * @file src/parse_configurations/salesorder/salesOrderEvaluatorFunctions.ts
 */
import { 
    CustomerStatusEnum,
    FieldValue,
    RecordTypeEnum,
} from "../../utils/api/types";
import { parseLogger as plog, mainLogger as mlog, DEBUG_LOGS, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config";
import { RADIO_FIELD_TRUE, RADIO_FIELD_FALSE, anyNull, isCleanStringOptions } from "../../utils/typeValidation";
import { 
    clean as clean, extractSku, CleanStringOptions,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
    equivalentAlphanumericStrings as equivalentAlphanumeric, 
} from "../../utils/io/regex/index";
import { SalesOrderColumnEnum as C } from "./salesOrderConstants";
import { EvaluationContext,  } from "../../utils/io";

/**
 * @example
 * const idDict = {
 *   'SO': '9999',
 *   'INVOICE': '0000'
 *   'PO': '1111',
 * };
 * result = 'SO:9999_INVOICE:0000_PO:1111';
 */
export const externalId = (
    row: Record<string, any>,
    cleanKeyOptions?: CleanStringOptions,
    ...idColumns: string[]
): string => {
    if (cleanKeyOptions && !isCleanStringOptions(cleanKeyOptions)) {
        mlog.error(`[externalId()] Invalid cleanKeyOptions:`);
        return '';
    }
    const idDict: { [key: string]: string } = {};
    for (const col of idColumns) {
        const cleanKey = clean(col, cleanKeyOptions);
        idDict[cleanKey] = clean(row[col]);
    }
    let result = Object.keys(idDict).map((key) => {
        return `${key}:${idDict[key]}`;
    }).join('_') + `<${RecordTypeEnum.SALES_ORDER}>`;
    return result;
}

/**
 * - {@link extractSku} `(row[itemColumn])`
 * @param row `Record<string, any>`
 * @param itemColumn `string`
 * @returns **`sku`** `string` of the item in the row, or an empty string if the item is null.
 */
export const itemSku = (
    row: Record<string, any>,
    itemColumn: string = C.ITEM
): string => {
    if (anyNull(row, itemColumn, row[itemColumn])) {
        return '';
    }
    return extractSku(clean(row[itemColumn]));
}