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
} from "./utils/io";
import { 
    STOP_RUNNING, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS, DEBUG_LOGS, 
    indentedStringify, DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, clearFile,
    ERROR_LOG_FILEPATH,
    ERROR_DIR,
    CLOUD_LOG_DIR
} from "./config";
import { 
    EntityRecordTypeEnum, RecordOptions, RecordRequest, RecordResponse, 
    RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload,
    SAMPLE_POST_CUSTOMER_OPTIONS as SAMPLE_CUSTOMER, 
    GetRecordRequest, getRecordById, GetRecordResponse,
    RecordTypeEnum,
    FieldDictionary,
    idSearchOptions,
    SearchOperatorEnum,
    FieldValue, 
} from "./utils/api";
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { isNonEmptyArray, anyNull, isNullLike as isNull, isEmptyArray, isValidCsv, hasKeys } from './utils/typeValidation';
import { ENTITY_RESPONSE_OPTIONS } from './entityProcessor';

export const SO_RESPONSE_OPTIONS: RecordResponseOptions = {
    responseFields: ['tranid', 'trandate', 'entity', 'externalid','otherrefnum', ]
};
const TWO_SECONDS = 2000;

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
    transactionFileName: string;
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
    /** responseOptions for the transaction put request */
    matchOptions: TransactionEntityMatchOptions,
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
function done(
    options: TransactionProcessorOptions, 
    fileName: string,
    stage: TransactionProcessorStageEnum,
    stageData: Record<string, any>,
): boolean {
    const { stopAfter, outputDir } = options;
    if (outputDir && fs.existsSync(outputDir)) {
        const outputPath = path.join(outputDir, `${fileName}_${stage}.json`);
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
    if (!transactionType || !filePaths 
        || (typeof filePaths !== 'string' && !isNonEmptyArray(filePaths))) {
        throw new Error([
            `[processTransactionFiles()]L Invalid parameter(s): 'transactionType', 'filePaths'`,
            `is undefined or invalid.`
        ].join(TAB));
    }
    const {
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as TransactionProcessorOptions;
    if (anyNull(parseOptions, postProcessingOptions)) {
        throw new Error(`[processTransactionFiles()] Invalid ProcessorOptions`
            +`(missing parseOptions or postProcessingOptions).`
        );
    }
    if (isNonEmptyArray(clearLogFiles)) clearFile(...clearLogFiles);
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    mlog.info(`[START processTransactionFiles()]`);
    for (let i = 0; i < filePaths.length; i++) {
        const csvFilePath = filePaths[i];
        let fileName = path.basename(csvFilePath);
        const parseResults: ParseResults = await parseRecordCsv(
            csvFilePath, parseOptions
        );
        if (done(options, fileName, TransactionProcessorStageEnum.PARSE, parseResults)) return;
        
        const validatedResults: ValidatedParseResults = processParseResults(
            parseResults, postProcessingOptions
        );
        if (done(options, fileName, TransactionProcessorStageEnum.VALIDATE, validatedResults)) return;
        
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
        if (done(options, fileName, TransactionProcessorStageEnum.MATCH_ENTITY, matchResults)) return;

        if (isEmptyArray(matchResults.matches)) {
            mlog.warn(`[processTransactionFiles()] No valid transactions matched to entities.`,
                TAB+`fileName: '${fileName}'`,
                TAB+`   stage: '${TransactionProcessorStageEnum.MATCH_ENTITY}'`,
                TAB+`   continuing to next file...`
            );
            continue;
        }
        if (isNonEmptyArray(matchResults.errors)) {
            mlog.debug(`[processTransactionFiles()] Some transactions did not match to entities.`,
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
        if (done(options, fileName, TransactionProcessorStageEnum.PUT_SALES_ORDERS, transactionResponses)) return;
    }
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
    if (!isNonEmptyArray(transactions)) {
        mlog.error(`[matchTransactionsToEntity()] Invalid parameter: 'transactions' (RecordOptions[])`,);
        return { matches: [], errors: [] };
    }
    if (isNull(options) || typeof options !== 'object') {
        mlog.error(`[matchTransactionsToEntity()] Invalid parameter: 'options' (TransactionEntityMatchOptions)`,
            TAB+`Expected: options: TransactionEntityMatchOptions`,
            TAB+`Received: '${typeof options}'`
        );
        return { matches: [], errors: [] };
    }
    if (!options.entityType || typeof options.entityType !== 'string') {
        mlog.error(`[matchTransactionsToEntity()] Invalid parameter: 'entityType'`,
            TAB+`Expected: entityType: EntityRecordTypeEnum (string)`,
        );
        return { matches: [], errors: [] };
    }
    if (!isTransactionEntityMatchOptions(options)) {
        mlog.error(`[matchTransactionsToEntity()] Invalid parameter(s): 'options'`,
            TAB+`Expected: options: TransactionEntityMatchOptions`,
            TAB+`Received: options: '${indentedStringify(options)}'`
        );
        return { matches: [], errors: [] };
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
    const { 
        entityType, entityFieldId, localFileOptions 
    } = options as TransactionEntityMatchOptions;
    if (anyNull(entityType, entityFieldId, localFileOptions) || !isNonEmptyArray(transactions)) {
        throw new Error([
            `[matchTransactionsToEntity.useLocalFile()] Invalid parameter(s): 'entityType', 'entityFieldId', 'localFileOptions'`,
            `Expected: entityType: EntityRecordTypeEnum (string), entityFieldId: string, localFileOptions: LocalFileMatchOptions`,
        ].join(TAB));
    }

    const { 
        filePath, entityIdColumn, internalIdColumn 
    } = localFileOptions as LocalFileMatchOptions;
    if (anyNull(entityFieldId, filePath, entityIdColumn, internalIdColumn, entityType) 
        || typeof entityIdColumn !== 'string' 
        || typeof internalIdColumn !== 'string' 
        || typeof entityType !== 'string'
    ) {
        throw new Error([
            `[matchTransactionsToEntity()] Invalid parameter(s): 'entityIdColumn', 'internalIdColumn'`,
        ].join(TAB));
    }

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
    const entityInternalIdDict = getOneToOneDictionary(
        rows, entityIdColumn, internalIdColumn
    );
    for (const txn of transactions) {
        if (!txn.fields || !txn.fields[entityFieldId] 
            || typeof txn.fields[entityFieldId] !== 'string'
        ) {
            mlog.warn(`[matchTransactionToEntity()] Invalid RecordOptions:`,
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
    if (anyNull(transactions, entityType, entityFieldId) 
        || !isNonEmptyArray(transactions) 
        || typeof entityType !== 'string' || typeof entityFieldId !== 'string'
    ) { 
        throw new Error([
            `[matchTransactionsToEntity.useApi()] Invalid parameter(s): 'transactions', 'entityType', 'entityFieldId'`,
            `Expected: transactions: RecordOptions[], entityType: EntityRecordTypeEnum (string), entityFieldId: string`,
            `Received: '${typeof transactions}', '${entityType}', '${entityFieldId}'`
        ].join(TAB));
    } 
    const result: { matches: RecordOptions[], errors: RecordOptions[] } = { 
        matches: [], errors: [] 
    };
    
    for (const txn of transactions) {
        if (!txn.fields || !txn.fields[entityFieldId] 
            || typeof txn.fields[entityFieldId] !== 'string'
        ) {
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
        if (!getRes || !getRes.record || !getRes.record.internalid) {
            mlog.warn(`[matchTransactionToEntity()] Invalid getRecordById() response:`,
                TAB+`getRecordById() returned no record or no internalid for entity '${entityValue}'`,
                TAB+` request: ${indentedStringify(getReq)}`,
                TAB+`response: ${indentedStringify(getRes)}`,
                TAB+`continuing to next transaction...`
            ); 
            result.errors.push(txn);
            continue; 
        }
        txn.fields[entityFieldId] = getRes.record.internalid;
        result.matches.push(txn);
    }
    return result
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
    if (!isNonEmptyArray(transactions)) {
        mlog.warn(`[putTransactions()] No transactions to put.`);
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
    return (value && typeof value === 'object'
        && hasKeys(value, [
            'entityType', 'entityFieldId', 'transactionFileName', 
            'matchMethod', 'localFileOptions'
        ], true, true)
        && typeof value.transactionFileName === 'string'
        && (value.matchMethod === MatchSourceEnum.API 
            || value.matchMethod === MatchSourceEnum.LOCAL
        )
        && (value.localFileOptions && (
            hasKeys(value.methodOptions, 
                ['filePath', 'entityIdColumn', 'internalIdColumn'], true, true
            )
        ))
    );
}
