/**
 * @file src/main.ts
 */
import * as fs from "fs";
import path from "node:path";
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    writeRowsToCsv,
    ProcessParseResultsOptions, ParseOptions, ParseResults,
    RowDictionary, extractSku,
    trimFile, clearFile,
} from "./utils/io";
import { 
    STOP_RUNNING, CLOUD_LOG_DIR, DATA_DIR,
    SCRIPT_ENVIRONMENT as SE, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH,
    ERROR_LOG_FILEPATH,
    ERROR_DIR
} from "./config";
import { instantiateAuthManager } from "./utils/api";
import { 
    EntityRecordTypeEnum, 
    RecordTypeEnum, 
} from "./utils/api";
import { SALES_ORDER_PARSE_OPTIONS as SO_PARSE_OPTIONS, 
    SALES_ORDER_POST_PROCESSING_OPTIONS as SALES_ORDER_POST_PROCESSING_OPTIONS 
} from "./parse_configurations/salesorder/salesOrderParseDefinition";
import * as customerConstants from "./parse_configurations/customer/customerConstants";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants";
import { 
    processEntityFiles, EntityProcessorOptions, EntityProcessorStageEnum
} from "./entityProcessor";
import { processTransactionFiles, 
    TransactionProcessorOptions, 
    TransactionProcessorStageEnum, TransactionEntityMatchOptions, MatchSourceEnum,
} from "./transactionProcessor";
import { validateFiles, extractTargetRows } from "./DataReconciler";
import { isEmptyArray } from "./utils/typeValidation";
import * as validate from './utils/argumentValidation'
import { getSkuDictionary, initializeData } from "./config/dataLoader";

async function main() {
    clearFile(DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH);

    // Initialize application data first
    await initializeData();
    // await instantiateAuthManager();
    let validationDict: Record<string, string> = {};
    try {
        validationDict = await getSkuDictionary();
    } catch (error) {
        mlog.error('Failed to load SKU dictionary:', error);
        STOP_RUNNING(1);
    }
    const ITEM_COLUMN = 'Item';
    const ALL_SALES_ORDERS_DIR = path.join(soConstants.SALES_ORDER_DIR, 'all');
    const sourcePath = ALL_SALES_ORDERS_DIR;
    const csvFiles = (fs.readdirSync(sourcePath)
        .filter(file => file.toLowerCase().endsWith('.csv') 
            || file.toLowerCase().endsWith('.tsv'))
        .map(file => path.join(sourcePath, file))
    );
    const missingItemsPath = path.join(DATA_DIR, 'items', 'missingItems.json');
    
    // const missingItems = await validateFiles(csvFiles, 'Item', extractSku, validationDict);
    // const missingItemArray = Array.from(new Set(Object.values(missingItems).flat()));
    
    // mlog.info(`Found ${missingItemArray.length} missing items across ${csvFiles.length} files.`,
    //     TAB + `sourcePath: '${sourcePath}'`,
    // );
    // write({missingItemsArray: missingItemArray.sort()}, missingItemsPath);
    const missingItemArray = read(missingItemsPath).missingItemsArray || [];
    if (isEmptyArray(missingItemArray)) {
        STOP_RUNNING(1, 'array is emptyyyy')
    }
    const missingSkuRowDict: { 
        [sku: string]: {
            filePath: string;
            row: Record<string, any>;
        } 
    } = {};
    // get first occurrence of 
    for (const file of csvFiles) {
        const targetRows = await extractTargetRows(file, ITEM_COLUMN, extractSku, missingItemArray);
        if (isEmptyArray(targetRows)) { continue; }
        for (const row of targetRows) {
            let sku = extractSku(String(row[ITEM_COLUMN]));
            if (!missingSkuRowDict[sku]) {
                missingSkuRowDict[sku] = {
                    filePath: file,
                    row: row
                }
            }
        }
    }
    mlog.debug(`key length: ${Object.keys(missingSkuRowDict).length}`)
    const outputPath = path.join(DATA_DIR, 'items', 'missingSkuRowDict.json');
    write({dict: missingSkuRowDict}, outputPath);
    /**  
     * missingItems[i] = f'{sku} ({description})' | f'{sku}' 
     * */
    // const missingItems = (read(missingItemsPath).missingItemsArray || []) as string[];
    // if (isEmptyArray(missingItems)) {STOP_RUNNING(1, `missingItems was empty`)}
    // const targetItems = missingItems.map(s => s.includes(' (') ? s.split(' (')[0] : s);
    // const tsvFilePath = path.join(DATA_DIR, 'items', '2025_07_09_ALL_ITEMS.tsv');
    // const targetRows = await extractTargetRows(tsvFilePath, 'Item', extractSku, targetItems);
    // if (isEmptyArray(targetRows)) {
    //     mlog.error(`No target rows found in ${tsvFilePath} for targetItems: ${targetItems}`);
    //     STOP_RUNNING(0);
    // }
    // mlog.info(`Found ${targetRows.length} target rows in ${tsvFilePath} for targetItems.length: ${targetItems.length}`);
    // const outputPath = path.join(DATA_DIR, 'items', 'missingItems.tsv');
    // writeRowsToCsv(targetRows, outputPath);

    // await callTransactionProcessor(
    //     true, 
    //     soConstants.SALES_ORDER_LOG_DIR, 
    //     // TransactionProcessorStageEnum.VALIDATE
    // );
    trimFile(5, DEFAULT_LOG_FILEPATH);
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', JSON.stringify(error));
    STOP_RUNNING(1);
});
// const request: GetRecordRequest = {
//     recordType: RecordTypeEnum.SALES_ORDER,
//     idOptions:[{idProp: idPropertyEnum.EXTERNAL_ID, searchOperator: SearchOperatorEnum.TEXT.IS, idValue: 'SO:335745_NUM:24-31127_PO:16835(INVOICE)&lt;salesorder&gt;'}],
//     responseOptions: {
//         responseFields: ['externalid', 'tranid', 'entity', 'trandate', 'orderstatus'],
//     }
// }
// const response: GetRecordResponse = await getRecordById(request);
// mlog.debug(`GetRecordResponse: ${indentedStringify(response)}`);
async function callTransactionProcessor(
    useSubset: boolean = true,
    outputDir?: string,
    stopAfter?: TransactionProcessorStageEnum
): Promise<void> {
    const transactionFilePaths = (useSubset 
        ? [soConstants.SINGLE_ORDER_FILE]
        : [soConstants.SMALL_SUBSET_FILE]
    );
    const parseOptions: ParseOptions = { 
        [RecordTypeEnum.SALES_ORDER]: SO_PARSE_OPTIONS 
    };
    const postProcessingOptions: ProcessParseResultsOptions = {
        [RecordTypeEnum.SALES_ORDER]: SALES_ORDER_POST_PROCESSING_OPTIONS
    };
    const tranType = RecordTypeEnum.SALES_ORDER;
    const matchOptions: TransactionEntityMatchOptions = {
        entityType: EntityRecordTypeEnum.CUSTOMER,
        entityFieldId: 'entity',
        matchMethod: MatchSourceEnum.API
    }
    const options: TransactionProcessorOptions = {
        parseOptions,
        postProcessingOptions,
        matchOptions,
        clearLogFiles: [
            DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
        ],
        outputDir, 
        stopAfter
    }
    await processTransactionFiles(tranType, transactionFilePaths, options);
}

async function callEntityProcessor(
    useSubset: boolean = true,
    outputDir?: string,
    stopAfter?: EntityProcessorStageEnum
): Promise<void> {
    const entityType = EntityRecordTypeEnum.CUSTOMER;
    const ALL_CUSTOMERS = [
        customerConstants.FIRST_PART_FILE, 
        customerConstants.SECOND_PART_FILE, 
        customerConstants.THIRD_PART_FILE
    ];
    const customerFilePaths = (useSubset 
        ? [customerConstants.SUBSET_FILE]
        : ALL_CUSTOMERS
    );
    const options: EntityProcessorOptions = {
        clearLogFiles: [
            DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
        ],
        outputDir, 
        stopAfter
    }
    await processEntityFiles(entityType, customerFilePaths, options);
}

export { callEntityProcessor, callTransactionProcessor}