/**
 * @file src/DataReconciler.ts
 */
import * as fs from "node:fs";
import { 
    EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum,
    CustomerStatusEnum, SearchOperatorEnum 
} from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull,
    isNonEmptyString, 
    isStringArray,
    isIntegerArray,
    isObject,
    isEmpty
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, parseLogger as plog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, 
    getSkuDictionary,
    DELAY,
    getProjectFolders, isEnvironmentInitialized, isDataInitialized
} from "./config";
import { getColumnValues, getRows, 
    writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument, 
    isValidCsvSync,
    getFileNameTimestamp,
    indentedStringify,
    isFile,
    getSourceString, clearFile, trimFile,
    getCurrentPacificTime,
    autoFormatLogsOnExit
} from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { 
    RecordOptions, SetFieldSubrecordOptions, SetSublistSubrecordOptions, SublistLine,
    SingleRecordRequest, getRecordById, 
    idSearchOptions,
    idPropertyEnum,
    ChildSearchOptions,
    RelatedRecordRequest,
    RecordResponse, getRelatedRecord,
    isRecordTypeEnum,
    isIdOptions,
    isChildOptions,
    isIdSearchOptions,
    RecordResult, isRecordResult,
    partitionArrayBySize,
    RecordResponseOptions,
    instantiateAuthManager,
    FieldDictionary,
    isRecordResponseOptions,
    FieldValue,
    SubrecordValue,
    SublistUpdateDictionary,
    FindSublistLineWithValueOptions,
    isAuthInitialized,
} from "./api";
import { CleanStringOptions, StringReplaceOptions, clean, extractFileName, extractLeaf } from "typeshi:utils/regex"
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators";
import { putTransactions } from "src/pipelines";

const F = extractFileName(__filename);

// quantitybilled
let tranResponseOptions = {
    fields: ['externalid', 'tranid', 'amount', 'memo', 'total'],
    sublists: {
        item: ['id', 'item', 'quantity', 'rate']
    }
}
let placeholders: Required<RecordResult>[] | null = [];

type TransactionUpdateDictionary = {
    [tranInternalId: string]: TransactionUpdate
}

type TransactionUpdate = {
    tranType: RecordTypeEnum;
    replacements: ReplacementDictionary;
    fields?: FieldDictionary;
    originalTotal: number;
}

type ReplacementDictionary = {
    [newItemInternalId: string]: {
        newItemId: string;
        oldItemInternalId: string;
        quantity: number;
        rate: number;
    }
}

type ReconcileState = {
    /** map itemId to list of tranInternalId */
    firstUpdateCompleted: { 
        [itemId: string]: string[] 
    };
    itemsDeleted: string[];
    itemsCreated: string[];
    /** map itemId to list of tranInternalId */
    secondUpdateCompleted:  { 
        [itemId: string]: string[] 
    }
    
}

let reconcileState: ReconcileState | null = null;
export function getReconcileState(): ReconcileState {
    if (!reconcileState) {
        throw new Error(`${getSourceString(F, getReconcileState.name)} state has not been loaded yet`);
    }
    return reconcileState;
}

export async function reconcileItems(): Promise<any> {
    const source = getSourceString(F, reconcileItems.name);
    if (!isEnvironmentInitialized()) {
        throw new Error(`${source} environment not initialized`)
    }
    if (!isDataInitialized()) {
        throw new Error(`${source} project data not initialized`)
    }
    if (!isAuthInitialized()) {
        throw new Error(`${source} auth manager not initialized`)
    }
    
    let wDir = path.join(getProjectFolders().dataDir, 'workspace');
    validate.existingDirectoryArgument(source, {wDir});
    reconcileState = read(path.join(wDir, 'state.json')) as ReconcileState;
    validate.objectArgument(source, {reconcileState})
    let state = getReconcileState();
    let itemsToDelete: string[] = [];
    placeholders = (read(path.join(wDir, 'item_placeholders.json')) as { 
        placeholders: Required<RecordResult>[]
    }).placeholders;
    validate.arrayArgument(source, {placeholders, isRecordResult});

    let targetItems = read(path.join(wDir, 'items_to_salesorders.json')) as {
        [itemId: string]: RecordResult[]
    };
    let initialReplacements: { [itemId: string]: TransactionUpdateDictionary } = {}
    for (let itemId of Object.keys(targetItems).slice(0,1)) {
        initialReplacements[itemId] = await generateItemTransactionUpdates(
            itemId, 
            targetItems[itemId]
        )
    }
    write(initialReplacements, path.join(wDir, 'initial_replacements.json'));
    itemLoop:
    for (let [itemId, tranUpdateDict] of Object.entries(initialReplacements)) {
        if (!state.firstUpdateCompleted[itemId]) {
            state.firstUpdateCompleted[itemId] = []
        }
        let tranKeys = Object.keys(tranUpdateDict);
        tranLoop:
        for (let tranInternalId of tranKeys) {
            const intermediateUpdate = tranUpdateDict[tranInternalId];
            if (state.firstUpdateCompleted[itemId].includes(tranInternalId)) continue tranLoop;
            // let success = await performIntermediateReplacement(itemId, tranInternalId, intermediateUpdate);
            // if (success) {
            //     slog.info(` -- ${source} successfully performed intermediate replacement for tran ${tranInternalId}`)
            //     state.firstUpdateCompleted[itemId].push(tranInternalId)
            // }
        }

    }
    write(state, path.join(wDir, 'state.json'));
    // let lnii_data = read(path.join(wDir, 'lnii_options.json'));
}

/**
 * @TODO change return value to something more useful
 * @param targetItemId 
 * @param tranInternalId 
 * @param tranUpdate 
 * @returns 
 */
export async function performIntermediateReplacement(
    targetItemId: string,
    tranInternalId: string,
    tranUpdate: TransactionUpdate
): Promise<boolean> {
    const source = getSourceString(F, performIntermediateReplacement.name, 
        `{ item: '${targetItemId}', tran: '${tranInternalId}' }`
    );
    const { tranType, replacements, fields, originalTotal } = tranUpdate;
    slog.info([`${source} for ${tranType}(${tranInternalId})`,
        `replacing ${replacements.length} occurrence(s) of item '${targetItemId}'`
    ].join(TAB));
    let allReplacementsSuccessful = false;
    let oldItemInternalIds = Array.from(new Set(
        Object.values(replacements)
            .map(v=>v.oldItemInternalId)
    ));
    let isFirstPutRequest = true;
    for (let [newItemInternalId, replacementDetails] of Object.entries(replacements)) {
        const { quantity, rate, oldItemInternalId } = replacementDetails;
        const lineWithItemToReplace: FindSublistLineWithValueOptions = {
            sublistId: 'item',
            fieldId: 'item',
            value: oldItemInternalId
        }
        const tranRecord: RecordOptions = {
            recordType: tranType,
            idOptions: [{
                idProp: idPropertyEnum.INTERNAL_ID,
                idValue: Number(tranInternalId),
                searchOperator: SearchOperatorEnum.RECORD.ANY_OF
            }],
            sublists: {
                item: {
                    item: {
                        newValue: Number(newItemInternalId),
                        lineIdOptions: lineWithItemToReplace
                    },
                    rate: {
                        newValue: rate,
                        lineIdOptions: lineWithItemToReplace
                    },
                    quantity: {
                        newValue: quantity,
                        lineIdOptions: lineWithItemToReplace
                    },
                    quantitybilled: {
                        newValue: quantity,
                        lineIdOptions: lineWithItemToReplace
                    }
                } as SublistUpdateDictionary
            }
        }
        if (isFirstPutRequest){
            tranRecord.fields = fields;
            isFirstPutRequest = false;
        }
        let responseArr = await putTransactions([tranRecord], tranResponseOptions);
        let putResponse = responseArr[0] as Required<RecordResponse>;
        let result = putResponse.results[0] as Required<RecordResult>
        let total = result.fields.total;
        if (typeof total !== 'number') {
            mlog.error(`${source} error in result from replacement put request`,
                `fields.total is not a number`,
                `received: ${typeof total} = '${total}'`
            )
        }
        if (total !== originalTotal) {
            mlog.error(`${source} Replacement failed... total not same after update...`,
                `targetItemId: '${targetItemId}'`,
                `details: `, JSON.stringify(replacementDetails)
            );
            throw new Error(`${source} replacement failed...`)
        }
    }

    // validaation after initial replacement....
    let getReq: SingleRecordRequest = {
        recordType: tranType,
        idOptions: [{
            idProp: idPropertyEnum.INTERNAL_ID,
            idValue: tranInternalId,
            searchOperator: SearchOperatorEnum.RECORD.ANY_OF
        }],
        responseOptions: tranResponseOptions
    };
    let getResponse = await getRecordById(getReq) as Required<RecordResponse>;
    let getResult = getResponse.results[0] as Required<RecordResult>;
    let linesWithOldValue = getLinesWithSublistFieldValue(
        getResult.sublists.item, 
        'item', 
        ...oldItemInternalIds
    );
    if (linesWithOldValue.length === 0) {
        allReplacementsSuccessful = true;
    }
    return allReplacementsSuccessful;
}



/*
Outline:
for each itemId in itemBatch
    // maybe getRecordById(itemId) and make sure has a value for price
    let relatedSalesOrders = itemDict[itemId];
    while relatedSalesOrders.length > 0
        for each 'so' (salesorder RecordResult) in relatedSalesOrders  
            getRecordById(so.internalid);
            **need to account for when itemId occurrs in more than 1 line in salesorder**
            need to store the 'rate' field value; qty is preserved when replacing...
*/
    
async function generateItemTransactionUpdates(
    itemId: string,
    transactions: RecordResult[],
): Promise<TransactionUpdateDictionary> {
    const source = getSourceString(F, generateItemTransactionUpdates.name, itemId);
    validate.arrayArgument(source, {transactions, isRecordResult});
    let skuDict = getSkuDictionary();
    if (!placeholders && !isNonEmptyArray(placeholders)) {
        mlog.error(`${source} Cannot handle replacement without instantiation of placeholders`)
        throw new Error(
            `${source} Cannot handle replacement without instantiation of placeholders`
        );
    }
    slog.info(`${source} START - num transactions: ${transactions.length}`)
    let tranUpdates: TransactionUpdateDictionary = {};
    let itemInternalId = skuDict[itemId];
    validate.stringArgument(source, {itemInternalId});
    for (let i = 0; i < transactions.length; i++) {
        let txn = transactions[i] as Required<RecordResult>;
        let getReq = SingleRecordRequest(
            txn.recordType, 
            String(txn.internalid), 
            tranResponseOptions
        );
        let getRes = await getRecordById(getReq);
        if (!isNonEmptyArray(getRes.results)) {
            mlog.error([`${source} Invalid getRecord response`,
                `tran internalid: ${txn.internalid}`
            ].join(TAB));
            throw new Error(`${source} Invalid getRecord response`);
        }
        txn = (getRes.results[0]) as Required<RecordResult>;
        let targetLines = getLinesWithSublistFieldValue(
            txn.sublists.item, 'item', itemInternalId
        );
        if (targetLines.length === 0) {
            slog.info(` -- no lines found with targetItemId '${itemId}'`,
                `continuing to next transaction`
            );
            continue;
        }
        let itemReps: ReplacementDictionary = {};
        for (let j = 0; j < targetLines.length; j++) {
            const targetLine = targetLines[j];
            let placeholderInternalId = String(placeholders[j].internalid);
            itemReps[placeholderInternalId] = {
                newItemId: String(placeholders[j].fields.itemid) || '',
                oldItemInternalId: itemInternalId,
                quantity: Number(targetLine.quantity),
                rate: Number(targetLine.rate),
            }
        }
        slog.info([` -- preparing ItemReplacementDictionary for item '${itemId}' with internalId '${itemInternalId}'`,
            `num corresponding lines in ${txn.recordType}(${txn.internalid}): ${targetLines.length}`,
            `num replacements: ${Object.keys(itemReps).length}`
        ].join(TAB));
        tranUpdates[String(txn.internalid)] = {
            tranType: txn.recordType as RecordTypeEnum,
            originalTotal: Number(txn.fields.total),
            replacements: itemReps,
            fields: {
                memo: fixTransactionMemo(txn.fields.memo)
            }
        }
    }
    return tranUpdates;
}

const tranTypePattern = new RegExp(/(?<=\()[\sA-Z]+(?=\)<[a-z]+>$)/i);
function fixTransactionMemo(
    memo: FieldValue | SubrecordValue,
    stringReplaceOptions: StringReplaceOptions = [
        {
            searchValue: /(?<= )([A-Z]{2,})+ Type '[\sA-Z]+', /i, replaceValue: ''
        },
        {
            searchValue: /QuickBooks Transaction Type.*(?=Expected)/i, replaceValue: ''
        },
    ]
): string {
    if (isEmpty(memo)) return ''
    memo = clean(String(memo), { replace: stringReplaceOptions });
    return memo;
}

function getLinesWithSublistFieldValue(
    lines: SublistLine[],
    fieldId: string,
    ...targetValues: string[]
): SublistLine[] {
    const targetLines: SublistLine[] = [];
    for (let line of lines) {
        if (targetValues.includes(String(line[fieldId]))) {
            targetLines.push(line)
        }
    }
    return targetLines;
}

const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}



/**
 * @TODO parameterize
 * @returns 
 */
async function generateRelatedRecordRequest(
    itemId: string,
    childOptions: ChildSearchOptions[] = [{
        childRecordType: RecordTypeEnum.SALES_ORDER,
        fieldId: 'item',
        sublistId: 'item',
    }]
): Promise<RelatedRecordRequest> {
    const source = getSourceString(F, generateRelatedRecordRequest.name)
    validate.stringArgument(source, {itemId});
    const parentRecordType = RecordTypeEnum.INVENTORY_ITEM;
    let idOptions: idSearchOptions[];
    let skuDictionary = getSkuDictionary();
    if (isNonEmptyString(skuDictionary[itemId])) {
        idOptions = [{
            idProp: idPropertyEnum.INTERNAL_ID,
            idValue: Number(skuDictionary[itemId]),
            searchOperator: SearchOperatorEnum.RECORD.ANY_OF
        }]
    } else {
        idOptions = [{
            idProp: idPropertyEnum.ITEM_ID,
            idValue: itemId,
            searchOperator: SearchOperatorEnum.TEXT.IS
        }]
    }
    return { parentRecordType, idOptions, childOptions } as RelatedRecordRequest;
}


function SingleRecordRequest(
    recordType: string | RecordTypeEnum,
    recordInternalId: string,
    responseOptions?: RecordResponseOptions
): SingleRecordRequest {
    const source = getSourceString(F, 'SingleRecordRequest');
    validate.enumArgument(source, {recordType, RecordTypeEnum});
    validate.stringArgument(source, {recordInternalId});
    validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    const idOptions = [{
        idProp: idPropertyEnum.INTERNAL_ID,
        idValue: Number(recordInternalId),
        searchOperator: SearchOperatorEnum.RECORD.ANY_OF
    }] as idSearchOptions[];
    const request: SingleRecordRequest = { recordType, idOptions, responseOptions };
    return request;

}

/**
 * @param validationDict 
 * @param csvFiles 
 * @param column 
 * @param extractor 
 * @param extractorArgs 
 * @returns **`missingValues`** `Promise<{ [filePath: string]: string[] }>`
 * - get references to all files that have a row where row[column] `not in validationDict`
 * > should probably change validationDict to validationSet or an array or somethin
 */
export async function validateFiles(
    validationDict: Record<string, string>,
    csvFiles: string[],
    column: string, 
    extractor: (columnValue: string, ...args: any[]) => string | Promise<string>,
    extractorArgs: any[] = []
): Promise<{ [filePath: string]: string[] }> {
    const source = getSourceString(F, validateFiles.name);
    validate.arrayArgument(source, {csvFiles, isNonEmptyString});
    validate.stringArgument(source, {column});
    validate.functionArgument(source, {extractor});
    validate.objectArgument(source, {validationDict});
    const missingValues = {} as { [filePath: string]: string[] };
    for (const csvPath of csvFiles) {
        if (!isValidCsvSync(csvPath)) {
            mlog.warn(`csvFiles contained invalid csvPath`) 
            continue; 
        }
        missingValues[csvPath] = [];
        const columnValues = await getColumnValues(csvPath, column);
        for (const originalValue of columnValues) {
            const extractedValue = await extractor(originalValue, ...extractorArgs);
            if (!isNonEmptyString(extractedValue)) {
                plog.warn([`${source} extractor(value) returned invalid string`,
                    `originalValue: '${originalValue}'`, 
                    `     filePath: '${csvPath}'`
                ].join(TAB));
                if (!missingValues[csvPath].includes(originalValue)) {
                    missingValues[csvPath].push(originalValue);
                }
                continue;
            } 
            if (!validationDict[extractedValue] 
                && !missingValues[csvPath].includes(extractedValue)) {
                missingValues[csvPath].push(extractedValue)
            }
        }
    }
    return missingValues;
}

/**
 * @param rowSource `string | Record<string, any>[]`
 * @param targetColumn `string`
 * @param targetValues `string[]`
 * @param extractor `function (columnValue: string, ...args: any[]) => string`
 * @param extractorArgs `any[]`
 * @returns **`targetRows`** `Promise<Record<string, any>[]>` 
 * - array of all rows where either `row[targetColumn]` or `extractor(row[targetColumn])` is in `targetValues`
 */
export async function extractTargetRows(
    /** 
     * - `string` -> filePath to a csv file
     * - `Record<string, any>[]` -> array of rows
     * */
    rowSource: string | Record<string, any>[],
    targetColumn: string, 
    targetValues: string[],
    extractor?: (columnValue: string, ...args: any[]) => string | Promise<string>, 
    extractorArgs?: any[]
): Promise<{
    rows: Record<string, any>[];
    remainingValues: string[]
}> {
    const source = getSourceString(F, extractTargetRows.name);
    if(!isNonEmptyString(rowSource) && !isNonEmptyArray(rowSource)) {
        throw new Error([`${source} Invalid param 'rowSource'`,
            `Expected rowSource: string | Record<string, any>[]`,
            `Received rowSource: '${typeof rowSource}'`
        ].join(TAB));
    }
    validate.stringArgument(source, {targetColumn});
    if (extractor !== undefined) validate.functionArgument(source, {extractor});
    validate.arrayArgument(source, {targetValues, isNonEmptyString});
    const sourceRows = await handleFileArgument(
        rowSource, extractTargetRows.name, [targetColumn]
    );
    const remainingValues: string[] = []
    let potentials: Record<string, number[]> = {}
    let valuesFound: string[] = [];
    const targetRows: Record<string, any>[] = [];
    for (let i = 0; i < sourceRows.length; i++) {
        const row = sourceRows[i];
        if (!hasKeys(row, targetColumn)) {
            mlog.warn([`${source} row does not have provided targetColumn`,
                `    targetColumn: '${targetColumn}'`,
                `Object.keys(row):  ${JSON.stringify(Object.keys(row))}`,
            ].join(TAB));
            continue;
        }
        const originalValue = String(row[targetColumn]);
        if (targetValues.includes(originalValue)) {
            targetRows.push(row);
            if (!valuesFound.includes(originalValue)) valuesFound.push(originalValue);
            plog.debug(`${source} ORIGINAL VALUE IN TARGET VALUES`)
            continue;
        }
        if (!extractor) { continue }
        const extractedValue = await extractor(originalValue, extractorArgs);
        if (!isNonEmptyString(extractedValue)) {
            plog.warn([`${source} extractor(value) returned invalid string`,
                ` originalValue: '${originalValue}'`, 
                `rowSource type: '${typeof rowSource}'`
            ].join(TAB));
            continue;
        }
        if (targetValues.includes(extractedValue)) {
            targetRows.push(row);
            if (!valuesFound.includes(extractedValue)) valuesFound.push(extractedValue);
            continue;
        }
        let targetMatch = targetValues.find(v=>{
            v = v.toUpperCase();
            return v.startsWith(extractedValue.toUpperCase())
        });
        if (targetMatch) {
            if (!potentials[targetMatch]) {
                potentials[targetMatch] = [i]
            } else {
                potentials[targetMatch].push(i)
            }
            // slog.debug([`${source} Found potentialMatch for a targetValue at rowIndex ${i}`,
            //     ` originalValue: '${originalValue}'`, 
            //     `extractedValue: '${extractedValue}'`, 
            //     `potentialMatch: '${targetMatch}'`, 
            // ].join(TAB));
        }
    }
    remainingValues.push(...targetValues.filter(v=> !valuesFound.includes(v)));
    // if (remainingValues.length > 0) {
    //     mlog.warn([`${source} ${remainingValues.length} value(s) from targetValues did not have a matching row`,
    //         // indentedStringify(remainingValues)
    //     ].join(TAB));
    //     write({remainingValues}, path.join(CLOUD_LOG_DIR, `${getFileNameTimestamp()}_remainingValues.json`))
    // }
    return {rows: targetRows, remainingValues};
}