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
    trimFile
} from "typeshi/dist/utils/io";
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
    TransactionMainPipelineOptions, LN_INVENTORY_ITEM_PIPELINE_CONFIG,
    NON_INVENTORY_ITEM_PIPELINE_CONFIG,
    SALES_ORDER_PIPELINE_CONFIG
} from "./pipelines";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants"
import { hasKeys, isEmptyArray, isNonEmptyArray, isNonEmptyString, isNullLike } from "typeshi/dist/utils/typeValidation";
import * as validate from "typeshi/dist/utils/argumentValidation";
import { getSkuDictionary, initializeData } from "./config/dataLoader";
import { EntityRecordTypeEnum, RecordTypeEnum } from "./utils/ns/Enums";

const LOG_FILES = [
    DEFAULT_LOG_FILEPATH, 
    PARSE_LOG_FILEPATH, 
    ERROR_LOG_FILEPATH
];


async function main() {
    await clearFile(...LOG_FILES);
    mlog.info(`[START main()] at ${getCurrentPacificTime()}`);
    await initializeData();
    await instantiateAuthManager();

    // const itemFile = path.join(DATA_DIR, 'items', 'lot_numbered_inventory_item0.tsv');
    const LN_itemFile = path.join(DATA_DIR, 'items', 'lnii_subset.tsv');

    await invokePipeline(
        RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM, 
        LN_itemFile, 
        runMainItemPipeline, 
        LN_INVENTORY_ITEM_PIPELINE_CONFIG
    )
    // const nonInventoryFile = path.join(DATA_DIR, 'items', 'missing_non_inventory_item.tsv');
    // await invokePipeline(
    //     RecordTypeEnum.NON_INVENTORY_ITEM,
    //     nonInventoryFile,
    //     runMainItemPipeline,
    //     NON_INVENTORY_ITEM_PIPELINE_CONFIG
    // )

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

    // const csvFiles = getDirectoryFiles(
    //     soConstants.UNVIABLE_SO_DIR, '.csv', '.tsv'
    // );
    // let soFiles = csvFiles.slice(14); // handle subset for now
    // slog.info([`csvFiles.length: ${csvFiles.length}`,
    //     `operating on: ${soFiles.length} file(s)`
    // ].join(TAB));
    // await DELAY(1000, null);
    // await invokePipeline(RecordTypeEnum.SALES_ORDER, 
    //     soFiles, runMainTransactionPipeline, SALES_ORDER_PIPELINE_CONFIG
    // );

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
