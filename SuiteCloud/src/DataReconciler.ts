/**
 * @file src/DataReconciler.ts
 */
import * as fs from 'fs';
import { EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum, CustomerStatusEnum } from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull, anyNull, 
    isNonEmptyString, TypeOfEnum } from './utils/typeValidation';
import { DelimitedFileTypeEnum, DelimiterCharacterEnum, isValidCsv, isRecordOptions } from "./utils/io";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, CLOUD_LOG_DIR } from "./config";
import { getColumnValues, getRows, writeObjectToJson as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument 
} from "./utils/io";
import * as validate from "./utils/argumentValidation";
import path from "node:path";
import { RecordOptions, SetFieldSubrecordOptions, SetSublistSubrecordOptions, SublistLine } from './api';


export async function validateFiles(
    csvFiles: string[],
    column: string, 
    extractor: (columnValue: string) => string, 
    validationDict: Record<string, string>
): Promise<{ [filePath: string]: string[] }> {
    validate.arrayArgument(`${__filename}.validateFiles`, {csvFiles}, TypeOfEnum.STRING);
    validate.stringArgument(`${__filename}.validateFiles`, {column});
    validate.functionArgument(`${__filename}.validateFiles`, {extractor});
    validate.objectArgument(`${__filename}.validateFiles`, {validationDict});
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
                plog.warn(`[${__filename}.validateFiles()] extractor(value) returned null,`,
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
    extractor?: (columnValue: string, ...args: any[]) => string, 
    extractorArgs?: any[]
): Promise<Record<string, any>[]> {
    if(!isNonEmptyString(rowSource) && !isNonEmptyArray(rowSource)) {
        throw new Error([`[${__filename}.extractTargetRows()] Invalid param 'rowSource'`,
            `Expected rowSource: string | Record<string, any>[]`,
            `Received rowSource: '${typeof rowSource}'`
        ].join(TAB));
    }
    validate.stringArgument(`${__filename}.extractTargetRows`, `targetColumn`, targetColumn);
    validate.functionArgument(`${__filename}.extractTargetRows`, `extractor`, extractor);
    validate.arrayArgument(`${__filename}.extractTargetRows`, `targetValues`, targetValues, TypeOfEnum.STRING);
    const rows = await handleFileArgument(
        rowSource, extractTargetRows.name, [targetColumn]
    );
    const targetRows: Record<string, any>[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!hasKeys(row, targetColumn)) {
            mlog.warn(`[${__filename}.extractTargetRows()] row does not have provided targetColumn`,
                TAB+`    targetColumn: '${targetColumn}'`,
                TAB+`Object.keys(row):  ${JSON.stringify(Object.keys(row))}`,
            );
            continue;
        }
        const originalValue = String(row[targetColumn]);
        if (targetValues.includes(originalValue)) {
            targetRows.push(row);
            plog.debug(`[${__filename}.extractTargetRows()] ORIGINAL VALUE IN TARGET VALUES`)
            continue;
        }
        if (!extractor) { continue }
        const extractedValue = extractor(originalValue, extractorArgs);
        if (!isNonEmptyString(extractedValue)) {
            plog.warn(`[${__filename}.extractTargetRows()] extractor(value) returned null,`,
                `undefined, or empty string, or is not a string`,
                TAB+` originalValue: '${originalValue}'`, 
                TAB+`rowSource type: '${typeof rowSource}'`
            );
            continue;
        }
        if (targetValues.includes(extractedValue)) {
            targetRows.push(row);
            continue;
        }
    }
    return targetRows;
}


export async function generateEntityFromTransaction(
    transaction: RecordOptions,
    entityType: EntityRecordTypeEnum
): Promise<RecordOptions> {
    validate.objectArgument('transactionProcessor.generateEntityFromTransaction', 
        {transaction}, 'RecordOptions', isRecordOptions
    );
    validate.stringArgument('transactionProcessor.generateEntityFromTransaction', 
        {entityType}
    );
    if (isNull(transaction.fields) || !isNonEmptyString(transaction.fields.entity)) {
        throw new Error(`[generateEntityFromTransaction()] RecordOptions.fields is empty, null, or undefined`)
    }
    const entity: RecordOptions = {
        recordType: entityType,
    }
    const addressSublist: SublistLine[] = [];
    for (const addressFieldId of ['billingaddress', 'shippingaddress']) {
        if (!transaction.fields[addressFieldId]) continue
        const bodyAddr = transaction.fields[addressFieldId] as SetFieldSubrecordOptions;
        const sublistAddr = {
            subrecordType: bodyAddr.subrecordType,
            sublistId: 'addressbook',
            fieldId: 'addressbookaddress',
            fields: bodyAddr.fields
        } as SetSublistSubrecordOptions
        addressSublist.push({ address: sublistAddr })
    }
    Object.assign(entity, {
        fields: {
            entityid: transaction.fields.entity,
            externalid: `${transaction.fields.entity}<${entityType}>`,
            entitystatus: CustomerStatusEnum.CLOSED_WON,
            taxable: true,
            taxitem: CustomerTaxItemEnum.YOUR_TAX_ITEM
        },
        
    })

    return {} as RecordOptions;
}









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