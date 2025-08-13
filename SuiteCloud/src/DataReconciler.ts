/**
 * @file src/DataReconciler.ts
 */
import * as fs from "node:fs";
import { EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum, CustomerStatusEnum } from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull, anyNull, 
    isNonEmptyString, TypeOfEnum } from "./utils/typeValidation";
import { DelimitedFileTypeEnum, DelimiterCharacterEnum, 
    isValidCsvSync, isRecordOptions, indentedStringify 
} from "./utils/io";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, CLOUD_LOG_DIR } from "./config";
import { getColumnValues, getRows, writeObjectToJson as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument 
} from "./utils/io";
import * as validate from "./utils/argumentValidation";
import path from "node:path";
import { 
    RecordOptions, SetFieldSubrecordOptions, SetSublistSubrecordOptions, SublistLine,
    GetRecordRequest, GetRecordResponse, getRecordById 
} from "./api";


/**
 * @param validationDict 
 * @param csvFiles 
 * @param column 
 * @param extractor 
 * @param extractorArgs 
 * @returns **`missingValues`** `Promise<{ [filePath: string]: string[] }>`
 * - get references to all files that have a row where row[column] `not in validationDict`
 * > should probably change validationDict to validationSet or an array or somethin
 */
export async function validateFiles(
    validationDict: Record<string, string>,
    csvFiles: string[],
    column: string, 
    extractor: (columnValue: string, ...args: any[]) => string | Promise<string>,
    extractorArgs: any[] = []
): Promise<{ [filePath: string]: string[] }> {
    const source = `[DataReconciler.validateFiles()]`
    validate.arrayArgument(source, {csvFiles, isNonEmptyString});
    validate.stringArgument(source, {column});
    validate.functionArgument(source, {extractor});
    validate.objectArgument(source, {validationDict});
    const missingValues = {} as { [filePath: string]: string[] };
    for (const csvPath of csvFiles) {
        if (!isValidCsvSync(csvPath)) {
            mlog.warn(`csvFiles contained invalid csvPath`) 
            continue; 
        }
        missingValues[csvPath] = [];
        const columnValues = await getColumnValues(csvPath, column, false);
        for (const originalValue of columnValues) {
            const extractedValue = await extractor(originalValue, ...extractorArgs);
            if (!isNonEmptyString(extractedValue)) {
                plog.warn(`${source} extractor(value) returned null,`,
                    `undefined, or empty string, or is not a string`,
                    TAB+`originalValue: '${originalValue}'`, 
                    TAB+`     filePath: '${csvPath}'`
                );
                if (!missingValues[csvPath].includes(originalValue)) {
                    missingValues[csvPath].push(originalValue);
                }
                continue;
            } 
            if (!validationDict[extractedValue] 
                && !missingValues[csvPath].includes(extractedValue)) {
                missingValues[csvPath].push(extractedValue)
            }
        }
    }
    return missingValues;
}

/**
 * @param rowSource `string | Record<string, any>[]`
 * @param targetColumn `string`
 * @param targetValues `string[]`
 * @param extractor `function (columnValue: string, ...args: any[]) => string`
 * @param extractorArgs `any[]`
 * @returns **`targetRows`** `Promise<Record<string, any>[]>` 
 * - array of all rows where either `row[targetColumn]` or `extractor(row[targetColumn])` is in `targetValues`
 */
export async function extractTargetRows(
    /** 
     * - `string` -> filePath to a csv file
     * - `Record<string, any>[]` -> array of rows
     * */
    rowSource: string | Record<string, any>[],
    targetColumn: string, 
    targetValues: string[],
    extractor?: (columnValue: string, ...args: any[]) => string | Promise<string>, 
    extractorArgs?: any[]
): Promise<Record<string, any>[]> {
    const source = `[DataReconciler.extractTargetRows()]`
    if(!isNonEmptyString(rowSource) && !isNonEmptyArray(rowSource)) {
        throw new Error([`${source} Invalid param 'rowSource'`,
            `Expected rowSource: string | Record<string, any>[]`,
            `Received rowSource: '${typeof rowSource}'`
        ].join(TAB));
    }
    validate.stringArgument(source, {targetColumn});
    if (extractor !== undefined) validate.functionArgument(source, {extractor});
    validate.arrayArgument(source, {targetValues, isNonEmptyString});
    const rows = await handleFileArgument(
        rowSource, extractTargetRows.name, [targetColumn]
    );
    let valuesFound: string[] = [];
    const targetRows: Record<string, any>[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!hasKeys(row, targetColumn)) {
            mlog.warn(`${source} row does not have provided targetColumn`,
                TAB+`    targetColumn: '${targetColumn}'`,
                TAB+`Object.keys(row):  ${JSON.stringify(Object.keys(row))}`,
            );
            continue;
        }
        const originalValue = String(row[targetColumn]);
        if (targetValues.includes(originalValue)) {
            targetRows.push(row);
            if (!valuesFound.includes(originalValue)) valuesFound.push(originalValue);
            plog.debug(`${source} ORIGINAL VALUE IN TARGET VALUES`)
            continue;
        }
        if (!extractor) { continue }
        const extractedValue = await extractor(originalValue, extractorArgs);
        if (!isNonEmptyString(extractedValue)) {
            plog.warn(`${source} extractor(value) returned null,`,
                `undefined, or empty string, or is not a string`,
                TAB+` originalValue: '${originalValue}'`, 
                TAB+`rowSource type: '${typeof rowSource}'`
            );
            continue;
        }
        if (targetValues.includes(extractedValue)) {
            if (!valuesFound.includes(extractedValue)) valuesFound.push(extractedValue);
            targetRows.push(row);
            continue;
        }
    }
    let missingValues = targetValues.filter(v=> !valuesFound.includes(v));
    if (missingValues.length > 0) {
        mlog.warn([`${source} ${missingValues.length} value(s) from targetValues did not have a matching row`,
            indentedStringify(missingValues)
        ].join(TAB))
    }
    return targetRows;
}







/**
 * @goal make sure specified RecordReference field has
 * an existing record on NetSuite that we can use.
 * (e.g. when upserting a record with RecordOptions, 
 * a field where RecordOptions.fields[fieldId] = internalid of a record on NetSuite
 * ) 
 * e.g. for salesorder records, for all corresponding source tsv 
 * files in DATA_DIR/salesorders/all, make sure extractSku(tsvRow[itemColumn]) 
 * is an existing inventory item on NetSuite (so we can get its internalid and put it in the 
 * SublistLine)
 */

type ReconciliationOptions = {
    /**path to directory of files, or path to a single file */
    path: string;
}
enum ReconciliationSourceEnum {
    API = 'API',
    LOCAL = 'LOCAL',
}
type LocalSourceOptions = {

}
enum ReconciliationStatusEnum {

}
enum PathTypeEnum {
    FILE = 'FILE',
    DIRECTORY = 'DIRECTORY'
}

class DataReconciler {
    constructor() {

    }
}