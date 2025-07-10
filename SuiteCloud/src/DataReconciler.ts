/**
 * @file src/DataReconciler.ts
 */
import * as fs from 'fs';
import { getSkuDictionary } from './parse_configurations/salesorder/salesOrderConstants';
import { RecordTypeEnum } from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull, anyNull, isNonEmptyString as isString } from './utils/typeValidation';
import { extractSku, DelimitedFileTypeEnum, DelimiterCharacterEnum, isValidCsv } from "./utils/io";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING } from "./config";
import { getColumnValues, getRows, writeObjectToJson as write, getDelimiterFromFilePath } from "./utils/io";
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
            if (!isString(extractedValue)) {
                plog.warn(`[validateFiles()] extractor(value) returned null, `,
                    `undefined, or empty string`,
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

