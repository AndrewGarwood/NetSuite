/**
 * @file src/DataReconciler.ts
 */
import * as fs from 'fs';
import { EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum, CustomerStatusEnum } from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull, anyNull, isNonEmptyString, TypeOfEnum, isRecordOptions } from './utils/typeValidation';
import { extractLeaf, DelimitedFileTypeEnum, DelimiterCharacterEnum, isValidCsv } from "./utils/io";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, CLOUD_LOG_DIR } from "./config";
import { getColumnValues, getRows, writeObjectToJson as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFilePathOrRowsArgument 
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
        if (targetValues.includes(originalValue)) {
            targetRows.push(row);
            plog.debug(`[DataReconciler.extractTargetRows()] ORIGINAL VALUE IN TARGET VALUES`)
            continue;
        }
        if (!extractor) { continue }
        const extractedValue = extractor(originalValue, extractorArgs);
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
            continue;
        }
    }
    return targetRows;
}


const SO_ERROR_HISTORY_DIR = path.join(CLOUD_LOG_DIR, 'salesorders');

export async function resolveUnmatchedTransactions(
    dir: string = SO_ERROR_HISTORY_DIR,
    entityType: EntityRecordTypeEnum = EntityRecordTypeEnum.CUSTOMER
): Promise<any> {
    validate.stringArgument(`rejectHandler.resolveUnmatchedTransactions`, {dir})
    const errorFiles = (fs.readdirSync(dir)
        .filter(file => file.toLowerCase().endsWith('_matchErrors.json'))
        .map(file => path.join(dir, file))
    );
    if (!isNonEmptyArray(errorFiles)) {
        throw new Error([`[reject  Handler.resolveUnmatchedTransactions()]`,
            `Found 0 files with the name pattern '*_matchErrors.json'`,
            `directory received: '${dir}'`
        ].join(TAB))
    }
    mlog.debug([`[resolveUnmatchedTransactions()]`,
        `Found ${errorFiles.length} matchError file(s)`
    ].join(TAB));
    const resolved: RecordOptions[] = [];
    const unresolved: RecordOptions[] = [];
    for (let i = 0; i < errorFiles.length; i++) {
        const filePath = errorFiles[i];
        const jsonData = read(filePath);
        if (isNull(jsonData) || !hasKeys(jsonData, 'errors')) {
            mlog.warn([`[resolveUnmatchedTransactions()] Invalid json data`,
                `errorFiles index: ${i+1}`, `filePath: '${filePath}'`,
                `typeof jsonData: ${typeof jsonData}`,
                `Expected Key: 'errors: RecordOptions[]'`,
            ].join(TAB));
            continue;
        }
        const transactions = jsonData.errors as RecordOptions[]
        try {
            validate.arrayArgument(
                `rejectHandler.resolveUnmatchedTransactions.for`, {transactions}, 
                'RecordOptions', isRecordOptions
            );
        } catch (error) {
            mlog.warn([`Invalid RecordOptions array, continuing to next file...`,
                `errorFiles index: ${i+1}`, `filePath: '${filePath}'`,
                JSON.stringify(error as any, null, 4)
            ].join(TAB))
            continue;
        }
        const missingEntities: string[] = [];
        for (const txn of transactions) {
            if (!txn.fields || !isNonEmptyString(txn.fields.entity)) { continue }
            missingEntities.push(txn.fields.entity as string);
        }
        for (let j = 0; j < transactions.length; j++) {
        }
    }
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