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
    indentedStringify, clearFileSync,
    getFileNameTimestamp, RowSourceMetaData
} from "../utils/io";
import { 
    STOP_RUNNING, DELAY, simpleLogger as slog,
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
} from "../utils/typeValidation";
import { getColumnValues, getRows, isValidCsvSync } from "../utils/io/reading";
import * as validate from "../utils/argumentValidation";
import { RecordTypeEnum, SearchOperatorEnum } from "../utils/ns/Enums";
import { isRecordOptions, isRecordResponseOptions, isRowSourceMetaData } from "../utils/typeGuards";
import { WarehouseBin, ItemPipelineOptions, ItemPipelineStageEnum, WarehouseDictionary } from "./types";
import { ITEM_RESPONSE_OPTIONS, BIN_RESPONSE_OPTIONS } from "./ItemConfig";
import { clean, CleanStringOptions, extractLeaf } from "../utils/regex";
import { CLEAN_ITEM_ID_OPTIONS } from "../parse_configurations/evaluators/item";


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
    const source = `ItemPipeline.runItemPipeline`;
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
    const source = `[ItemPipeline.putItems()]`;
    try {
        validate.arrayArgument(source, {items , isRecordOptions});
        validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
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

/**
 * @param filePath `string` `path.join(ONE_DRIVE_DIR, 'Bin Numbers.xlsx')`
 * @param locations `Record<string, number>`
 * @param idColumn `string`
 * @returns **`warehouseDictionary`** {@link WarehouseDictionary}
 */
export async function generateWarehouseDictionary(
    filePath: string,
    locations: Record<string, number> = LOCATION_ID_DICT,
    idColumn: string = 'Item #'
): Promise<WarehouseDictionary> {
    const wDict: WarehouseDictionary = {}
    for (const [locName, locId] of Object.entries(locations)) {
        let rows = await getRows(filePath, locName);
        rows.forEach((r, index) => {
            for (let k of Object.keys(r)) {
                let v = String(r[k]).trim();
                if (!v) { delete r[k] }
            }
        })
        wDict[locId] = await getWarehouseBin(rows);
        slog.info([`locName: '${locName}'`, 
            `  rows.length: ${rows.length}`, 
            `expected bins: ${rows.filter(r => 
                Object.keys(r).length === 1 && hasKeys(r, idColumn)).length
            }`,
            `received bins: ${Object.keys(wDict[locId]).length}`
        ].join(TAB));
    }
    return wDict;
}

export const LOCATION_ID_DICT = {
    A: 2,
    B: 3,
    C: 4
}

const BIN_OR_ITEM_ID_COLUMN = 'Item #';
const DESC_COLUMN = 'Description';
const LOT_COLUMN = 'Lot/Serial Number';

export async function getWarehouseBin(
    rows: Record<string, any>[],
    idColumn: string=BIN_OR_ITEM_ID_COLUMN,
    descriptionColumn: string=DESC_COLUMN,
    lotColumn: string=LOT_COLUMN
): Promise<WarehouseBin> {
    const source = `[misc.getBinDictionary()]`
    if (!isNonEmptyArray(rows)) {
        mlog.error(`${source} Invalid Argument: 'rows' Record<string, any>[]`)
        return {}
    }
    let currentBinId: string = (
        await itemIdExtractor(String(rows[0][idColumn]))
    ).replace(/N\/A/, '').trim();
    if (!currentBinId) {
        mlog.error(`${source} Unable to start process - first row is missing idColumn value`)
        return {}
    }
    const binDict: WarehouseBin = { [currentBinId]: {} };
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!hasKeys(row, idColumn)) { continue }
        let idValue = (await itemIdExtractor(String(row[idColumn])))
            .replace(/N\/A/, '').trim();
        if (!idValue) { continue }
        let isNewBinNumber = (Object.keys(row).length === 1 
            && hasKeys(row, idColumn)
            && !hasKeys(binDict, idValue)
        );
        if (isNewBinNumber) {
            binDict[idValue] = {};
            currentBinId = idValue;
            continue;
        } // else idValue corresponds to itemId as key in BinContent dict[binNumber]
        const oneOrTwoDigitPattern = /\d{1,2}/;
        if (oneOrTwoDigitPattern.test(idValue)) {
            idValue = idValue.padStart(3, '0');
        }
        let desc = String(row[descriptionColumn]).trim();
        let lotNumber = String(row[lotColumn]).replace(/N\/A/i, '').trim();
        if (!hasKeys(binDict[currentBinId], idValue)) {
            binDict[currentBinId][idValue] = {
                description: '',
                lotNumbers: []
            };
        }
        if (isNonEmptyString(lotNumber) 
            && !binDict[currentBinId][idValue].lotNumbers.includes(lotNumber)) {
            binDict[currentBinId][idValue].lotNumbers.push(lotNumber);
        }
        if (isNonEmptyString(desc) 
            && !binDict[currentBinId][idValue].description) {
            binDict[currentBinId][idValue].description = desc;
        }
    }
    return binDict as WarehouseBin;
}


export const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}