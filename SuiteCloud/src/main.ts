/**
 * @file src/main.ts
 */
import * as fs from "node:fs";
import path from "node:path";
import {
    clearFile, getCurrentPacificTime,
    formatDebugLogFile, getDirectoryFiles,
    getRows, RowSourceMetaData, isRowSourceMetaData,
    getColumnValues, isFile,
    getIndexedColumnValues, concatenateFiles,
    indentedStringify,
    trimFile,
    getSourceString
} from "typeshi:utils/io";
import { 
    STOP_RUNNING, DELAY, simpleLogger as slog,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    getLogFiles,
    initializeEnvironment
} from "./config";
import { instantiateAuthManager, RecordOptions, RecordResponse, idSearchOptions } from "./api";
import { 
    runMainItemPipeline, 
    ItemPipelineOptions, 
    runEntityPipeline, 
    EntityPipelineOptions, 
    runMainTransactionPipeline, 
    TransactionMainPipelineOptions, LN_INVENTORY_ITEM_PIPELINE_CONFIG,
    NON_INVENTORY_ITEM_PIPELINE_CONFIG,
    SALES_ORDER_PIPELINE_CONFIG
} from "./pipelines";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants"
import { hasKeys, isEmptyArray, isNonEmptyArray, isNonEmptyString, isNullLike } from "typeshi:utils/typeValidation";
import * as validate from "typeshi:utils/argumentValidation";
import { getSkuDictionary, initializeData } from "./config/dataLoader";
import { EntityRecordTypeEnum, RecordTypeEnum } from "./utils/ns/Enums";
import { extractFileName } from "@typeshi/regex";

const F = extractFileName(__filename);

async function main() {
    const source = getSourceString(F, main.name);
    mlog.info(`${source} START at ${getCurrentPacificTime()}`);
    await initializeEnvironment();
    let logFiles = getLogFiles();
    await clearFile(...logFiles);
    await initializeData();
    await instantiateAuthManager();

    // stuff

    mlog.info([`${source} END at ${getCurrentPacificTime()}`,
        `handling logs...`
    ].join(TAB));
    await trimFile(5, ...logFiles);
    for (const filePath of logFiles) { formatDebugLogFile(filePath) }
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
    const source = getSourceString(F, invokePipeline.name);
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
