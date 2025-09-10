/**
 * @file src/services/maintenance/RecordManager.ts
 */
import { 
    mainLogger as mlog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL,
} from "../../config";
import { Factory } from "@api/factory";
import { getRecordById, getRelatedRecord } from "@api/requests";
import { ChildSearchOptions, FieldValue, idPropertyEnum, isRecordOptions, RecordOptions, RecordResult, SublistLine, SubrecordValue } from "@api/types";
import { getSourceString, indentedStringify } from "@typeshi/io";
import { clean, StringReplaceOptions } from "@typeshi/regex";
import { RecordTypeEnum } from "@utils/ns/Enums";
import { ReconcilerError } from "src/services/maintenance/types/Reconcile";
import * as validate from "@typeshi/argumentValidation";
import { hasKeys, isEmpty, isInteger, isNonEmptyString } from "@typeshi/typeValidation";



export async function hasDependentRecords(
    itemId: string,
    parentRecordType: RecordTypeEnum,
    childOptions: ChildSearchOptions[]
): Promise<boolean | ReconcilerError> {
    const source = getSourceString(__filename, hasDependentRecords.name, itemId);
    let result: RecordResult | null = null;
    try {
        let getRes = await getRecordById(
            Factory.SingleRecordRequest(parentRecordType, idPropertyEnum.ITEM_ID, itemId)
        );
        result = getRes.results[0]; 
    } catch (error: any) {
        return ReconcilerError(source, 
            `${source} error occurred when calling ${getRecordById.name}`,
            error
        );
    }
    if (!result) {
        return ReconcilerError(source, 
            `get request failed, unable to check for dependents`,
            `no results from getRecordById(itemId: '${itemId}')`
        );
    }
    const itemInternalId = result.internalid;
    try {
        let getRes = await getRelatedRecord(Factory.RelatedRecordRequest(
            parentRecordType, idPropertyEnum.INTERNAL_ID, itemInternalId, childOptions
        ));
        let results = getRes.results ?? [];
        return results.length > 0;
    } catch (error: any) {
        return ReconcilerError(source, 
            `${source} error occurred when calling ${getRelatedRecord.name}`,
            error
        );
    }
}

/**
 * @param records `Required<`{@link RecordOptions}`>[]`
 * @param idField `string` (a key of `RecordOptions.fields`)
 * @returns **`dictionary`** `{ [id: string]: Required<RecordOptions> }`
 * - returns empty object `if` there exists record in records such that `record.fields[idField]` is undefined/invalid
 */
export function generateRecordDictionary(
    records: Required<RecordOptions>[],
    idField: string | idPropertyEnum,
): { [id: string | number]: Required<RecordOptions> } {
    const source = getSourceString(__filename, generateRecordDictionary.name);
    try {
        validate.arrayArgument(source, {records, isRecordOptions});
        validate.stringArgument(source, {idField});
    } catch (error: any) {
        mlog.error([`${source} Invalid Arguments:`, indentedStringify(error),
            `Returning empty object...`
        ].join(NL));
        return {};
    }
    const dict: { [itemId: string]: Required<RecordOptions> } = {};
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        let idValue = record.fields[idField] ?? '';
        if (!hasKeys(record.fields, idField) || (!isNonEmptyString(idValue) && !isInteger(idValue))) {
            mlog.error([`${source} Unable to get idValue from record.fields`,
                `at records[${i}]`,
                `idField: '${idField}'`
            ].join(TAB));
            return {};
        }
        dict[idValue] = record;
    }
    return dict;
}


const tranTypePattern = new RegExp(/(?<=\()[\sA-Z]+(?=\)<[a-z]+>$)/i);
/**
 * handle this later...
 * @param memo 
 * @param stringReplaceOptions 
 * @returns 
 */
function fixTransactionMemo(
    memo: FieldValue | SubrecordValue,
    stringReplaceOptions: StringReplaceOptions = [
        {
            searchValue: /(?<= )([A-Z]{2,})+ Type '[\sA-Z]+', /i, replaceValue: ''
        },
        {
            searchValue: /QuickBooks Transaction Type.*(?=Expected)/i, replaceValue: ''
        },
    ]
): string {
    if (isEmpty(memo)) return ''
    memo = clean(String(memo), { replace: stringReplaceOptions });
    return memo;
}

export function getLinesWithSublistFieldValue(
    lines: SublistLine[],
    fieldId: string,
    ...targetValues: string[]
): SublistLine[] {
    const targetLines: SublistLine[] = [];
    for (let line of lines) {
        if (targetValues.includes(String(line[fieldId]))) {
            targetLines.push(line)
        }
    }
    return targetLines;
}
