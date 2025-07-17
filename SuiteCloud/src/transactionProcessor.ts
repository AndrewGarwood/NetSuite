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
    STOP_RUNNING, DELAY,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    INFO_LOGS, DEBUG_LOGS as DEBUG, SUPPRESSED_LOGS as SUP, 
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
    SetFieldSubrecordOptions, 
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
    END = 'END'
}

export enum MatchSourceEnum {
    API = 'API',
    LOCAL = 'LOCAL',
}

export type TransactionEntityMatchOptions = {
    entityType: EntityRecordTypeEnum | string;
    entityFieldId: string;
    matchMethod: MatchSourceEnum;
    localFileOptions?: LocalFileMatchOptions; 
}

export type LocalFileMatchOptions = {
    filePath: string;
    entityIdColumn: string;
    internalIdColumn: string;
}

export type TransactionProcessorOptions = {
    parseOptions: ParseOptions;
    postProcessingOptions: ProcessParseResultsOptions;
    /** 
     * {@link TransactionEntityMatchOptions} = `{ 
     * entityType: EntityRecordTypeEnum | string; 
     * entityFieldId: string; 
     * matchMethod: MatchSourceEnum; 
     * localFileOptions?: LocalFileMatchOptions; 
     * }` 
     * */
    matchOptions?: TransactionEntityMatchOptions;
    /** `RecordResponseOptions` for the transaction put request */
    responseOptions?: RecordResponseOptions;
    clearLogFiles?: string[];
    /**
     * if `outputDir` is a valid directory, 
     * `entityProcessor` will write output data from stages in `stagesToWrite` here. 
     * */
    outputDir?: string;
    /** specify at which stage(s) that data being processed should be written to `outputDir` */
    stagesToWrite?: TransactionProcessorStageEnum[];
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: TransactionProcessorStageEnum;
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
        mlog.info(`[END processEntityFiles()] - done(options...) returned true`,
            TAB+`fileName: '${fileName}'`,
            TAB+`   stage: '${stage}'`,
        );
        return true;
    }
    return false;
}

/**
 * @param transactionType {@link RecordTypeEnum} 
 * @param filePaths `string | string[]` - csv file(s)
 * @param options {@link TransactionProcessorOptions}
 * @returns **`void`**
 */
export async function processTransactionFiles(
    transactionType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: TransactionProcessorOptions
): Promise<void> {
    validate.stringArgument('transactionProcessor.processTransactionFiles', {transactionType});
    validate.objectArgument('transactionProcessor.processTransactionFiles', {options});
    const {
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as TransactionProcessorOptions;
    if (!parseOptions || !postProcessingOptions) {
        throw new Error(`[processTransactionFiles()] Invalid ProcessorOptions`
            +`(missing parseOptions or postProcessingOptions).`
        );
    }
    if (isNonEmptyArray(clearLogFiles)) clearFile(...clearLogFiles);
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    validate.arrayArgument('processTransactionFiles', 'filePaths', 
        filePaths, TypeOfEnum.STRING, isNonEmptyString
    );
    // mlog.info(`[START processTransactionFiles()]`);
    for (let i = 0; i < filePaths.length; i++) {
        const csvFilePath = filePaths[i];
        let fileName = path.basename(csvFilePath);
        const parseResults: ParseResults = await parseRecordCsv(
            csvFilePath, parseOptions
        );
        if (await done(
            options, fileName, 
            TransactionProcessorStageEnum.PARSE, parseResults
        )) return;
        const validatedResults: ValidatedParseResults = await processParseResults(
            parseResults, postProcessingOptions
        );
        if (await done(
            options, fileName, 
            TransactionProcessorStageEnum.VALIDATE, validatedResults
        )) return;
        if (!options.matchOptions) {
            mlog.warn(`[processTransactionFiles()] Aborting Process.`,
                TAB+`No matchOptions provided && stopAfter stage !== PARSE or VALIDATE`,
                TAB+`If want to continue past PARSE or VALIDATE, provide valid matchOptions`,
                TAB+`stopAfter stage: '${options.stopAfter}'`,
            );
            return;
        }
        const invalidDict = Object.keys(validatedResults).reduce((acc, key) => {
            acc[key] = validatedResults[key].invalid;
            return acc;
        }, {} as { [recordType: string]: RecordOptions[] });
        if (Object.keys(invalidDict).some(recordType => invalidDict[recordType].length > 0)) {
            write(invalidDict, path.join(CLOUD_LOG_DIR, `salesorders`, 
                `${getFileNameTimestamp()}_${fileName}_invalidOptions.json`)
            );
        }
        const validDict = Object.keys(validatedResults).reduce((acc, key) => {
            acc[key] = validatedResults[key].valid;
            return acc;
        }, {} as { [recordType: string]: RecordOptions[] });
        const validTransactions = Object.values(validDict).flat();
        mlog.info(`[processTransactionFiles()] calling matchTransactionsToEntity()...`);
        const matchResults = await matchTransactionsToEntity(
            validTransactions, options.matchOptions
        );
        if (isNonEmptyArray(matchResults.errors)) {
            mlog.debug(`[processTransactionFiles()]`,
                `${matchResults.errors.length} transaction(s) did not match to entities.`,
                TAB+`   current file: '${fileName}'`,
                TAB+`processor stage: '${TransactionProcessorStageEnum.MATCH_ENTITY}'`,
                TAB+` error quotient: (${matchResults.errors.length}/${matchResults.matches.length+matchResults.errors.length})`,
            );
            write(
                {timestamp: getCurrentPacificTime(), errors: matchResults.errors}, 
                path.join(CLOUD_LOG_DIR, `salesorders`, `${getFileNameTimestamp()}_${fileName}_matchErrors.json`)
            );
        }
        if (await done(
            options, fileName, 
            TransactionProcessorStageEnum.MATCH_ENTITY, matchResults
        )) return;
        if (isEmptyArray(matchResults.matches)) {
            mlog.warn(`[processTransactionFiles()]`,
                `No valid transactions matched to entities.`,
                TAB+`fileName: '${fileName}'`,
                TAB+`   stage: '${TransactionProcessorStageEnum.MATCH_ENTITY}'`,
                TAB+`continuing to next file...`
            );
            continue;
        }
        const transactionResponses = await putTransactions(
            matchResults.matches, responseOptions || SO_RESPONSE_OPTIONS
        ) as RecordResponse[];
        let successCount = 0;
        const rejects: RecordOptions[] = [];
        for (const res of transactionResponses) {
            if (isNonEmptyArray(res.rejects)) rejects.push(...res.rejects);
            if (isNonEmptyArray(res.results)) successCount += res.results.length;
        }
        write(
            {rejects}, 
            path.join(CLOUD_LOG_DIR, 'salesorders', 
                `${getFileNameTimestamp()}_${fileName}_putRejects.json`
            )
        );
        /**
         * @TODO sort responses by success and failure, write failures to output
         */
        if (await done(
            options, fileName, 
            TransactionProcessorStageEnum.PUT_SALES_ORDERS, 
            {successCount, failureCount: rejects.length}// transactionResponses
        )) return;
    }
    return;
}

/**
 * @TODO could also use getRecordById(recordType === contct) for contact.company text is entityValue... 
 * - then getRecordById(recordType===customer, contact.company??
 * 
 * - or could make a function "generateCustomerFromOrder" and make a new customer record... 
 * - - would have to transform so fields to corresponding customer fields...
 * - > but then have to handle any duplicates bc maybe the customer already exists with a
 * slightly different name
 * 
 *  */

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
    } catch (error) {
        mlog.error(`[matchUsingLocalFile()] Invalid parameters`, (error as any));
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
    const entityHistory: { [entityId: string]: number } = {}
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
        if (typeof entityHistory[entityValue] === 'number') {
            txn.fields[entityFieldId] = entityHistory[entityValue];
            result.matches.push(txn);
            continue;
        }
        const getReq: GetRecordRequest = {
            recordType: entityType,
            idOptions: generateIdOptions(txn, entityType, entityFieldId)
        }
        const getRes = await getRecordById(getReq) as GetRecordResponse;
        if (!getRes || !isNonEmptyArray(getRes.records)) {
            await handleMatchError(entityValue, getReq, getRes, 
                `getRecordById() Invalid response: undefined or has no records`
            );
            result.errors.push(txn);
        } else {
            txn.fields[entityFieldId] = getRes.records[0].internalid;
            entityHistory[entityValue] = getRes.records[0].internalid;
            result.matches.push(txn);
        }
        await DELAY(1000, null);
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

async function handleMatchError(
    entityValue: string, 
    request?: any, 
    response?: any, 
    reason?: string
): Promise<void> {
    SUP.push(`[matchUsingApi()] Error matching entity '${entityValue}'`,
        (reason ? TAB + `  reason: ${reason}` : ''),
        (request ? TAB+`request object keys: ${JSON.stringify(Object.keys(request))}`:''),
        (response ? TAB+`response: ${indentedStringify(response)}`:''),
    );
    // write({entityValue, reason, request, response}, 
    //     path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_matchUsingApi_${entityValue}.json`)
    // );
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
        validate.arrayArgument(
            'transactionProcessor.putTransactions', 
            'transactions', transactions, 'RecordOptions', isRecordOptions
        );
        validate.objectArgument('transactionProcessor.putTransactions', 'responseOptions', responseOptions, 'RecordResponseOptions', isRecordResponseOptions);
    } catch (error) {
        mlog.error(`[putTransactions()] Invalid parameters`, (error as any));
        return [];
    }
    try {
        const transactionRequest: RecordRequest = {
            recordOptions: transactions,
            responseOptions
        };
        return await upsertRecordPayload(transactionRequest) as RecordResponse[];
    } catch (error) {
        mlog.error(`[putTransactions()] Error putting transactions:`, (error as any));
        write({timestamp: getCurrentPacificTime(), caught: (error as any)}, 
            path.join(ERROR_DIR, `ERROR_putTransactions.json`)
        );
    }
    return [];
}

/**
 * - {@link TransactionEntityMatchOptions}
 * - {@link LocalFileMatchOptions}
 * @param value the value to check
 * @returns **`isTransactionEntityMatchOptions`** `boolean` = `value is TransactionEntityMatchOptions`
 * - `true` `if` the value is a valid `TransactionEntityMatchOptions` object
 * - `false` `otherwise`
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
/**
 * @returns **`timestamp`** `string` = `(${MM}-${DD})-(${HH}-${mm}.${ss}.${ms})`
 */
function getFileNameTimestamp(): string {
    const now = new Date();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `(${MM}-${DD})-(${HH}-${mm}.${ss}.${ms})`
}

function encodeExternalId(externalId: string): string {
    return externalId.replace(/</, '&lt;').replace(/>/, '&gt;')
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
