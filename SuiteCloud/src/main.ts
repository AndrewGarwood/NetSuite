/**
 * @file src/main.ts
 */
import * as fs from "node:fs";
import path from "node:path";
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    writeRowsToCsv as writeRows,
    clearFile, getCurrentPacificTime,
    formatDebugLogFile, getDirectoryFiles,
    getRows, RowSourceMetaData, isRowSourceMetaData,
    getColumnValues, isFile,
    getIndexedColumnValues, concatenateFiles,
    indentedStringify,
    trimFile
} from "./utils/io";
import { 
    STOP_RUNNING, DATA_DIR, DELAY, simpleLogger as slog,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH,
    ERROR_LOG_FILEPATH, DataDomainEnum,
    CLOUD_LOG_DIR, DEBUG_LOGS as DEBUG
} from "./config";
import { instantiateAuthManager, RecordOptions, RecordResponse, idSearchOptions } from "./api";
import { 
    runMainItemPipeline, 
    ItemPipelineOptions, 
    runEntityPipeline, 
    EntityPipelineOptions, 
    runMainTransactionPipeline, 
    TransactionMainPipelineOptions, INVENTORY_ITEM_PIPELINE_CONFIG,
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
    mlog.info(`[START main()] at ${getCurrentPacificTime()}`);
    await instantiateAuthManager();
    await initializeData();

    const csvFiles = getDirectoryFiles(
        soConstants.UNVIABLE_SO_DIR, '.csv', '.tsv'
    );
    let soFiles = csvFiles.slice(14); // handle subset for now
    slog.info([`csvFiles.length: ${csvFiles.length}`,
        `operating on: ${soFiles.length} file(s)`
    ].join(TAB));
    await DELAY(1000, null);
    await invokePipeline(RecordTypeEnum.SALES_ORDER, 
        soFiles, runMainTransactionPipeline, SALES_ORDER_PIPELINE_CONFIG
    );


    mlog.info([`[END main()] at ${getCurrentPacificTime()}`,
        `handling logs...`
    ].join(TAB));
    await trimFile(5, ...LOG_FILES);
    for (const filePath of LOG_FILES) { formatDebugLogFile(filePath) }
    STOP_RUNNING(0);
}
if (require.main === module) {
    main().catch(error => {
        mlog.error('Error executing main() function', NL+error);
        STOP_RUNNING(1);
    });
}


export async function invokePipeline(
    recordType: RecordTypeEnum,
    filePaths: string | string[],
    pipeline: (recordType: string, filePaths: string[], options: any) => Promise<void>,
    pipelineOptions: TransactionMainPipelineOptions | ItemPipelineOptions | EntityPipelineOptions
): Promise<void> {
    const source = `[main.invokePipeline()]`;
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths]
    validate.arrayArgument(source, {filePaths, filePath: isFile});
    recordType = validate.enumArgument(source, {recordType, RecordTypeEnum}) as RecordTypeEnum;
    validate.functionArgument(source, {pipeline});
    validate.objectArgument(source, {pipelineOptions});
    mlog.debug(`${source} calling ${pipeline.name}(...)`);
    try {
        await pipeline(recordType, filePaths, pipelineOptions);
    } catch (e) {
        mlog.error(`${source} Error caught when calling await ${pipeline.name}(...)`, NL+e)
    }
    return;
}
