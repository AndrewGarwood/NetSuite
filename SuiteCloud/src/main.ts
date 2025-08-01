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
import { runItemPipeline, ItemPipelineOptions, ItemPipelineStageEnum } from "./pipelines/ItemPipeline"
import { 
    runEntityPipeline, EntityPipelineOptions, EntityPipelineStageEnum
} from "./pipelines/EntityPipeline";
import { runTransactionPipeline, 
    TransactionPipelineOptions, 
    TransactionPipelineStageEnum, TransactionEntityMatchOptions, MatchSourceEnum,
    LocalFileMatchOptions,
} from "./pipelines/TransactionPipeline";
import { validateFiles, extractTargetRows } from "./DataReconciler";
import { isEmptyArray, isNonEmptyArray, isNonEmptyString } from "./utils/typeValidation";
import * as validate from "./utils/argumentValidation";
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

    const viableFiles = getDirectoryFiles(
        soConstants.VIABLE_SO_DIR, '.csv', '.tsv'
    );
    let soFiles = viableFiles.slice(60, undefined); // handle subset for now
    let otherPaths = [];
    mlog.info([
        `viableFiles.length: ${viableFiles.length}`,
        `operating on: ${soFiles.length} file(s)`
    ].join(TAB));
    await DELAY(1000, null);
    await invokePipeline(RecordTypeEnum.SALES_ORDER, 
        soFiles, runTransactionPipeline, SO_PIPELINE_CONFIG
    );

    // let serviceItemFile = path.join(DATA_DIR, 'items', 'service_item_copy.tsv');
    // await invokePipeline(RecordTypeEnum.SERVICE_ITEM, 
    //     serviceItemFile, runItemPipeline, SERVICE_ITEM_PIPELINE_CONFIG
    // );



    mlog.info(`[END main()] at ${getCurrentPacificTime()}`,
        TAB+`handling logs...`
    );
    trimFile(5, ...LOG_FILES);
    for (const filePath of LOG_FILES) { formatDebugLogFile(filePath) }
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', JSON.stringify(error as any));
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
    clearLogFiles: [],
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [ItemPipelineStageEnum.VALIDATE, ItemPipelineStageEnum.PUT_ITEMS],
    stopAfter: ItemPipelineStageEnum.VALIDATE
}

export async function invokePipeline(
    recordType: RecordTypeEnum,
    filePaths: string | string[],
    pipeline: (recordType: string, filePaths: string[], options: any) => Promise<void>,
    pipelineOptions: TransactionPipelineOptions | ItemPipelineOptions | EntityPipelineOptions
): Promise<void> {
    const source = `main.invokePipeline`;
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths]
    validate.arrayArgument(source, {filePaths}, 'string', fs.existsSync);
    recordType = validate.enumArgument(source, {RecordTypeEnum}, {recordType}) as RecordTypeEnum;
    validate.functionArgument(source, {pipeline});
    validate.objectArgument(source, {pipelineOptions});
    mlog.debug(`[${source}()] calling ${pipeline.name}(...)`);
    await pipeline(recordType, filePaths, pipelineOptions);
}
