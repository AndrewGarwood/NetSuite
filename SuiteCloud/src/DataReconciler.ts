/**
 * @file src/DataReconciler.ts
 */
import * as fs from 'fs';
import { RecordTypeEnum } from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull, anyNull, isNonEmptyString, TypeOfEnum } from './utils/typeValidation';
import { extractSku, DelimitedFileTypeEnum, DelimiterCharacterEnum, isValidCsv } from "./utils/io";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING } from "./config";
import { getColumnValues, getRows, writeObjectToJson as write, 
    getIndexedColumnValues, handleFilePathOrRowsArgument 
} from "./utils/io";
import * as validate from "./utils/argumentValidation";
import path from "node:path";
/**
 * @goal for each source csv file, make sure specified RecordReference field has
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

export async function validateFiles(
    csvFiles: string[],
    column: string, 
    extractor: (columnValue: string) => string, 
    validationDict: Record<string, string>
): Promise<{ [filePath: string]: string[] }> {
    validate.arrayArgument(`validateFiles`, `csvFiles`, csvFiles, TypeOfEnum.STRING);
    validate.stringArgument(`validateFiles`, `column`, column);
    validate.functionArgument(`validateFiles`, `extractor`, extractor);
    validate.objectArgument(`validateFiles`, `validationDict`, validationDict);
    const missingValues = {} as { [filePath: string]: string[] };
    for (const csvPath of csvFiles) {
        if (!isValidCsv(csvPath)) {
            mlog.warn(`csvFiles contained invalid csvPath`) 
            continue; 
        }
        missingValues[csvPath] = [];
        const columnValues = await getColumnValues(csvPath, column, false);
        for (const originalValue of columnValues) {
            const extractedValue = extractor(originalValue);
            if (!isNonEmptyString(extractedValue)) {
                plog.warn(`[validateFiles()] extractor(value) returned null,`,
                    `undefined, or empty string, or is not a string`,
                    TAB+`originalValue: '${originalValue}'`, 
                    TAB+`     filePath: '${csvPath}'`
                );
                if (!missingValues[csvPath].includes(extractedValue)) {
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
 * @param extractor `function (columnValue: string) => string`
 * @param targetValues `string[]`
 * @returns **`targetRows`** `Promise<Record<string, any>[]>` 
 * - array of all rows where `extractor(row[targetColumn])` is in `targetValues`
 */
export async function extractTargetRows(
    /** 
     * - `string` -> filePath to a csv file
     * - `Record<string, any>[]` -> array of rows
     * */
    rowSource: string | Record<string, any>[],
    targetColumn: string, 
    extractor: (columnValue: string) => string, 
    targetValues: string[],
): Promise<Record<string, any>[]> {
    if(!isNonEmptyString(rowSource) && !isNonEmptyArray(rowSource)) {
        throw new Error([`[DataReconciler.extractTargetRows()] Invalid param 'rowSource'`,
            `Expected rowSource: string | Record<string, any>[]`,
            `Received rowSource: '${typeof rowSource}'`
        ].join(TAB));
    }
    validate.stringArgument(`DataReconciler.extractTargetRows`, `targetColumn`, targetColumn);
    validate.functionArgument(`DataReconciler.extractTargetRows`, `extractor`, extractor);
    validate.arrayArgument(`DataReconciler.extractTargetRows`, `targetValues`, targetValues, TypeOfEnum.STRING);
    const rows = await handleFilePathOrRowsArgument(
        rowSource, extractTargetRows.name, [targetColumn]
    );
    const targetRows: Record<string, any>[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!hasKeys(row, targetColumn)) {
            mlog.warn(`[DataReconciler.extractTargetRows()] row does not have provided targetColumn`,
                TAB+`    targetColumn: '${targetColumn}'`,
                TAB+`Object.keys(row):  ${JSON.stringify(Object.keys(row))}`,
            );
            continue;
        }
        const originalValue = String(row[targetColumn]);
        const extractedValue = extractor(originalValue);
        if (!isNonEmptyString(extractedValue)) {
            plog.warn(`[DataReconciler.extractTargetRows()] extractor(value) returned null,`,
                `undefined, or empty string, or is not a string`,
                TAB+` originalValue: '${originalValue}'`, 
                TAB+`rowSource type: '${typeof rowSource}'`
            );
            continue;
        }
        if (targetValues.includes(extractedValue)) {
            targetRows.push(row);
        }
    }
    return targetRows;
}
