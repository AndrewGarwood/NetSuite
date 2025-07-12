/**
 * @file src/transactionProcessor.ts
 */
import path from 'node:path';
import * as fs from 'fs';
import {
    writeObjectToJson as write,
    getCsvRows, getOneToOneDictionary,
    ValidatedParseResults,
    ProcessParseResultsOptions, ParseOptions, ParseResults,
    getCurrentPacificTime, 
    indentedStringify, clearFile,
} from "./utils/io";
import { 
    STOP_RUNNING, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS, DEBUG_LOGS, 
    ERROR_DIR,
    CLOUD_LOG_DIR
} from "./config";
import { 
    EntityRecordTypeEnum, RecordOptions, RecordRequest, RecordResponse, 
    RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload,
    GetRecordRequest, getRecordById, GetRecordResponse,
    RecordTypeEnum,
    FieldDictionary,
    idSearchOptions,
    SearchOperatorEnum,
    FieldValue, 
} from "./utils/api";
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { 
    isNonEmptyArray, anyNull, isNullLike as isNull, isEmptyArray, hasKeys, 
    TypeOfEnum, isRecordOptions, isNonEmptyString, isRecordResponseOptions
} from './utils/typeValidation';
import { isValidCsv } from './utils/io/reading';
import * as validate from './utils/argumentValidation';

/** 
 * `responseFields`: `[
 * 'tranid', 'trandate', 'entity', 'externalid', 
 * 'otherrefnum', 'orderstatus'
 * ]` 
 * */
export const SO_RESPONSE_OPTIONS: RecordResponseOptions = {
    responseFields: [
        'tranid', 'trandate', 'entity', 'externalid', 'otherrefnum', 
        'orderstatus'
    ]
};

/**
 * @enum {string} **`TransactionProcessorStageEnum`**
 * @property **`PARSE`** = `'PARSE'`
 * @property **`VALIDATE`** = `'VALIDATE'`
 * @property **`MATCH_ENTITY`** = `'MATCH_ENTITY'`
 * @property **`PUT_SALES_ORDERS`** = `'PUT_SALES_ORDERS'`
 */
export enum TransactionProcessorStageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    MATCH_ENTITY = 'MATCH_ENTITY',
    PUT_SALES_ORDERS = 'PUT_SALES_ORDERS',
}

export enum MatchSourceEnum {
    API = 'API',
    LOCAL = 'LOCAL',
}

export type TransactionEntityMatchOptions = {
    entityType: EntityRecordTypeEnum | string,
    entityFieldId: string,
    matchMethod: MatchSourceEnum
    localFileOptions?: LocalFileMatchOptions 
}

export type LocalFileMatchOptions = {
    filePath: string;
    entityIdColumn: string;
    internalIdColumn: string;
}

export type TransactionProcessorOptions = {
    parseOptions: ParseOptions,
    postProcessingOptions: ProcessParseResultsOptions,
    /** {@link TransactionEntityMatchOptions} */
    matchOptions?: TransactionEntityMatchOptions,
    /** responseOptions for the transaction put request */
    responseOptions?: RecordResponseOptions,
    clearLogFiles?: string[],
    /**
     * if outputDir is a valid directory, 
     * entityProcessor will write output to files here. 
     * */
    outputDir?: string,
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: TransactionProcessorStageEnum,
}
/**
 * @param options 
 * @param fileName 
 * @param stage 
 * @param stageData 
 * @returns **`boolean`**
 */
async function done(
    options: TransactionProcessorOptions, 
    fileName: string,
    stage: TransactionProcessorStageEnum,
    stageData: Record<string, any>,
): Promise<boolean> {
    const { stopAfter, outputDir } = options;
    if (outputDir && fs.existsSync(outputDir)) {
        const now = new Date();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const outputPath = path.join(outputDir, `(${MM}-${DD})-(${HH}-${mm})_${fileName}_${stage}.json`);
        write(stageData, outputPath);
    }
    if (stopAfter && stopAfter === stage) {
        mlog.info(`[END processEntityFiles()] - done(options...) returned true`,
            TAB+`fileName: '${fileName}'`,
            TAB+`   stage: '${stage}'`,
            outputDir 
                ? TAB+`saved to: '`+path.join(outputDir, `${fileName}_${stage}.json`)+`'` 
                : '',
        );
        return true;
    }
    return false;
}

/**
 * @param transactionType {@link RecordTypeEnum} 
 * @param filePaths `string | string[]`
 * @param options {@link TransactionProcessorOptions}
 * @returns **`void`**
 */
export async function processTransactionFiles(
    transactionType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: TransactionProcessorOptions
): Promise<void> {
    validate.stringArgument('transactionProcessor.processTransactionFiles', 'transactionType', transactionType);
    validate.objectArgument('transactionProcessor.processTransactionFiles', 'options', options);
    const {
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as TransactionProcessorOptions;
    if (anyNull(parseOptions, postProcessingOptions)) {
        throw new Error(`[transactionProcessor.processTransactionFiles()] Invalid ProcessorOptions`
            +`(missing parseOptions or postProcessingOptions).`
        );
    }
    if (isNonEmptyArray(clearLogFiles)) clearFile(...clearLogFiles);
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    validate.arrayArgument('processTransactionFiles', 'filePaths', filePaths, TypeOfEnum.STRING, isNonEmptyString);
    // mlog.info(`[START processTransactionFiles()]`);
    for (let i = 0; i < filePaths.length; i++) {
        const csvFilePath = filePaths[i];
        let fileName = path.basename(csvFilePath);
        const parseResults: ParseResults = await parseRecordCsv(
            csvFilePath, parseOptions
        );
        if (await done(options, fileName, TransactionProcessorStageEnum.PARSE, parseResults)) return;
        
        const validatedResults: ValidatedParseResults = await processParseResults(
            parseResults, postProcessingOptions
        );
        if (await done(options, fileName, TransactionProcessorStageEnum.VALIDATE, validatedResults)) return
        if (!options.matchOptions) {
            mlog.warn(`[transactionProcessor.processTransactionFiles()] Aborting Process.`,
                TAB+`No matchOptions provided && stopAfter stage !== PARSE or VALIDATE`,
                TAB+`If want to continue past PARSE or VALIDATE, provide valid matchOptions`,
                TAB+`stopAfter received: '${options.stopAfter}'`,
            );
            return;
        }
        const invalidDict = Object.keys(validatedResults).reduce((acc, key) => {
            acc[key] = validatedResults[key].invalid;
            return acc;
        }, {} as { [recordType: string]: RecordOptions[] });
        write(invalidDict, path.join(CLOUD_LOG_DIR, `${fileName}_invalidOptions.json`));
        const validDict = Object.keys(validatedResults).reduce((acc, key) => {
            acc[key] = validatedResults[key].valid;
            return acc;
        }, {} as { [recordType: string]: RecordOptions[] });

        const validTransactions = Object.values(validDict).flat();
        const matchResults = await matchTransactionsToEntity(
            validTransactions, options.matchOptions
        );
        if (await done(options, fileName, TransactionProcessorStageEnum.MATCH_ENTITY, matchResults)) return;

        if (isEmptyArray(matchResults.matches)) {
            mlog.warn(`[transactionProcessor.processTransactionFiles()] No valid transactions matched to entities.`,
                TAB+`fileName: '${fileName}'`,
                TAB+`   stage: '${TransactionProcessorStageEnum.MATCH_ENTITY}'`,
                TAB+`   continuing to next file...`
            );
            continue;
        }
        if (isNonEmptyArray(matchResults.errors)) {
            mlog.debug(`[transactionProcessor.processTransactionFiles()] Some transactions did not match to entities.`,
                TAB+`  fileName: '${fileName}'`,
                TAB+`     stage: '${TransactionProcessorStageEnum.MATCH_ENTITY}'`,
                TAB+`num errors: ${matchResults.errors.length}`,
            );
            write(matchResults.errors, 
                path.join(CLOUD_LOG_DIR, `${fileName}_matchErrors.json`)
            );
        }
        const transactionResponses = await putTransactions(
            matchResults.matches, responseOptions || SO_RESPONSE_OPTIONS
        );
        if (await done(options, fileName, TransactionProcessorStageEnum.PUT_SALES_ORDERS, transactionResponses)) return;
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
export async function matchTransactionsToEntity(
    transactions: RecordOptions[],
    options: TransactionEntityMatchOptions,
): Promise<{
    matches: RecordOptions[],
    errors: RecordOptions[]
}> {
    try {
        validate.arrayArgument(
            'transactionProcessor.matchTransactionsToEntity', 'transactions', 
            transactions, TypeOfEnum.OBJECT
        );
        validate.objectArgument(
            'transactionProcessor.matchTransactionsToEntity', 'options', options, 
            'TransactionEntityMatchOptions', isTransactionEntityMatchOptions
        );
    } catch(e) {
        mlog.error(`[matchTransactionsToEntity()] Invalid parameters`, e);
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
            throw new Error(
                `[matchTransactionsToEntity()] Invalid options.matchMethod:`
                +`'${options.matchMethod}'`
            );
    }
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
    try {
        validate.arrayArgument(
            'transactionProcessor.matchUsingLocalFile', 'transactions', 
            transactions, 'RecordOptions', isRecordOptions
        );
        validate.objectArgument(
            'transactionProcessor.matchUsingLocalFile', 'options', options, 
            'TransactionEntityMatchOptions', isTransactionEntityMatchOptions
        );
    } catch (e) {
        mlog.error(`[matchUsingLocalFile()] Invalid parameters`, e);
        return { matches: [], errors: [] };
    }
    const { entityType, entityFieldId, localFileOptions } = options;
    const { 
        filePath, entityIdColumn, internalIdColumn 
    } = localFileOptions as LocalFileMatchOptions;
    if (!isValidCsv(filePath, [entityIdColumn, internalIdColumn])) {
        throw new Error([
            `[matchTransactionsToEntity.useLocalFile()] Invalid parameter: 'filePath' (isValidCsv returned false)`,
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
            mlog.warn(`[matchTransactionToEntity()] Invalid RecordOptions:`,
                TAB+`entityType: '${entityType}'`,
                TAB+`RecordOptions in transactions has missing or invalid FieldDictionary`,
                TAB+`needed string value for txn.fields['${entityFieldId}']`,
                TAB+`continuing to next transaction...`
            ); 
            result.errors.push(txn);
            continue; 
        }
        const entityValue = String(txn.fields[entityFieldId] as FieldValue).trim();
        if (!entityInternalIdDict[entityValue]) {
            mlog.warn(`[matchTransactionToEntity()] No match found for entity '${entityValue}'`,
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

/**
 * - uses: {@link getRecordById}`(`{@link GetRecordRequest}`)`
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
    try {
        validate.arrayArgument('transactionProcessor.matchUsingApi', 'transactions', transactions, 'RecordOptions', isRecordOptions);
        validate.stringArgument('transactionProcessor.matchUsingApi', 'entityType', entityType);
        validate.stringArgument('transactionProcessor.matchUsingApi', 'entityFieldId', entityFieldId);
    } catch (e) {
        mlog.error(`[matchUsingApi()] Invalid parameters`, e);
        return { matches: [], errors: [] };
    }
    const result: { matches: RecordOptions[], errors: RecordOptions[] } = { 
        matches: [], errors: [] 
    };
    
    for (const txn of transactions) {
        if (!txn.fields || !isNonEmptyString(txn.fields[entityFieldId])) {
            mlog.warn(`[matchTransactionToEntity()] Invalid RecordOptions:`,
                TAB+`RecordOptions in transactions has missing or invalid FieldDictionary`,
                TAB+`needed string value for txn.fields['${entityFieldId}']`,
                TAB+`continuing to next transaction...`
            ); 
            result.errors.push(txn);
            continue; 
        }
        const entityValue = txn.fields[entityFieldId];
        const getReq: GetRecordRequest = {
            recordType: entityType,
            idOptions: [{
                idProp: idPropertyEnum.ENTITY_ID,
                searchOperator: SearchOperatorEnum.TEXT.IS,
                idValue: entityValue as string
            }] as idSearchOptions[]
        }
        const getRes = await getRecordById(getReq) as GetRecordResponse;
        if (!getRes) {
            await handleMatchError(entityValue, getReq, getRes, 
                `getRecordById() returned null or undefined`
            );
            result.errors.push(txn);
            continue; 
        } else if (!getRes.records || !isNonEmptyArray(getRes.records)) {
            await handleMatchError(entityValue, getReq, getRes, 
                `getRecordById() response has no records (property is missing or is empty array)`
            );
            result.errors.push(txn);
            continue; 
        }
        txn.fields[entityFieldId] = getRes.records[0].internalid;
        result.matches.push(txn);
    }
    return result
}

async function handleMatchError(
    entityValue: string, 
    request?: any, 
    response?: any, 
    reason?: string
): Promise<void> {
    mlog.error(`[matchUsingApi()] Error matching entity '${entityValue}'`,
        (reason ? TAB + `reason: ${reason}` : ''),
        (request ? TAB+`request object keys: ${JSON.stringify(Object.keys(request))}`:''),
        (response ? TAB+`response: ${indentedStringify(response)}`:''),
    );
    write({entityValue, reason, request, response}, 
        ERROR_DIR, `ERROR_matchUsingApi_${entityValue}.json`
    );
}
/**
 * @param transactions {@link RecordOptions}`[]` 
 * @param responseOptions {@link RecordResponseOptions}
 * @returns **`responses`** {@link RecordResponse}`[]`
 */
async function putTransactions(
    transactions: RecordOptions[],
    responseOptions: RecordResponseOptions = SO_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    try {
        validate.arrayArgument('transactionProcessor.putTransactions', 'transactions', transactions, 'RecordOptions', isRecordOptions);
        validate.objectArgument('transactionProcessor.putTransactions', 'responseOptions', responseOptions, 'RecordResponseOptions', isRecordResponseOptions);
    } catch (e) {
        mlog.error(`[putTransactions()] Invalid parameters`, e);
        return [];
    }
    try {
        const transactionRequest: RecordRequest = {
            recordOptions: transactions,
            responseOptions
        };
        return await upsertRecordPayload(transactionRequest) as RecordResponse[];
    } catch (error) {
        mlog.error(`[putTransactions()] Error putting transactions:`, error);
        write({timestamp: getCurrentPacificTime(), caught: error}, 
            ERROR_DIR, `ERROR_putTransactions.json`
        );
    }
    return [];
}

/**
 * - {@link TransactionEntityMatchOptions}
 * - {@link LocalFileMatchOptions}
 * @param value the value to check
 * @returns **`isTransactionEntityMatchOptions`** `boolean` = `value is TransactionEntityMatchOptions`
 * - `true` if the value is a valid TransactionEntityMatchOptions object
 * - `false` otherwise
 */
export function isTransactionEntityMatchOptions(
    value: any
): value is TransactionEntityMatchOptions {
    return (value 
        && typeof value === 'object'
        && hasKeys(value, 
            ['entityType', 'entityFieldId', 'matchMethod'], true, true
        )
        && Object.values(MatchSourceEnum).includes(value.matchMethod)
        && (!value.localFileOptions 
            || (value.localFileOptions && hasKeys(value.localFileOptions, 
                ['filePath', 'entityIdColumn', 'internalIdColumn'], true, true
            ))
        )
    );
}
