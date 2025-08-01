/**
 * @file src/ItemPipeline.ts
 */
import path from 'node:path';
import * as fs from 'fs';
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    getCsvRows, getOneToOneDictionary,
    ValidatedParseResults,
    ProcessParseResultsOptions, ParseOptions, ParseResults,
    getCurrentPacificTime, 
    indentedStringify, clearFile,
    getFileNameTimestamp, RowSourceMetaData
} from "../utils/io";
import { 
    STOP_RUNNING, DELAY,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    INFO_LOGS, DEBUG_LOGS as DEBUG, SUPPRESSED_LOGS as SUP, 
    ERROR_DIR,
    CLOUD_LOG_DIR
} from "../config";
import { 
    RecordOptions, RecordRequest, RecordResponse, 
    RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload,
    GetRecordRequest, getRecordById, GetRecordResponse,
    FieldDictionary,
    idSearchOptions,
    FieldValue,
    SetFieldSubrecordOptions,
    SourceTypeEnum,
    LogTypeEnum, 
} from "../api";
import { parseRecordCsv } from "../csvParser";
import { processParseResults, getValidatedDictionaries } from "../parseResultsProcessor";
import { 
    isNonEmptyArray, isNullLike as isNull, isEmptyArray, hasKeys, 
    TypeOfEnum, isNonEmptyString, isIntegerArray,
} from '../utils/typeValidation';
import { getColumnValues, getRows, isValidCsv } from '../utils/io/reading';
import * as validate from '../utils/argumentValidation';
import { RecordTypeEnum, SearchOperatorEnum } from '../utils/ns/Enums';
import { isRecordOptions, isRecordResponseOptions, isRowSourceMetaData } from '../utils/typeGuards';


export const ITEM_RESPONSE_OPTIONS: RecordResponseOptions = {
    responseFields: [
        'itemid', 'externalid', 'displayname'
    ],
    responseSublists: {
        price1: ['pricelevel', 'price']
    }
}

/**
 * @enum {string} **`ItemPipelineStageEnum`**
 * @property **`PARSE`** = `'PARSE'`
 * @property **`VALIDATE`** = `'VALIDATE'`
 * @property **`PUT_ITEMS`** = `'PUT_ITEMS'`
 * @property **`END`** = `'END'`
 */
export enum ItemPipelineStageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    PUT_ITEMS = 'PUT_ITEMS',
    END = 'END'
}

export type ItemPipelineOptions = {
    parseOptions: ParseOptions;
    postProcessingOptions?: ProcessParseResultsOptions;
    /** `RecordResponseOptions` for the item put request */
    responseOptions?: RecordResponseOptions;
    clearLogFiles?: string[];
    /**
     * if `outputDir` is a valid directory, 
     * `entityProcessor` will write output data from stages in `stagesToWrite` here. 
     * */
    outputDir?: string;
    /** specify at which stage(s) that data being processed should be written to `outputDir` */
    stagesToWrite?: ItemPipelineStageEnum[];
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: ItemPipelineStageEnum;
}

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

export async function runItemPipeline(
    itemType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: ItemPipelineOptions
): Promise<void> {
    const source = `${__filename}.runItemPipeline`;
    validate.enumArgument(source, {RecordTypeEnum}, {itemType})
    validate.objectArgument(source, {options});
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    validate.arrayArgument(source, {filePaths}, TypeOfEnum.STRING, isNonEmptyString);
    const {
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as ItemPipelineOptions;
    validate.objectArgument(source, {parseOptions});
    // validate.objectArgument(source, {postProcessingOptions});
    if (isNonEmptyArray(clearLogFiles)) clearFile(...clearLogFiles);
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
        const { validDict, invalidDict } = getValidatedDictionaries(validatedResults);
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
                    logs: res.logArray.filter(l => l.type === LogTypeEnum.ERROR)
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
    responseOptions: RecordResponseOptions = ITEM_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    const source = `${__filename}.putItems`;
    try {
        validate.arrayArgument(source, {items}, 'RecordOptions', isRecordOptions);
        validate.objectArgument(source, {responseOptions}, 
            'RecordResponseOptions', isRecordResponseOptions
        );
    } catch (error) {
        mlog.error(`[${source}()] Invalid parameters:`, JSON.stringify(error as any));
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
        mlog.error(`[${source}()] Error putting items:`, (error as any));
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_putItems.json`)
        );
    }
    return [];
}