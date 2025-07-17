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
    await initializeData();

    const stagesToWrite: TransactionProcessorStageEnum[] = [
        TransactionProcessorStageEnum.PUT_SALES_ORDERS
    ]
    const viableFiles = (fs.readdirSync(soConstants.VIABLE_SO_DIR)
        .filter(file => 
            file.toLowerCase().endsWith('.csv') 
            || file.toLowerCase().endsWith('.tsv')
        )
        .map(file => path.join(soConstants.VIABLE_SO_DIR, file))
    );
    mlog.info(`viableFiles.length ${viableFiles.length}`);
    let filePaths = viableFiles.slice(0, 4); // handle subset for now
    await callTransactionProcessor(
        filePaths,
        soConstants.SALES_ORDER_LOG_DIR, 
        TransactionProcessorStageEnum.END,
        stagesToWrite
    );

    trimFile(5, DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH);
    mlog.info(`[END main()] at ${getCurrentPacificTime()}`)
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', JSON.stringify(error));
    STOP_RUNNING(1);
});

/**
 * @TODO in python pre processing, 
 * set aside transactions with negative qty/price/amount to handle later?
 * or just take absolute value in post processing?
 */

async function callTransactionProcessor(
    transactionFilePaths: string | string[],
    outputDir?: string,
    stopAfter: TransactionProcessorStageEnum = TransactionProcessorStageEnum.END,
    stagesToWrite: TransactionProcessorStageEnum[] = [
        TransactionProcessorStageEnum.PUT_SALES_ORDERS
    ]
): Promise<void> {
    if (typeof transactionFilePaths === 'string') { // assume single file path given
        transactionFilePaths = [transactionFilePaths]
    }
    // mlog.debug(`[START main.callTransactionProcessor()] defining variables...`)
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
        clearLogFiles: [DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH],
        outputDir,
        stagesToWrite, 
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