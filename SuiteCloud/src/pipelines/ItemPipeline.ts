/**
 * @file src/ItemPipeline.ts
 */
import path from 'node:path';
import * as fs from 'fs';
import {
    readJsonFileAsObject as read,
    writeObjectToJsonSync as write,
    getCsvRows, getOneToOneDictionary,
    getCurrentPacificTime, 
    indentedStringify, clearFileSync,
    getFileNameTimestamp, RowSourceMetaData
} from "typeshi:utils/io";
import { 
    STOP_RUNNING, DELAY, simpleLogger as slog,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    INFO_LOGS, DEBUG_LOGS as DEBUG, SUPPRESSED_LOGS as SUP, 
    ERROR_DIR,
    CLOUD_LOG_DIR
} from "../config";
import { 
    RecordOptions, RecordResponse, 
    RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload,
    SingleRecordRequest, getRecordById,
    FieldDictionary,
    idSearchOptions,
    FieldValue,
    SetFieldSubrecordOptions,
    SourceTypeEnum,
    LogTypeEnum,
    isRecordOptions,
    isRecordResponseOptions,
    RecordRequest, 
} from "../api";
import { 
    isNonEmptyArray, isNullLike as isNull, isEmptyArray, hasKeys, 
    TypeOfEnum, isNonEmptyString, isIntegerArray,
} from "typeshi:utils/typeValidation";
import * as validate from "typeshi:utils/argumentValidation";
import { RecordTypeEnum, SearchOperatorEnum } from "../utils/ns/Enums";
import { 
    WarehouseContent, ItemPipelineOptions, ItemPipelineStageEnum, 
    WarehouseDictionary 
} from "./types";
import { DEFAULT_ITEM_RESPONSE_OPTIONS, BIN_RESPONSE_OPTIONS } from "./ItemConfig";
import { clean, CleanStringOptions, extractLeaf } from "typeshi:utils/regex";
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators/item";
import { parseRecordCsv } from 'src/services/parse';
import { ParseResults, ValidatedParseResults } from 'src/services/parse/types/index';
import { 
    getCompositeDictionaries, processParseResults 
} from 'src/services/post_process/parseResultsProcessor';


/**
 * @param options 
 * @param fileName 
 * @param stage 
 * @param stageData 
 * @returns **`boolean`**
 */
async function done(
    options: ItemPipelineOptions, 
    fileName: string,
    stage: ItemPipelineStageEnum,
    stageData: Record<string, any>,
): Promise<boolean> {
    let stagesToWrite = (isNonEmptyArray(options.stagesToWrite) 
        ? options.stagesToWrite
        : []
    );
    const { stopAfter, outputDir } = options;
    fileName = fileName.trim().replace(/(\.([a-z]+))$/i, '');
    if (outputDir && fs.existsSync(outputDir) 
        && Object.values(stagesToWrite).includes(stage)) {
        const outputPath = path.join(
            outputDir, `${getFileNameTimestamp()}_${fileName}_${stage}.json`
        );
        write(stageData, outputPath);
    }
    if (stopAfter && stopAfter === stage) {
        mlog.info([
            `[END runItemPipeline()] - done(options...) returned true`,
            `fileName: '${fileName}'`,
            `   stage: '${stage}'`,
        ].join(TAB));
        return true;
    }
    return false;
}

export async function runMainItemPipeline(
    itemType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: ItemPipelineOptions
): Promise<void> {
    const source = `ItemPipeline.runMainItemPipeline`;
    validate.enumArgument(source, {itemType, RecordTypeEnum})
    validate.objectArgument(source, {options});
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    validate.arrayArgument(source, {filePaths, isNonEmptyString});
    const {
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as ItemPipelineOptions;
    validate.objectArgument(source, {parseOptions});
    // validate.objectArgument(source, {postProcessingOptions});
    if (isNonEmptyArray(clearLogFiles)) clearFileSync(...clearLogFiles);
    for (let i = 0; i < filePaths.length; i++) {
        const csvPath = filePaths[i];
        let fileName = path.basename(csvPath);
        // ====================================================================
        // ItemPipelineStageEnum.PARSE
        // ====================================================================
        const parseResults: ParseResults = await parseRecordCsv(
            csvPath, parseOptions, SourceTypeEnum.LOCAL_FILE
        );
        if (await done(
            options, fileName, ItemPipelineStageEnum.PARSE, parseResults
        )) return;
        // ====================================================================
        // ItemPipelineStageEnum.VALIDATE
        // ====================================================================
        const validatedResults = await processParseResults(
            parseResults, postProcessingOptions
        ) as ValidatedParseResults;
        if (await done(
            options, fileName, ItemPipelineStageEnum.VALIDATE, validatedResults
        )) return;
        const { validDict, invalidDict } = getCompositeDictionaries(validatedResults);
        const invalidItems = Object.values(invalidDict).flat();
        if (invalidItems.length > 0) {
            write(invalidDict, path.join(CLOUD_LOG_DIR, `items`, 
                `${getFileNameTimestamp()}_${fileName}_${itemType}_invalidOptions.json`)
            );
        }
        const validItems = Object.values(validDict).flat();
        // ====================================================================
        // ItemPipelineStageEnum.PUT_ITEMS
        // ====================================================================
        mlog.info([`[runItemPipeline()] finished VALIDATE, starting PUT_ITEMS`,
            `    num items parsed: ${Object.values(parseResults).flat().length}`,
            `  valid items length: ${validItems.length}`,
            `invalid items length: ${invalidItems.length}`,
        ].join(TAB));
        const itemResponses = await putItems(validItems, responseOptions);
        let successCount = 0;
        let numRejects = 0;
        const rejectResponses: any[] = [];
        for (const res of itemResponses) {
            if (isNonEmptyArray(res.rejects)) {
                numRejects += res.rejects.length;
                rejectResponses.push({
                    status: res.status,
                    message: res.message,
                    error: res.error,
                    rejects: res.rejects,
                    logs: res.logs.filter(l => 
                        l.type === LogTypeEnum.ERROR || l.type === LogTypeEnum.AUDIT
                    )
                })
            }
            if (isNonEmptyArray(res.results)) successCount += res.results.length;
        }
        if (numRejects > 0){
            write(
                {
                    timestamp: getCurrentPacificTime(),
                    sourceFile: csvPath,
                    numRejects,
                    rejectResponses,
                }, 
                path.join(CLOUD_LOG_DIR, 'items', 
                    `${getFileNameTimestamp()}_${fileName}_${itemType}_putRejects.json`
                )
            );
        }
        if (await done(
            options, fileName, 
            ItemPipelineStageEnum.PUT_ITEMS, 
            { successCount, failureCount: numRejects } // itemResponses
        )) return;
    }
    // ====================================================================
    // ItemPipelineStageEnum.END
    // ====================================================================
    return;
}

export async function putItems(
    items: RecordOptions[],
    responseOptions: RecordResponseOptions = DEFAULT_ITEM_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    const source = `[ItemPipeline.putItems()]`;
    try {
        validate.arrayArgument(source, {items , isRecordOptions});
        if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    } catch (error) {
        mlog.error(`${source} Invalid parameters:`, JSON.stringify(error as any));
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_putItems.json`)
        );
        return [];
    }
    try {
        const itemRequest: RecordRequest = {
            recordOptions: items,
            responseOptions
        }
        return await upsertRecordPayload(itemRequest) as RecordResponse[]
    } catch (error) {
        mlog.error(`${source} Error putting items:`, (error as any));
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_putItems.json`)
        );
    }
    return [];
}

export async function putBins(
    bins: RecordOptions[],
    responseOptions: RecordResponseOptions = BIN_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    const source = `[ItemPipeline.putBins()]`;
    try {
        validate.arrayArgument(source, {bins , isRecordOptions});
        if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    } catch (error) {
        mlog.error(`${source} Invalid parameters:`, error);
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_putBins.json`)
        );
        return [];
    }
    try {
        const binRequest: RecordRequest = {
            recordOptions: bins,
            responseOptions
        }
        return await upsertRecordPayload(binRequest) as RecordResponse[]
    } catch (error) {
        mlog.error(`${source} Error putting bins:`, error);
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_putBins.json`)
        );
    }
    return []
}


export async function generateBinOptions(
    warehouses: WarehouseDictionary
): Promise<RecordOptions[]> {
    let bins: RecordOptions[] = [];
    for (let [locationId, binDict] of Object.entries(warehouses)) {
        let locInternalId = Number(locationId);
        for (let [binId, binContent] of Object.entries(binDict)) {
            let contentString = `content: ${JSON.stringify(binContent)}`;
            let itemString = `items: ${JSON.stringify(Object.keys(binContent))}`;
            let memoValue = contentString.length <= 999 ? contentString :
                itemString.length <= 999 ? itemString : '';
            let rec: RecordOptions = {
                recordType: RecordTypeEnum.BIN,
                fields: { 
                    binnumber: binId,
                    location: locInternalId,
                    externalid: `${binId}<bin>`
                }
            }
            if (memoValue && rec.fields) rec.fields.memo = memoValue;
            bins.push(rec);
        }
    }
    return bins;
}
