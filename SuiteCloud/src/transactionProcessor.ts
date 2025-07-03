/**
 * @file src/transactionProcessor.ts
 */

import path from 'node:path';
import * as fs from 'fs';
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
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
} from "./utils/api";
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { isNonEmptyArray, anyNull, isNullLike as isNull, isEmptyArray } from './utils/typeValidation';
import { ENTITY_RESPONSE_OPTIONS } from './entityProcessor';

export const SO_RESPONSE_OPTIONS: RecordResponseOptions = {
    responseFields: ['tranid', 'trandate', 'entity', 'externalid','otherrefnum', ]
};
const TWO_SECONDS = 2000;

export enum StageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    MATCH_ENTITY = 'MATCH_ENTITY',
    PUT_SALES_ORDERS = 'PUT_SALES_ORDERS',
}
export type ProcessorOptions = {
    parseOptions: ParseOptions,
    postProcessingOptions: ProcessParseResultsOptions,
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
    stopAfter?: StageEnum,
}
/**
 * @param options 
 * @param fileName 
 * @param stage 
 * @param stageData 
 * @returns **`boolean`**
 */
function done(
    options: ProcessorOptions, 
    fileName: string,
    stage: StageEnum,
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

export async function processTransactionFiles(
    tranType: RecordTypeEnum | string,
    filePaths: string | string[],
    options: ProcessorOptions
): Promise<void> {
    if (!tranType || !filePaths 
        || (typeof filePaths !== 'string' && !isNonEmptyArray(filePaths))) {
        mlog.error(`[processTransactionFiles()] transactionType or filePaths is undefined or invalid.`);
    }
    const { 
        clearLogFiles, parseOptions, postProcessingOptions, responseOptions 
    } = options as ProcessorOptions;
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
        if (done(options, fileName, StageEnum.PARSE, parseResults)) return;
        
        const validatedResults: ValidatedParseResults = processParseResults(
            parseResults, postProcessingOptions
        );
        if (done(options, fileName, StageEnum.VALIDATE, validatedResults)) return;
        
        const invalidDict = Object.keys(validatedResults).reduce((acc, key) => {
            acc[key] = validatedResults[key].invalid;
            return acc;
        }, {} as { [recordType: string]: RecordOptions[] });
        write(invalidDict, path.join(CLOUD_LOG_DIR, `${fileName}_invalidOptions.json`));
        const validDict = Object.keys(validatedResults).reduce((acc, key) => {
            acc[key] = validatedResults[key].valid;
            return acc;
        }, {} as { [recordType: string]: RecordOptions[] });

        const validOptions = Object.values(validDict).flat();
        const matchResults = await matchTransactionsToEntity(validOptions);
        if (done(options, fileName, StageEnum.MATCH_ENTITY, matchResults)) return;
        if (isEmptyArray(matchResults.matches)) {
            mlog.warn(`[processTransactionFiles()] No valid transactions matched to entities.`,
                TAB+`fileName: '${fileName}'`,
                TAB+`   stage: '${StageEnum.MATCH_ENTITY}'`,
                TAB+`   continuing to next file...`
            );
            continue;
        }
        if (isNonEmptyArray(matchResults.errors)) {
            mlog.debug(`[processTransactionFiles()] Some transactions did not match to entities.`,
                TAB+`  fileName: '${fileName}'`,
                TAB+`     stage: '${StageEnum.MATCH_ENTITY}'`,
                TAB+`num errors: ${matchResults.errors.length}`,
            );
            write(matchResults.errors, 
                path.join(CLOUD_LOG_DIR, `${fileName}_matchErrors.json`)
            );
        }
        const transactionResponses = await putTransactions(
            matchResults.matches, responseOptions || SO_RESPONSE_OPTIONS
        );
        if (done(options, fileName, StageEnum.PUT_SALES_ORDERS, transactionResponses)) return;
    }
}

/**
 * - {@link getRecordById}, {@link GetRecordRequest}
 * @param transactions {@link RecordOptions}`[]` - array of transactions to match to entities.
 * @param entityFieldId `string` - the `fieldId` key in the transaction's {@link RecordOptions.fields} that contains the entity id, defaults to `'entity'`.
 * @returns **`result`** - `{ matches: `{@link RecordOptions}`[], errors: RecordOptions[] }`
 * - **`result.matches`** - the elements from `transactions` that were successfully matched to an entity.
 */
async function matchTransactionsToEntity(
    transactions: RecordOptions[],
    entityFieldId: string = 'entity',
    entityType: EntityRecordTypeEnum | string = EntityRecordTypeEnum.CUSTOMER,
    entityResponseOptions: RecordResponseOptions = ENTITY_RESPONSE_OPTIONS
): Promise<{
    matches: RecordOptions[],
    errors: RecordOptions[]
}> {
    const result = { matches: [], errors: [] }
    if (!isNonEmptyArray(transactions)) { return result; }
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
            recordType: txn.recordType,
            responseOptions: entityResponseOptions,
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