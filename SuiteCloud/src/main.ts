/**
 * @file src/main.ts
 */
import {
    clearFile, getCurrentPacificTime,
    formatDebugLogFile, isFile,
    trimFile,
    getSourceString
} from "typeshi:utils/io";
import { 
    STOP_RUNNING, simpleLogger as slog,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    getLogFiles,
    initializeEnvironment, initializeData
} from "./config";
import { instantiateAuthManager } from "./api";
import { 
    runMainItemPipeline, 
    ItemPipelineOptions, 
    runEntityPipeline, 
    EntityPipelineOptions, 
    runMainTransactionPipeline, 
    TransactionMainPipelineOptions, 
    LN_INVENTORY_ITEM_PIPELINE_CONFIG,
    NON_INVENTORY_ITEM_PIPELINE_CONFIG,
    SALES_ORDER_PIPELINE_CONFIG
} from "./pipelines";
import { isNonEmptyArray } from "typeshi:utils/typeValidation";
import * as validate from "typeshi:utils/argumentValidation";
import { RecordTypeEnum } from "./utils/ns/Enums";
import path from "node:path";

async function main() {
    const source = getSourceString(__filename, main.name);
    mlog.info(`${source} START at ${getCurrentPacificTime()}`);
    await initializeEnvironment();
    let logFiles = getLogFiles();
    await clearFile(...logFiles);
    await initializeData();
    await instantiateAuthManager();
    /* ===================================================================== */

    // await invokePipeline(
    //     RecordTypeEnum.SALES_ORDER, 
    //     ['filePaths'], 
    //     runMainTransactionPipeline, 
    //     SALES_ORDER_PIPELINE_CONFIG
    // );

    /* ===================================================================== */
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
    options: TransactionMainPipelineOptions | ItemPipelineOptions | EntityPipelineOptions
): Promise<void> {
    const source = getSourceString(__filename, invokePipeline.name);
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths]
    validate.arrayArgument(source, {filePaths, filePath: isFile});
    recordType = validate.enumArgument(source, {recordType, RecordTypeEnum}) as RecordTypeEnum;
    validate.functionArgument(source, {pipeline});
    validate.objectArgument(source, {options});
    mlog.debug(`${source} calling ${pipeline.name}(...)`);
    try {
        await pipeline(recordType, filePaths, options);
    } catch (e) {
        mlog.error(`${source} Error caught when calling ${pipeline.name}(...)`, NL+e)
    }
    return;
}
