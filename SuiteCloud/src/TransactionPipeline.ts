/**
 * @file src/TransactionPipeline.ts
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
    getFileNameTimestamp,
} from "./utils/io";
import { 
    STOP_RUNNING, DELAY,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    INFO_LOGS, DEBUG_LOGS as DEBUG, SUPPRESSED_LOGS as SUP, 
    ERROR_DIR,
    CLOUD_LOG_DIR
} from "./config";
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
} from "./api";
import { parseRecordCsv } from "./csvParser";
import { processParseResults, getValidatedDictionaries } from "./parseResultsProcessor";
import { 
    isNonEmptyArray, anyNull, isNullLike as isNull, isEmptyArray, hasKeys, 
    TypeOfEnum, isNonEmptyString, isIntegerArray,
} from './utils/typeValidation';
import { getColumnValues, getRows, isValidCsv } from './utils/io/reading';
import * as validate from './utils/argumentValidation';
import { EntityRecordTypeEnum, RecordTypeEnum, SearchOperatorEnum } from './utils/ns/Enums';
import { extractTargetRows } from './DataReconciler';
import { entityId } from './parse_configurations/evaluators';
import { SalesOrderColumnEnum } from './parse_configurations/salesorder/salesOrderConstants';
import { SO_CUSTOMER_PARSE_OPTIONS, SO_CUSTOMER_POST_PROCESSING_OPTIONS } from './parse_configurations/salesorder/salesOrderParseDefinition';
import { putEntities } from './EntityPipeline';
import { isRecordOptions, isRecordResponseOptions, isRowSourceMetaData } from './utils/typeGuards';
import { RowSourceMetaData } from './utils/io';
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
 * @property **`END`** = `'END'`
 */
export enum TransactionPipelineStageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    /** use this as value for `stopAfter` to see output of `matchTransactionEntity()` */
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

export type TransactionPipelineOptions = {
    parseOptions: ParseOptions;
    postProcessingOptions?: ProcessParseResultsOptions;
    /** 
     * {@link TransactionEntityMatchOptions} = `{ 
     * entityType: EntityRecordTypeEnum | string; entityFieldId: string; 
     * matchMethod: MatchSourceEnum; localFileOptions?: LocalFileMatchOptions; }` 
     * */
    matchOptions?: TransactionEntityMatchOptions;
    generateMissingEntities?: boolean;
    /** `RecordResponseOptions` for the transaction put request */
    responseOptions?: RecordResponseOptions;
    clearLogFiles?: string[];
    /**
     * if `outputDir` is a valid directory, 
     * `entityProcessor` will write output data from stages in `stagesToWrite` here. 
     * */
    outputDir?: string;
    /** specify at which stage(s) that data being processed should be written to `outputDir` */
    stagesToWrite?: TransactionPipelineStageEnum[];
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: TransactionPipelineStageEnum;
}

type MatchErrorDetails = {
    timestamp: string;
    sourceFile: string;
    numMatchErrors: number; 
    errors: RecordOptions[];
}



/**
 * @param options 
 * @param fileName 
 * @param stage 
 * @param stageData 
 * @returns **`boolean`**
 */
async function done(
    options: TransactionPipelineOptions, 
    fileName: string,
    stage: TransactionPipelineStageEnum,
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
            `[END runTransactionPipeline()] - done(options...) returned true`,
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
 * @param options {@link TransactionPipelineOptions}
 * @returns **`void`**
 */
export async function runTransactionPipeline(
    transactionType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: TransactionPipelineOptions
): Promise<void> {
    validate.stringArgument(`${__filename}.runTransactionPipeline`, {transactionType});
    validate.objectArgument(`${__filename}.runTransactionPipeline`, {options});
    const {
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as TransactionPipelineOptions;
    if (!parseOptions) {
        throw new Error([`[runTransactionPipeline()] Invalid TransactionPipelineOptions`,
            `(missing parseOptions)`,
        ].join(TAB));
    }
    if (isNonEmptyArray(clearLogFiles)) clearFile(...clearLogFiles);
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    validate.arrayArgument('runTransactionPipeline', {filePaths}, 
        TypeOfEnum.STRING, isNonEmptyString
    );
    // mlog.info(`[START runTransactionPipeline()]`);
    for (let i = 0; i < filePaths.length; i++) {
        const csvPath = filePaths[i];
        let fileName = path.basename(csvPath);
        // ====================================================================
        // TransactionPipelineStageEnum.PARSE
        // ====================================================================
        const parseResults: ParseResults = await parseRecordCsv(
            csvPath, parseOptions, SourceTypeEnum.LOCAL_FILE
        );
        if (await done(
            options, fileName, TransactionPipelineStageEnum.PARSE, parseResults
        )) return;
        
        // ====================================================================
        // TransactionPipelineStageEnum.VALIDATE
        // ====================================================================
        const validatedResults = await processParseResults(
            parseResults, postProcessingOptions
        ) as ValidatedParseResults;
        if (await done(
            options, fileName, TransactionPipelineStageEnum.VALIDATE, validatedResults
        )) return;
        if (!options.matchOptions) {
            mlog.warn(`[runTransactionPipeline()] Aborting Process.`,
                TAB+`No matchOptions provided && stopAfter stage !== PARSE or VALIDATE`,
                TAB+`If want to continue past PARSE or VALIDATE, provide valid matchOptions`,
                TAB+`stopAfter stage: '${options.stopAfter}'`,
            );
            return;
        }
        const { validDict, invalidDict } = getValidatedDictionaries(validatedResults);
        const invalidTransactions = Object.values(invalidDict).flat();
        if (invalidTransactions.length > 0) {
            write(invalidDict, path.join(CLOUD_LOG_DIR, `salesorders`, 
                `${getFileNameTimestamp()}_${fileName}_invalidOptions.json`)
            );
        }
        const validTransactions = Object.values(validDict).flat();
        mlog.info(`[runTransactionPipeline()] calling matchTransactionEntity()...`);
        // ====================================================================
        // TransactionPipelineStageEnum.MATCH_ENTITIES
        // ====================================================================
        const matchResults = await matchTransactionEntity(
            validTransactions, options.matchOptions
        ) as { matches: RecordOptions[]; errors: RecordOptions[]; };
        let resolvedTransactions: RecordOptions[] = [];
        if (isNonEmptyArray(matchResults.errors)) {
            mlog.debug([`[runTransactionPipeline()]`,
                `${matchResults.errors.length} transaction(s) did not have a matching ${options.matchOptions.entityType}.`,
                `   current file: '${fileName}'`,
                `processor stage: '${TransactionPipelineStageEnum.MATCH_ENTITY}'`,
                ` error quotient: (${matchResults.errors.length}/${matchResults.matches.length+matchResults.errors.length})`,
            ].join(TAB));
            if (options.generateMissingEntities === true) {
                resolvedTransactions.push(...await resolveUnmatchedTransactions(
                    csvPath, matchResults.errors, 
                    options.matchOptions.entityType as EntityRecordTypeEnum
                ))
                mlog.debug([`back in pipeline func after calling resolveUnmatched func...`,
                    ` matchResults.errors.length: ${matchResults.errors.length}`,
                    `resolvedTransactions.length: ${resolvedTransactions.length}`
                ].join(TAB))
            } else {
                write(
                    {
                        timestamp: getCurrentPacificTime(),
                        sourceFile: csvPath,
                        numMatchErrors: matchResults.errors.length, 
                        errors: matchResults.errors
                    } as MatchErrorDetails, 
                    path.join(CLOUD_LOG_DIR, `salesorders`, `${getFileNameTimestamp()}_${fileName}_matchErrors.json`)
                );
            }
        }
        if (await done(
            options, fileName, 
            TransactionPipelineStageEnum.MATCH_ENTITY, matchResults
        )) return;
        if (isEmptyArray(matchResults.matches)) {
            mlog.warn(`[runTransactionPipeline()]`,
                `No valid transactions matched to entities.`,
                TAB+`fileName: '${fileName}'`,
                TAB+`   stage: '${TransactionPipelineStageEnum.MATCH_ENTITY}'`,
                TAB+`continuing to next file...`
            );
            if (isEmptyArray(resolvedTransactions)) continue;
        }
        // ====================================================================
        // TransactionPipelineStageEnum.PUT_TRANSACTIONS
        // ====================================================================
        let payload = resolvedTransactions.concat(matchResults.matches);
        mlog.info([`[runTransactionPipeline()] finished MATCH_ENTITIES, starting PUT_TRANSACTIONS`,
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
            payload, responseOptions || SO_RESPONSE_OPTIONS
        ) as RecordResponse[];
        let successCount = 0;
        const rejectResponses: any[] = [];
        let numRejects = 0;
        for (const res of transactionResponses) {
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
                path.join(CLOUD_LOG_DIR, 'salesorders', 
                    `${getFileNameTimestamp()}_${fileName}_putRejects.json`
                )
            );
        }
        if (await done(
            options, fileName, 
            TransactionPipelineStageEnum.PUT_SALES_ORDERS, 
            {successCount, failureCount: numRejects}// transactionResponses
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
export async function matchTransactionEntity(
    transactions: RecordOptions[],
    options: TransactionEntityMatchOptions,
): Promise<{
    matches: RecordOptions[],
    errors: RecordOptions[]
}> {
    try {
        validate.arrayArgument(
            `${__filename}.matchTransactionEntity`, {transactions}, 
            'RecordOptions', isRecordOptions
        );
        validate.objectArgument(
            `${__filename}.matchTransactionEntity`, {options}, 
            'TransactionEntityMatchOptions', isTransactionEntityMatchOptions
        );
    } catch(e) {
        mlog.error(`[matchTransactionEntity()] Invalid parameters`, (e as any));
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
                `[matchTransactionEntity()] Invalid options.matchMethod:`
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
            `[matchUsingLocalFile()] Invalid parameter: 'filePath' (isValidCsv returned false)`,
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
            mlog.warn(`[matchUsingLocalFile()] Invalid RecordOptions:`,
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
            mlog.warn(`[matchUsingLocalFile()] No match found for entity '${entityValue}'`,
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
            mlog.warn(`[matchUsingApi()] Invalid RecordOptions:`,
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
            await logMatchError(entityValue, getReq, getRes, 
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

async function logMatchError(
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
export async function putTransactions(
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
            ['entityType', 'entityFieldId', 'matchMethod'], true, false
        )
        && Object.values(MatchSourceEnum).includes(value.matchMethod)
        && (!value.localFileOptions 
            || (value.localFileOptions && hasKeys(value.localFileOptions, 
                ['filePath', 'entityIdColumn', 'internalIdColumn'], true, true
            ))
        )
    );
}




// eventually move this stuff to another file.



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

/**
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
    validate.stringArgument(`${__filename}.resolveUnmatchedTransactions`, 
        {entityType}
    );
    validate.arrayArgument(`${__filename}.resolveUnmatchedTransactions`, 
        {transactions}, 'RecordOptions', isRecordOptions
    );
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
            throw new Error(`[${__filename}.resolveUnmatchedTransactions()] ayo where da meta at`)
        }
        if (isRowSourceMetaData(txn.meta.dataSource)) {
            if (!txn.meta.dataSource[filePath]) {
                throw new Error(`yo da filePath from TransactionPipeline should've been added as a sourceData after running csvParser`)
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
    mlog.debug([`[resolveUnmatchedTransactions()] Sanity Check 1`,
        `number of entities from transactions: ${missingEntities.size}`,
        `  number of entities from targetRows: ${numEntsFromExtraction}`,
        `abs diff = ${diff}`
    ].join(TAB));
    if (diff !== 0) {
        mlog.error(`ayo the diff should be 0`)
    }
    const parseResults: ParseResults = await parseRecordCsv(
        targetRows, { [entityType]: SO_CUSTOMER_PARSE_OPTIONS } as ParseOptions
    );
    const validatedResults = await processParseResults(
        parseResults, 
        { [entityType]: SO_CUSTOMER_POST_PROCESSING_OPTIONS } as ProcessParseResultsOptions
    ) as ValidatedParseResults;
    if (isNonEmptyArray(validatedResults[entityType].invalid)) {
        throw new Error([`${__filename}.resolveUnmatchedTransactions()]`,
            `invalid customer RecordOptions....`,
            `invalid.length: ${validatedResults[entityType].invalid.length}`,
            `check salesOrderParseDefinition and prune functions...`
        ].join(TAB))
    }
    const entities: RecordOptions[] = validatedResults[entityType].valid;
    mlog.debug([`[resolveUnmatchedTransactions()] Sanity Check 2`,
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
        responseFields: ['entityid', 'externalid', 'isperson', 'companyname', 'email'],
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
        mlog.error([`[resolveUnmatchedTransactions()]`,
            `There were some rejects when putting entities:`,
            `   num rejects: ${entityRejects.length}`,
        ].join(TAB));
        write({entityRejects, timestamp: getCurrentPacificTime()},
            path.join(ERROR_DIR, `${getFileNameTimestamp()}_ERROR_resolveUnmatchedTransactions_entityRejects.json`)
        );
    }
    mlog.debug([`[resolveUnmatchedTransactions()] Sanity Check 3`,
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
