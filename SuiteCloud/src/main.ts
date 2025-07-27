/**
 * @file src/main.ts
 */
import * as fs from "fs";
import path from "node:path";
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    ProcessParseResultsOptions, ParseOptions,
    trimFile, clearFile, getCurrentPacificTime,
    formatDebugLogFile, getDirectoryFiles,
} from "./utils/io";
import { 
    STOP_RUNNING, CLOUD_LOG_DIR, DATA_DIR,
    SCRIPT_ENVIRONMENT as SE, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH,
    ERROR_LOG_FILEPATH, DataDomainEnum,
    ERROR_DIR, DEBUG_LOGS as DEBUG, SUPPRESSED_LOGS as SUP
} from "./config";
import { instantiateAuthManager } from "./api";
import { 
    SERVICE_ITEM_PARSE_OPTIONS 
} from "./parse_configurations/item/itemParseDefinition"
import { SALES_ORDER_PARSE_OPTIONS as SO_PARSE_OPTIONS, 
    SALES_ORDER_POST_PROCESSING_OPTIONS as SALES_ORDER_POST_PROCESSING_OPTIONS 
} from "./parse_configurations/salesorder/salesOrderParseDefinition";
import * as customerConstants from "./parse_configurations/customer/customerConstants";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants";
import { runItemPipeline, ItemPipelineOptions, ItemPipelineStageEnum } from "./ItemPipeline"
import { 
    runEntityPipeline, EntityPipelineOptions, EntityPipelineStageEnum
} from "./EntityPipeline";
import { runTransactionPipeline, 
    TransactionPipelineOptions, 
    TransactionPipelineStageEnum, TransactionEntityMatchOptions, MatchSourceEnum,
    LocalFileMatchOptions,
} from "./TransactionPipeline";
import { validateFiles, extractTargetRows } from "./DataReconciler";
import { isEmptyArray, isNonEmptyArray, isNonEmptyString } from "./utils/typeValidation";
import * as validate from './utils/argumentValidation'
import { initializeData } from "./config/dataLoader";
import { EntityRecordTypeEnum, RecordTypeEnum } from "./utils/ns/Enums";

const LOG_FILES = [
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
];
async function main() {
    clearFile(...LOG_FILES);
    mlog.info(`[START main()] at ${getCurrentPacificTime()}`)
    await instantiateAuthManager();
    await initializeData();
    // STOP_RUNNING(0);
    const viableFiles = getDirectoryFiles(
        soConstants.VIABLE_SO_DIR, '.csv', '.tsv'
    );
    let filePaths = viableFiles.slice(49, 50); // handle subset for now
    let otherPaths = [];
    mlog.info([
        `viableFiles.length: ${viableFiles.length}`,
        `operating on: ${filePaths.length} file(s)`
    ].join(TAB));
    await DELAY(1000, null);
    await invokePipeline(RecordTypeEnum.SALES_ORDER, 
        filePaths, runTransactionPipeline, SO_PIPELINE_CONFIG
    );
    mlog.info(`[END main()] at ${getCurrentPacificTime()}`,
        TAB+`handling logs...`
    );
    trimFile(5, ...LOG_FILES);
    for (const filePath of LOG_FILES) { formatDebugLogFile(filePath) }
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', JSON.stringify(error));
    STOP_RUNNING(1);
});

const SO_PIPELINE_CONFIG: TransactionPipelineOptions = {
    parseOptions: { 
        [RecordTypeEnum.SALES_ORDER]: SO_PARSE_OPTIONS 
    } as ParseOptions,
    postProcessingOptions: { 
        [RecordTypeEnum.SALES_ORDER]: SALES_ORDER_POST_PROCESSING_OPTIONS 
    } as ProcessParseResultsOptions,
    matchOptions: {
        entityType: EntityRecordTypeEnum.CUSTOMER,
        entityFieldId: 'entity',
        matchMethod: MatchSourceEnum.API,
        localFileOptions: {
            filePath: path.join(DATA_DIR, 'uploaded', 'customer.tsv'),
            entityIdColumn: 'Name',
            internalIdColumn: 'Internal ID'
        } as LocalFileMatchOptions
    } as TransactionEntityMatchOptions,
    generateMissingEntities: true,
    clearLogFiles: LOG_FILES,
    outputDir: soConstants.SALES_ORDER_LOG_DIR,
    stagesToWrite: [TransactionPipelineStageEnum.PUT_SALES_ORDERS],
    stopAfter: TransactionPipelineStageEnum.END
}

const SERVICE_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.SERVICE_ITEM]: SERVICE_ITEM_PARSE_OPTIONS },
    clearLogFiles: LOG_FILES,
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [ItemPipelineStageEnum.PARSE, ItemPipelineStageEnum.PUT_ITEMS],
    stopAfter: ItemPipelineStageEnum.PARSE
}

export async function invokePipeline(
    recordType: RecordTypeEnum,
    filePaths: string | string[],
    pipeline: (recordType: string, filePaths: string[], pipelineOptions: any) => Promise<void>,
    options: TransactionPipelineOptions | ItemPipelineOptions | EntityPipelineOptions
): Promise<void> {
    const source = `${__filename}.invokePipeline`;
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths]
    validate.arrayArgument(source, {filePaths}, 'string', fs.existsSync);
    recordType = validate.enumArgument(source, {RecordTypeEnum}, {recordType}) as RecordTypeEnum;
    validate.functionArgument(source, {pipeline});
    validate.objectArgument(source, {options});
    mlog.debug(`[${source}()] calling ${pipeline.name}...`);
    await pipeline(recordType, filePaths, options);
}

/**
 * @deprecated use {@link invokePipeline}
 * @param transactionType 
 * @param transactionFilePaths 
 * @param options 
 */
export async function invokeTransactionPipeline(
    transactionType: RecordTypeEnum,
    transactionFilePaths: string | string[],
    options: TransactionPipelineOptions
): Promise<void> {
    if (isNonEmptyString(transactionFilePaths)) { // assume single file path given
        transactionFilePaths = [transactionFilePaths]
    }
    mlog.debug(`[invokeTransactionPipeline()] calling runTransactionPipeline...`);
    await runTransactionPipeline(transactionType, transactionFilePaths, options);
}

/**
 * @deprecated  use {@link invokePipeline}
 * @param useSubset 
 * @param outputDir 
 * @param stopAfter 
 */
export async function invokeEntityPipeline(
    useSubset: boolean = true,
    outputDir?: string,
    stopAfter?: EntityPipelineStageEnum
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
    const options: EntityPipelineOptions = {
        clearLogFiles: [
            DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
        ],
        outputDir, 
        stopAfter
    }
    await runEntityPipeline(entityType, customerFilePaths, options);
}