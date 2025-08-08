/**
 * @file src/main.ts
 */
import * as fs from "node:fs";
import path from "node:path";
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    writeRowsToCsv as writeRows,
    trimFile, clearFileSync, clearFile, getCurrentPacificTime,
    formatDebugLogFile, getDirectoryFiles,
    getRows, RowSourceMetaData, isRowSourceMetaData,
    getColumnValues,
    getIndexedColumnValues, concatenateFiles,
    indentedStringify
} from "./utils/io";
import { 
    STOP_RUNNING, DATA_DIR, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH,
    ERROR_LOG_FILEPATH, DataDomainEnum,
    CLOUD_LOG_DIR, DEBUG_LOGS as DEBUG
} from "./config";
import { instantiateAuthManager, RecordOptions, RecordResponse } from "./api";
import { 
    runItemPipeline, 
    ItemPipelineOptions, 
    runEntityPipeline, 
    EntityPipelineOptions, 
    runTransactionPipeline, 
    TransactionPipelineOptions, INVENTORY_ITEM_PIPELINE_CONFIG,
    NON_INVENTORY_ITEM_PIPELINE_CONFIG,
    SALES_ORDER_PIPELINE_CONFIG
} from "./pipelines";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants"
import { validateFiles, extractTargetRows } from "./DataReconciler";
import { hasKeys, isEmptyArray, isNonEmptyArray, isNonEmptyString, isNullLike } from "./utils/typeValidation";
import * as validate from "./utils/argumentValidation";
import { getSkuDictionary, initializeData } from "./config/dataLoader";
import { EntityRecordTypeEnum, RecordTypeEnum } from "./utils/ns/Enums";
import { CLEAN_ITEM_ID_OPTIONS } from "./parse_configurations/evaluators";
import { CleanStringOptions, extractLeaf, clean } from "./utils/regex";
import { SalesOrderColumnEnum } from "./parse_configurations/salesorder/salesOrderConstants";

const LOG_FILES = [
    DEFAULT_LOG_FILEPATH, 
    PARSE_LOG_FILEPATH, 
    ERROR_LOG_FILEPATH
];


async function main() {
    await clearFile(...LOG_FILES);
    await DELAY(1000, null); // delay to ensure file handles are released
    mlog.info(`[START main()] at ${getCurrentPacificTime()}`)
    await instantiateAuthManager();
    await initializeData();
    
    const csvFiles = getDirectoryFiles(
        soConstants.UNVIABLE_SO_DIR, '.csv', '.tsv'
    );
    let soFiles = csvFiles.slice(0, 3); // handle subset for now
    mlog.info([
        `csvFiles.length: ${csvFiles.length}`,
        `   operating on: ${soFiles.length} file(s)`
    ].join(TAB));
    await DELAY(1000, null);
    await invokePipeline(RecordTypeEnum.SALES_ORDER, 
        soFiles, runTransactionPipeline, SALES_ORDER_PIPELINE_CONFIG
    );
    mlog.info([`[END main()] at ${getCurrentPacificTime()}`,
        `handling logs...`
    ].join(TAB));
    trimFile(5, ...LOG_FILES);
    for (const filePath of LOG_FILES) { formatDebugLogFile(filePath) }
    STOP_RUNNING(0);
}
if (require.main === module) {
    main().catch(error => {
        mlog.error('Error executing main() function', JSON.stringify(error as any));
        STOP_RUNNING(1);
    });
}

const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}

export async function invokePipeline(
    recordType: RecordTypeEnum,
    filePaths: string | string[],
    pipeline: (recordType: string, filePaths: string[], options: any) => Promise<void>,
    pipelineOptions: TransactionPipelineOptions | ItemPipelineOptions | EntityPipelineOptions
): Promise<void> {
    const source = `[main.invokePipeline()]`;
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths]
    validate.arrayArgument(source, {filePaths}, 'string', validate.isFile);
    recordType = validate.enumArgument(source, {RecordTypeEnum}, {recordType}) as RecordTypeEnum;
    validate.functionArgument(source, {pipeline});
    validate.objectArgument(source, {pipelineOptions});
    mlog.debug(`${source} calling ${pipeline.name}(...)`);
    await pipeline(recordType, filePaths, pipelineOptions);
}
