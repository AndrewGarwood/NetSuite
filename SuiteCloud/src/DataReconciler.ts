/**
 * @file src/DataReconciler.ts
 */
import * as fs from "node:fs";
import { EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum, CustomerStatusEnum } from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull,
    isNonEmptyString, TypeOfEnum } from "./utils/typeValidation";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, CLOUD_LOG_DIR 
} from "./config";
import { getColumnValues, getRows, writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument, 
    isValidCsvSync
} from "typeshi/dist/utils/io";
import * as validate from "./utils/argumentValidation";
import path from "node:path";
import { 
    RecordOptions, SetFieldSubrecordOptions, SetSublistSubrecordOptions, SublistLine,
    GetRecordRequest, getRecordById 
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
                plog.warn([`${source} extractor(value) returned invalid string`,
                    `originalValue: '${originalValue}'`, 
                    `     filePath: '${csvPath}'`
                ].join(TAB));
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
): Promise<{
    rows: Record<string, any>[];
    remainingValues: string[]
}> {
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
    const sourceRows = await handleFileArgument(
        rowSource, extractTargetRows.name, [targetColumn]
    );
    const remainingValues: string[] = []
    let potentials: Record<string, number[]> = {}
    let valuesFound: string[] = [];
    const targetRows: Record<string, any>[] = [];
    for (let i = 0; i < sourceRows.length; i++) {
        const row = sourceRows[i];
        if (!hasKeys(row, targetColumn)) {
            mlog.warn([`${source} row does not have provided targetColumn`,
                `    targetColumn: '${targetColumn}'`,
                `Object.keys(row):  ${JSON.stringify(Object.keys(row))}`,
            ].join(TAB));
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
            plog.warn([`${source} extractor(value) returned invalid string`,
                ` originalValue: '${originalValue}'`, 
                `rowSource type: '${typeof rowSource}'`
            ].join(TAB));
            continue;
        }
        if (targetValues.includes(extractedValue)) {
            targetRows.push(row);
            if (!valuesFound.includes(extractedValue)) valuesFound.push(extractedValue);
            continue;
        }
        let targetMatch = targetValues.find(v=>{
            v = v.toUpperCase();
            return v.startsWith(extractedValue.toUpperCase())
        });
        if (targetMatch) {
            if (!potentials[targetMatch]) {
                potentials[targetMatch] = [i]
            } else {
                potentials[targetMatch].push(i)
            }
            // slog.debug([`${source} Found potentialMatch for a targetValue at rowIndex ${i}`,
            //     ` originalValue: '${originalValue}'`, 
            //     `extractedValue: '${extractedValue}'`, 
            //     `potentialMatch: '${targetMatch}'`, 
            // ].join(TAB));
        }
    }
    remainingValues.push(...targetValues.filter(v=> !valuesFound.includes(v)));
    // if (remainingValues.length > 0) {
    //     mlog.warn([`${source} ${remainingValues.length} value(s) from targetValues did not have a matching row`,
    //         // indentedStringify(remainingValues)
    //     ].join(TAB));
    //     write({remainingValues}, path.join(CLOUD_LOG_DIR, `${getFileNameTimestamp()}_remainingValues.json`))
    // }
    return {rows: targetRows, remainingValues};
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