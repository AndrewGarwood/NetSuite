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
    RowDictionary, extractLeaf,
    trimFile, clearFile, getCurrentPacificTime,
    getRows,
    getIndexedColumnValues,
    getColumnValues
} from "./utils/io";
import { 
    STOP_RUNNING, CLOUD_LOG_DIR, DATA_DIR,
    SCRIPT_ENVIRONMENT as SE, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH,
    ERROR_LOG_FILEPATH, DataDomainEnum,
    ERROR_DIR, DEBUG_LOGS as DEBUG, SUPPRESSED_LOGS as SUP
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
    mlog.info(`[START main()] at ${getCurrentPacificTime()}`)
    await instantiateAuthManager();
    // Initialize application data first
    await initializeData();
    await callTransactionProcessor(
        false, 
        soConstants.SALES_ORDER_LOG_DIR, 
        // TransactionProcessorStageEnum.VALIDATE
    );

    // ---- Was Isolating Missing Items ----
    // let validationDict: Record<string, string> = {};
    // try {
    //     validationDict = await getSkuDictionary();
    // } catch (error) {
    //     mlog.error('Failed to load SKU dictionary:', error);
    //     STOP_RUNNING(1);
    // }
    // const ITEM_ID_COLUMN = 'Item';
    // const TRAN_ID_COLUMN = 'Trans #';
    // const ALL_SALES_ORDERS_DIR = path.join(soConstants.SALES_ORDER_DIR, 'all');
    // const sourcePath = ALL_SALES_ORDERS_DIR;
    // const csvFiles = (fs.readdirSync(sourcePath)
    //     .filter(file => file.toLowerCase().endsWith('.csv') 
    //         || file.toLowerCase().endsWith('.tsv'))
    //     .map(file => path.join(sourcePath, file))
    // );
    // const missingItems = Array.from(new Set(
    //     Object.values(await validateFiles(
    //         csvFiles, ITEM_ID_COLUMN, extractLeaf, validationDict
    //     )).flat()
    // ));
    // mlog.debug(`[main()] identified ${missingItems.length} missing item(s) with validateFiles()`)
    
    // if (isEmptyArray(missingItems)) {
    //     STOP_RUNNING(1, `missingItems array is empty`)
    // }
    // const fileProblemCounts: Record<string, number> = {}
    // const problematicTransactions: string[] = []
    // let i = 0;
    // let numTransactions = 0;
    // for (const file of csvFiles) {
    //     const rows = await getRows(file);
    //     numTransactions += (await getColumnValues(rows, TRAN_ID_COLUMN)).length
    //     const targetRows = await extractTargetRows(
    //         rows, ITEM_ID_COLUMN, missingItems, extractLeaf
    //     );
    //     if (isEmptyArray(targetRows)) continue;
    //     const tranIds = await getColumnValues(targetRows, TRAN_ID_COLUMN);
    //     if (DEBUG.length > 0) mlog.debug(...DEBUG);
    //     DEBUG.length = 0;
    //     i++;
    //     if (isEmptyArray(tranIds)) continue;
    //     fileProblemCounts[file] = tranIds.length
    //     problematicTransactions.push(...tranIds)
    // }
    // if (isEmptyArray(Object.keys(fileProblemCounts))) {
    //     throw new Error(`fileProblemCounts keys.length === 0 but should be greater than zero `)
    // }
    // mlog.debug(`[main()] Finished isolating problems after processing ${csvFiles.length} file(s)`,
    //     TAB+`  number of missing items: ${missingItems.length}`,
    //     TAB+`       problem file count: ${Object.keys(fileProblemCounts).length}`,
    //     TAB+`problem transaction count: ${problematicTransactions.length}`,
    //     TAB+`  total transaction count: ${numTransactions}`
    // );
    // write({missingItems}, path.join(DATA_DIR, 'items', 'missingItems.json'));
    // write({fileProblemCounts}, 
    //     path.join(soConstants.SALES_ORDER_DIR, 'fileProblemCounts.json')
    // );
    // write({problematicTransactions}, 
    //     path.join(soConstants.SALES_ORDER_DIR, 'problematicTransactions.json')
    // );
    /*
    map filePath : List of transaction numbers where the transaction has 
    a corresponding row with extractLeaf(row[Item]) in missingItems
    */


    
    trimFile(5, DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH);
    mlog.info(`[END main()] at ${getCurrentPacificTime()}`)
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', JSON.stringify(error));
    STOP_RUNNING(1);
});
    // const missingItemsTsvPath = path.join(DATA_DIR, 'items', 'missingItems.tsv');
    // const missingItems = await getColumnValues(missingItemsTsvPath, ITEM_ID_COLUMN);

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
    mlog.debug(`[START main.callTransactionProcessor()] defining variables...`)
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
    mlog.debug(`[main.callTransactionProcessor()] calling processTransactionFiles...`)
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