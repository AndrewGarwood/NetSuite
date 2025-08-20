/**
 * @file src/TransactionPipeline.ts
 */
import path from "node:path";
import * as fs from "node:fs";
import {
    readJsonFileAsObject as read,
    writeObjectToJsonSync as write,
    getCsvRows, getOneToOneDictionary,
    getCurrentPacificTime, 
    indentedStringify, clearFileSync,
    getFileNameTimestamp,
    clearFile,
    isRowSourceMetaData,
} from "typeshi:utils/io";
import { 
    STOP_RUNNING, DELAY,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    SUPPRESSED_LOGS as SUP, 
    ERROR_DIR,
    CLOUD_LOG_DIR,
    simpleLogger as slog, apiLogger as alog
} from "../config";
import { 
    RecordOptions, RecordRequest, RecordResponse, 
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
} from "../api";
import { 
    processParseResults, getCompositeDictionaries 
} from "src/services/post_process/parseResultsProcessor";
import { 
    isNonEmptyArray, isNullLike as isNull, isEmptyArray, hasKeys, 
    TypeOfEnum, isNonEmptyString, isIntegerArray,
} from "typeshi:utils/typeValidation";
import { getColumnValues, getRows, isValidCsvSync, isFile, isDirectory } from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import { EntityRecordTypeEnum, RecordTypeEnum, SearchOperatorEnum } from "../utils/ns/Enums";
import { entityId } from "../parse_configurations/evaluators";
import { SalesOrderColumnEnum } from "../parse_configurations/salesorder/salesOrderConstants";
import { SO_CUSTOMER_PARSE_OPTIONS, SO_CUSTOMER_POST_PROCESSING_OPTIONS } from "../parse_configurations/salesorder/salesOrderParseDefinition";
import { putEntities } from "./EntityPipeline";
import { isTransactionEntityMatchOptions, LocalFileMatchOptions, MatchErrorDetails, MatchSourceEnum, TransactionEntityMatchOptions, TransactionMainPipelineOptions, TransactionMainPipelineStageEnum } from "./types";
import { encodeExternalId } from "../utils/ns/utils";
import { parseRecordCsv } from "src/services/parse/csvParser";
import { 
    ParseDictionary, ParseResults, ValidatedParseResults 
} from "src/services/parse/types/index";
import { PostProcessDictionary } from "src/services/post_process/types/PostProcessing";
import { DEFAULT_SALES_ORDER_RESPONSE_OPTIONS } from "./TransactionConfig";


/**
 * @param options 
 * @param fileName 
 * @param stage 
 * @param stageData 
 * @returns **`boolean`**
 */
async function done(
    options: TransactionMainPipelineOptions, 
    fileName: string,
    stage: TransactionMainPipelineStageEnum,
    stageData: Record<string, any>,
): Promise<boolean> {
    const source = `[TransactionPipeline.done()]`
    let stagesToWrite = (isNonEmptyArray(options.stagesToWrite) 
        ? options.stagesToWrite
        : []
    );
    const { stopAfter, outputDir } = options;
    fileName = fileName.trim().replace(/(\.([a-z]+))$/i, '');
    if (isDirectory(outputDir) && stagesToWrite.includes(stage)) {
        const outputPath = path.join(
            outputDir, `${getFileNameTimestamp()}_${fileName}_${stage}.json`
        );
        write(stageData, outputPath);
    }
    if (stopAfter && stopAfter === stage) {
        mlog.info([
            `${source} END - done(options...) returned true`,
            `fileName: '${fileName}'`,
            `   stage: '${stage}'`,
        ].join(TAB));
        return true;
    }
    return false;
}

/**
 * @param transactionType {@link RecordTypeEnum} 
 * @param filePaths `string | string[]` - csv file(s)
 * @param options {@link TransactionMainPipelineOptions}
 * @returns **`void`**
 */
export async function runMainTransactionPipeline(
    transactionType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: TransactionMainPipelineOptions
): Promise<void> {
    const source = `[TransactionPipeline.runMainTransactionPipeline()]`;
    validate.enumArgument(source, {transactionType, RecordTypeEnum})
    validate.objectArgument(source, {options});
    const {
        clearLogFiles, outputDir, parseOptions, postProcessingOptions, responseOptions 
    } = options as TransactionMainPipelineOptions;
    if (!parseOptions) {
        throw new Error([`${source} Invalid TransactionMainPipelineOptions`,
            `(missing parseOptions)`,
        ].join(TAB));
    }
    if (isNonEmptyArray(clearLogFiles)) await clearFile(...clearLogFiles);
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    validate.arrayArgument(source, {filePaths, isFilePath: isFile});
    const processedFiles: string[] = [];
    for (let i = 0; i < filePaths.length; i++) {
        const csvPath = filePaths[i];
        let fileName = path.basename(csvPath);
        slog.debug([`${source} START pipeline for filePath ${i+1}/${filePaths.length}`,
            `fileName: '${fileName}'`
        ].join(TAB));
        // ====================================================================
        // TransactionMainPipelineStageEnum.PARSE
        // ====================================================================
        const parseResults: ParseResults = await parseRecordCsv(
            csvPath, parseOptions, SourceTypeEnum.LOCAL_FILE
        );
        if (await done(options, 
            fileName, TransactionMainPipelineStageEnum.PARSE, parseResults
        )) break;
        
        // ====================================================================
        // TransactionMainPipelineStageEnum.VALIDATE
        // ====================================================================
        const validatedResults = await processParseResults(
            parseResults, postProcessingOptions
        ) as ValidatedParseResults;
        if (await done(options, 
            fileName, TransactionMainPipelineStageEnum.VALIDATE, validatedResults
        )) break;
        if (!options.matchOptions) {
            mlog.warn([`${source} Aborting Process.`,
                `No matchOptions provided && stopAfter stage !== PARSE or VALIDATE`,
                `If want to continue past PARSE or VALIDATE, provide valid matchOptions`,
                `stopAfter stage: '${options.stopAfter}'`,
            ].join(TAB));
            return;
        }
        const { validDict, invalidDict } = getCompositeDictionaries(validatedResults);
        const invalidTransactions = Object.values(invalidDict).flat();
        if (invalidTransactions.length > 0) {
            write(invalidDict, path.join(outputDir, 
                `${getFileNameTimestamp()}_${fileName}_invalidOptions.json`)
            );
        }
        const validTransactions = Object.values(validDict).flat();
        slog.info(`${source} calling matchTransactionEntity()...`);
        // ====================================================================
        // TransactionMainPipelineStageEnum.MATCH_ENTITIES
        // ====================================================================
        const matchResults = await matchTransactionEntity(
            validTransactions, options.matchOptions
        ) as { matches: RecordOptions[]; errors: RecordOptions[]; };
        let resolvedTransactions: RecordOptions[] = [];
        if (isNonEmptyArray(matchResults.errors)) {
            mlog.debug([`${source}`,
                `${matchResults.errors.length} transaction(s) did not have a matching ${options.matchOptions.entityType}.`,
                `  current file: '${fileName}'`,
                `pipeline stage: '${TransactionMainPipelineStageEnum.MATCH_ENTITY}'`,
                `error quotient: (${matchResults.errors.length}/${matchResults.matches.length+matchResults.errors.length})`,
            ].join(TAB));
            if (options.generateMissingEntities === true) {
                resolvedTransactions.push(...await resolveUnmatchedTransactions(
                    csvPath, matchResults.errors, 
                    options.matchOptions.entityType as EntityRecordTypeEnum
                ));
                slog.debug([`back in pipeline func after calling resolveUnmatched func...`,
                    ` matchResults.errors.length: ${matchResults.errors.length}`,
                    `resolvedTransactions.length: ${resolvedTransactions.length}`
                ].join(TAB));
            } else {
                write(
                    {
                        timestamp: getCurrentPacificTime(),
                        sourceFile: csvPath,
                        numMatchErrors: matchResults.errors.length, 
                        errors: matchResults.errors
                    } as MatchErrorDetails, 
                    path.join(outputDir, `${getFileNameTimestamp()}_${fileName}_matchErrors.json`)
                );
            }
        }
        if (await done(options, 
            fileName, TransactionMainPipelineStageEnum.MATCH_ENTITY, matchResults
        )) break;
        if (isEmptyArray(matchResults.matches)) {
            mlog.warn([`${source} No valid transactions matched to entities.`,
                `fileName: '${fileName}'`,
                `   stage: '${TransactionMainPipelineStageEnum.MATCH_ENTITY}'`,
                `continuing to next file...`
            ].join(TAB));
            if (isEmptyArray(resolvedTransactions)) continue;
        }
        // ====================================================================
        // TransactionMainPipelineStageEnum.PUT_TRANSACTIONS
        // ====================================================================
        let payload = resolvedTransactions.concat(matchResults.matches);
        slog.info([`${source} finished MATCH_ENTITIES, starting PUT_TRANSACTIONS`,
            `    num transactions parsed: ${Object.values(parseResults).flat().length}`,
            `  valid transactions length: ${validTransactions.length}`,
            `invalid transactions length: ${invalidTransactions.length}`,
            `matchResults.matches.length: ${matchResults.matches.length}`,
            ` matchResults.errors.length: ${matchResults.errors.length}`,
            `resolvedTransactions.length: ${resolvedTransactions.length}`,        
        ].join(TAB), 
            NL+` -> final payload length: ${payload.length}`
        );
        const transactionResponses = await putTransactions(
            payload, responseOptions || DEFAULT_SALES_ORDER_RESPONSE_OPTIONS
        ) as RecordResponse[];
        slog.info(`Back in pipeline loop after putTransactions()`);
        await DELAY(1000);
        const rejectResponses: RecordResponse[] = [];
        let successCount = 0;
        let numRejects = 0;
        for (const res of transactionResponses) {
            if (isNonEmptyArray(res.rejects)) {
                slog.info(`storing rejected responses...`);
                numRejects += res.rejects.length;
                rejectResponses.push({
                    status: res.status,
                    message: res.message,
                    error: res.error,
                    rejects: res.rejects,
                    logs: res.logs.filter(l => l.type === LogTypeEnum.ERROR)
                } as RecordResponse)
            }
            if (isNonEmptyArray(res.results)) successCount += res.results.length;
        }
        if (numRejects === 0) {
            processedFiles.push(csvPath)
        } else if (numRejects > 0) {
            slog.debug(`about to call writeObjectToJson(rejectInfo)...`);
            write(
                {
                    timestamp: getCurrentPacificTime(),
                    sourceFile: csvPath,
                    numRejects,
                    rejectResponses,
                }, 
                path.join(outputDir, 
                    `${getFileNameTimestamp()}_${fileName}_putRejects.json`
                )
            );
        }
        slog.debug(`checking if done after PUT_SALES_ORDERS...`)
        if (await done(options, 
            fileName, TransactionMainPipelineStageEnum.PUT_SALES_ORDERS, 
            { sourceFile: csvPath, successCount, failureCount: numRejects}
        )) break;
    }
    slog.info(`${source} Finished pipeline for loop, exiting function.`);
    if (processedFiles.length > 0) {
        slog.info(`${source} processedFiles.length: ${processedFiles.length}`);
        write({processedFiles}, path.join(outputDir, 
            `${getFileNameTimestamp()}_${transactionType}_processedFiles.json`)
        );
    }
    return;
}

/**
 * - {@link matchUsingApi}
 * - {@link matchUsingLocalFile}
 * @param transactions {@link RecordOptions}`[]` - array of transactions to match to entities.
 * @param options {@link TransactionEntityMatchOptions} - options for matching transactions to entities.
 * @returns **`result`** - `{ matches: `{@link RecordOptions}`[], errors: RecordOptions[] }`
 * - **`result.matches`** - the elements from `transactions` that were successfully matched to an entity.
 */
export async function matchTransactionEntity(
    transactions: RecordOptions[],
    options: TransactionEntityMatchOptions,
): Promise<{
    matches: RecordOptions[],
    errors: RecordOptions[]
}> {
    const source = `[TransactionPipeline.matchTransactionEntity()]`;
    try {
        validate.arrayArgument(source, {transactions, isRecordOptions});
        validate.objectArgument(source, {options, isTransactionEntityMatchOptions});
    } catch (e) {
        mlog.error(`${source} Invalid parameters`, e);
        return { matches: [], errors: [] }
    }
    switch (options.matchMethod) {
        case MatchSourceEnum.API:
            return matchUsingApi(transactions,
                options.entityType as EntityRecordTypeEnum,
                options.entityFieldId
            );
        case MatchSourceEnum.LOCAL:
            return matchUsingLocalFile(transactions, options);
        default: // options.matchMethod not in MatchSourceEnum
            throw new Error(`${source} Invalid options.matchMethod: '${options.matchMethod}'`);
    }
}


/**
 * - uses: {@link getRecordById}`(`{@link SingleRecordRequest}`)`
 * @param transactions {@link RecordOptions}`[]`
 * @param entityType `string`
 * @param entityFieldId `string`
 * @returns **`result`** - `{ matches: `{@link RecordOptions}`[], errors: RecordOptions[] }`
 * - **`result.matches`** - the elements from `transactions` that were successfully matched to an entity.
 */
async function matchUsingApi(
    transactions: RecordOptions[],
    entityType: EntityRecordTypeEnum,
    entityFieldId: string,
): Promise<{
    matches: RecordOptions[],
    errors: RecordOptions[]
}> {
    const source = `[TransactionPipeline.matchUsingApi()]`;
    try {
        validate.arrayArgument(source, {transactions, isRecordOptions});
        validate.multipleStringArguments(source, {entityType, entityFieldId});
    } catch (e) {
        mlog.error(`${source} Invalid parameters`, e);
        return { matches: [], errors: [] };
    }
    const result: { matches: RecordOptions[], errors: RecordOptions[] } = { 
        matches: [], errors: [] 
    };
    const entityHistory: { [entityId: string]: number } = {}
    for (const txn of transactions) {
        if (!txn.fields || !isNonEmptyString(txn.fields[entityFieldId])) {
            mlog.warn([`${source} Invalid RecordOptions:`,
                `RecordOptions in transactions has missing or invalid FieldDictionary`,
                `needed string value for txn.fields['${entityFieldId}']`,
                `continuing to next transaction...`
            ].join(TAB)); 
            result.errors.push(txn);
            continue; 
        }
        const entityValue = txn.fields[entityFieldId];
        if (typeof entityHistory[entityValue] === 'number') {
            txn.fields[entityFieldId] = entityHistory[entityValue];
            result.matches.push(txn);
            continue;
        }
        const getReq: SingleRecordRequest = {
            recordType: entityType,
            idOptions: generateIdOptions(txn, entityType, entityFieldId)
        }
        const getRes = await getRecordById(getReq) as RecordResponse;
        if (!getRes || !isNonEmptyArray(getRes.results)) {
            mlog.error([`${source} Error: getRecordById() returned undefined or has no records`,
                ` entityValue: '${entityValue}'`,
                `get response: `, getRes
            ].join(TAB))
            result.errors.push(txn);
        } else {
            txn.fields[entityFieldId] = getRes.results[0].internalid;
            entityHistory[entityValue] = getRes.results[0].internalid;
            result.matches.push(txn);
        }
        await DELAY(1200, null);
        continue;
    }
    return result
}

/**
 * @param transaction 
 * @param entityType 
 * @param entityFieldId 
 * @returns **`idOptions`** = {@link idSearchOptions}`[]`
 */
function generateIdOptions(
    transaction: RecordOptions,
    entityType: string,
    entityFieldId: string
): idSearchOptions[] {
    if (!transaction.fields) {
        return []
    }
    const entityValue = transaction.fields[entityFieldId] as string;
    const idOptions: idSearchOptions[] = [
        idSearchOptions(idPropertyEnum.ENTITY_ID, entityValue),
        idSearchOptions(idPropertyEnum.EXTERNAL_ID, 
            encodeExternalId(`${entityValue}<${entityType}>`)
        ),
    ];
    for (const addrFieldId of ['billingaddress', 'shippingaddress']) {
        if (!transaction.fields[addrFieldId]) continue;
        const addr = transaction.fields[addrFieldId] as SetFieldSubrecordOptions;
        if (!addr.fields) continue;
        const addressee = addr.fields.addressee as string;
        const attention = addr.fields.attention as string;
        if (addressee) {
            idOptions.push(idSearchOptions(idPropertyEnum.ENTITY_ID, addressee));
            idOptions.push(idSearchOptions(idPropertyEnum.EXTERNAL_ID, 
                encodeExternalId(`${addressee}<${entityType}>`))
            );
        }
        if (attention) {
            idOptions.push(idSearchOptions(idPropertyEnum.ENTITY_ID, attention));
            idOptions.push(idSearchOptions(idPropertyEnum.EXTERNAL_ID, 
                encodeExternalId(`${attention}<${entityType}>`))
            );
        }
    }
    return idOptions;
}

/**
 * @param transactions {@link RecordOptions}`[]` 
 * @param responseOptions {@link RecordResponseOptions}
 * @returns **`responses`** {@link RecordResponse}`[]`
 */
export async function putTransactions(
    transactions: RecordOptions[],
    responseOptions: RecordResponseOptions = DEFAULT_SALES_ORDER_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    const source = `[TransactionPipeline.putTransactions()]`
    slog.info(`${source} START, transactions.length: ${transactions.length}`);
    try {
        validate.arrayArgument(source, {transactions, isRecordOptions});
        validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    } catch (error) {
        mlog.error(`${source} Invalid parameters`, error);
        return [];
    }
    try {
        const transactionRequest: RecordRequest = {
            recordOptions: transactions,
            responseOptions
        };
        const responses = await upsertRecordPayload(transactionRequest) as RecordResponse[];
        slog.info(`${source} END, responses.length: ${responses.length}`);
        return responses;
    } catch (error) {
        mlog.error(`${source} Error putting transactions:`, error);
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `ERROR_putTransactions.json`)
        );
        return [];
    }
}




/**
 * @factory {@link idSearchOptions}
 * @param idProp 
 * @param idValue 
 * @param searchOperator `string` - `Default` = {@link SearchOperatorEnum.TEXT.IS} = `'is'`
 * @returns **`idSearchOptions`** {@link idSearchOptions}
 */
function idSearchOptions(
    idProp: string, 
    idValue: string | number, 
    searchOperator: string = SearchOperatorEnum.TEXT.IS
): idSearchOptions {
    return { idProp, idValue, searchOperator} as idSearchOptions
}

/**
 * @TODO have the creation of entities be handled by invoking EntityPipeline instead of doing it here
 * - this is ineffecient and could likely be improved by having better way to retrieve source rows.
 * - GroupedParser might help if I ever have time to finish it
 * - still testing, so there are some unnecessary actions/variables used just for debugging
 * @TODO export customers and can run equivalentAlphanumeric pairwise on entity id from transactions
 * ... slow, but might get the job done...
 */
export async function resolveUnmatchedTransactions(
    filePath: string,
    transactions: RecordOptions[],
    entityType: EntityRecordTypeEnum = EntityRecordTypeEnum.CUSTOMER
): Promise<any> {
    const source = `[TransactionPipeline.resolveUnmatchedTransactions()]`
    validate.stringArgument(source, {entityType});
    validate.arrayArgument(source, {transactions, isRecordOptions});
    /** */
    const sourceRows = await getRows(filePath);
    let targetRowIndices: number[] = [];
    const targetRows: Record<string, any>[] = [];
    let missingEntities: Set<string> = new Set([]);
    let entDict: Record<string, RecordOptions[]> = {}
    for (const txn of transactions) {
        if (!txn.fields || !isNonEmptyString(txn.fields.entity)) { continue }
        const ent = txn.fields.entity;
        missingEntities.add(ent);
        if (!entDict[ent]) {
            entDict[ent] = [txn]
        } else {
            entDict[ent].push(txn)
        }
        
        if (!txn.meta) {
            throw new Error(`${source} ayo where da meta at`)
        }
        if (isRowSourceMetaData(txn.meta.dataSource)) {
            if (!txn.meta.dataSource[filePath]) {
                throw new Error(`${source} yo da filePath from TransactionPipeline should've been added as a sourceData after running csvParser`)
            }
            targetRowIndices.push(...txn.meta.dataSource[filePath])
        } else if (isIntegerArray(txn.meta.dataSource)
            && txn.meta.sourceType === SourceTypeEnum.ROW_ARRAY) {
            targetRowIndices.push(...txn.meta.dataSource)
        }
    }
    for (let index of Array.from(new Set(targetRowIndices))) {
        targetRows.push(sourceRows[index])
    }
    let numEntsFromExtraction = (await getColumnValues(
        targetRows, SalesOrderColumnEnum.ENTITY_ID)
    ).length;
    let diff = Math.abs(missingEntities.size - numEntsFromExtraction);
    mlog.debug([`${source} Sanity Check 1`,
        `number of entities from transactions: ${missingEntities.size}`,
        `  number of entities from targetRows: ${numEntsFromExtraction}`,
        `abs diff = ${diff}`
    ].join(TAB));
    if (diff !== 0) {
        mlog.error(`ayo the diff should be 0`)
    }
    const parseResults: ParseResults = await parseRecordCsv(
        targetRows, { [entityType]: SO_CUSTOMER_PARSE_OPTIONS } as ParseDictionary
    );
    const validatedResults = await processParseResults(
        parseResults, 
        { [entityType]: SO_CUSTOMER_POST_PROCESSING_OPTIONS } as PostProcessDictionary
    ) as ValidatedParseResults;
    if (isNonEmptyArray(validatedResults[entityType].invalid)) {
        throw new Error([`${source} invalid customer RecordOptions....`,
            `invalid.length: ${validatedResults[entityType].invalid.length}`,
            `check salesOrderParseDefinition and prune functions...`
        ].join(TAB))
    }
    const entities: RecordOptions[] = validatedResults[entityType].valid;
    slog.debug([`${source} Sanity Check 2`,
        `number of entities from transactions: ${missingEntities.size}`,
        `  number of entities from targetRows: ${numEntsFromExtraction}`,
        `number of entities in validatedParse: ${validatedResults[entityType].valid.length}`
    ].join(TAB))
    if (missingEntities.size !== validatedResults[entityType].valid.length) {
        mlog.error(`bad news mate, something's off with the amount of entities.`)
    }

    const resolved: RecordOptions[] = [];
    const unresolved: RecordOptions[] = [];
    const entityRejects: RecordOptions[] = [];
    const responseOptions: RecordResponseOptions = {
        fields: ['entityid', 'externalid', 'isperson', 'companyname', 'email'],
    }
    const entityResponses = await putEntities(entities, responseOptions);
    let generatedEntities: Record<string, any> = {};
    for (const res of entityResponses) {
        if (!res.results) { continue };
        for (const r of res.results) {
            if (!r.fields || !isNonEmptyString(r.fields.entityid)) { continue }
            let ent = r.fields.entityid
            if (/^\d{4,} .+/.test(ent)) { // if they put the number id in front of entity text
                ent = ent.split(' ')[1];
            }
            generatedEntities[ent] = r.internalid;  
        }
        if (isNonEmptyArray(res.rejects)) entityRejects.push(...res.rejects)
    }
    if (isNonEmptyArray(entityRejects)) {
        mlog.error([`${source}`,
            `There were some rejects when putting entities:`,
            `   num rejects: ${entityRejects.length}`,
        ].join(TAB));
        write({entityRejects, timestamp: getCurrentPacificTime()},
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_resolveUnmatchedTransactions_entityRejects.json`)
        );
    }
    slog.debug([`${source} Sanity Check 3`,
        `number of entities from transactions: ${missingEntities.size}`,
        `  number of entities from targetRows: ${numEntsFromExtraction}`,
        `   number of entities from responses: ${Object.keys(generatedEntities).length}`,
    ].join(TAB));
    if (!Object.keys(generatedEntities).every(ent => ent in entDict)) {
        mlog.error(`wait a dang minute, some generated ents not in entDict`)
    }
    for (const ent of Object.keys(entDict)) {
        for (const txn of entDict[ent]) {
            txn.fields!.entity = generatedEntities[ent] as number;
        }
        resolved.push(...entDict[ent]);
    }
    return resolved;
}

/**
 * @param transactions {@link RecordOptions}`[]`
 * @param options {@link TransactionEntityMatchOptions}
 * @param options.entityType {@link EntityRecordTypeEnum}
 * @param options.entityFieldId `string`
 * @param options.localFileOptions.filePath `string`
 * @param options.localFileOptions.entityIdColumn `string`
 * @param options.localFileOptions.internalIdColumn `string`
 * @returns **`result`** - `{ matches: `{@link RecordOptions}`[], errors: RecordOptions[] }`
 * - **`result.matches`** - the elements from `transactions` that were successfully matched to an entity.
 */
async function matchUsingLocalFile(
    transactions: RecordOptions[],
    options: TransactionEntityMatchOptions
): Promise<{
    matches: RecordOptions[],
    errors: RecordOptions[]
}> {
    const source = `[TransactionPipeline.matchUsingLocalFile()]`
    try {
        validate.arrayArgument(source, {transactions, isRecordOptions});
        validate.objectArgument(source, {options, isTransactionEntityMatchOptions});
    } catch (error) {
        mlog.error(`${source} Invalid parameters`, (error as any));
        return { matches: [], errors: [] };
    }
    const { entityType, entityFieldId, localFileOptions } = options;
    const { 
        filePath, targetValueColumn: entityIdColumn, internalIdColumn 
    } = localFileOptions as LocalFileMatchOptions;
    if (!isValidCsvSync(filePath, [entityIdColumn, internalIdColumn])) {
        throw new Error([
            `${source} Invalid parameter: 'filePath' (isValidCsv returned false)`,
            `Expected: string representing path to valid csv file containing columns: '${entityIdColumn}', '${internalIdColumn}'`,
        ].join(TAB));
    }
    const result: { matches: RecordOptions[], errors: RecordOptions[] } = { 
        matches: [], errors: [] 
    };
    const rows = await getCsvRows(filePath);
    const entityInternalIdDict = await getOneToOneDictionary(
        rows, entityIdColumn, internalIdColumn
    );
    for (const txn of transactions) {
        if (!txn.fields || !isNonEmptyString(txn.fields[entityFieldId])) {
            mlog.warn([`${source} Invalid RecordOptions:`,
                `entityType: '${entityType}'`,
                `RecordOptions in transactions has missing or invalid FieldDictionary`,
                `needed string value for txn.fields['${entityFieldId}']`,
                `continuing to next transaction...`
            ].join(TAB)); 
            result.errors.push(txn);
            continue; 
        }
        const entityValue = String(txn.fields[entityFieldId] as FieldValue).trim();
        if (!entityInternalIdDict[entityValue]) {
            mlog.warn(`${source} No match found for entity '${entityValue}'`,
                TAB+`continuing to next transaction...`
            ); 
            result.errors.push(txn);
            continue;
        }
        txn.fields[entityFieldId] = entityInternalIdDict[entityValue];
        result.matches.push(txn);
    }
    return result;
}
