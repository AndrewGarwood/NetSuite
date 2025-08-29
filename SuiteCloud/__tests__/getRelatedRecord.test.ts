/**
 * @TODO convert to jest
 * @file src/getRelatedRecord.test.ts
 */
import * as fs from "node:fs";
import { 
    EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum,
    CustomerStatusEnum, SearchOperatorEnum 
} from "../src/utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull,
    isNonEmptyString, 
    isStringArray,
    isIntegerArray
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, parseLogger as plog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, 
    getSkuDictionary,
    DELAY,
    getProjectFolders
} from "../src/config";
import { getColumnValues, getRows, 
    writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument, 
    isValidCsvSync,
    getFileNameTimestamp,
    indentedStringify,
    isFile,
    getSourceString
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
    RecordResult,
    partitionArrayBySize,
    RecordResponseOptions
} from "../src//api";
import { CleanStringOptions, clean, extractFileName, extractLeaf } from "typeshi:utils/regex"
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators";

const F = extractFileName(__filename);

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

const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}

export async function reconcile(): Promise<any> {
    const source = getSourceString(F, reconcile.name);
}


const completedValidationBatches: number[] = [];
const validatedSalesOrders: any[] = [];
const validationErrors: any[] = [];
let endpointFailed: boolean = false;
/**
 * tested on 2500 sales orders, and all passed
 * @TODO parameterize
 */
export async function validateRelatedRecordEndpoint(
    statePath: string,
    dictPath: string
): Promise<any> {
    const source = getSourceString(F, validateRelatedRecordEndpoint.name);
    if (isFile(statePath)) {
        let previousState = read(statePath);
        if (isStringArray(previousState.processed)) {
            validatedSalesOrders.push(...previousState.processed)
        }
        if (isIntegerArray(previousState.completedbatches, true)) {
            completedValidationBatches.push(...previousState.completedBatches)
        }
    }
    validate.existingFileArgument(source, '.json', {dictPath});
    
    const soTargetItems = read(dictPath) as { [soInternalId: string]: string[] };
    const keys = Object.keys(soTargetItems);
    const allBatches = partitionArrayBySize(keys, 50) as string[][]; // 839 batches for like 41906 sales order Ids
    const keyBatches = allBatches.slice(0, 50); // let's just test on first 50
    mlog.info([`${source} START`,
        // `num sales orders to process: ${keys.length}`,
        `num processed: ${validatedSalesOrders.length}`,
        `  num batches: ${keyBatches.length}`,
        `completed batches: [${completedValidationBatches.join(', ')}]`
    ].join(TAB));
    slog.info(` >   num batches: ${keyBatches.length}`);
    slog.info(` > num completed: ${completedValidationBatches.length}`);
    slog.info(` > >   completed: ${completedValidationBatches.join(', ') || 'NONE'}`);
    await DELAY(2000, `starting batchLoop...`);
    batchLoop:
    for (let i = 0; i < keyBatches.length; i++) {
        if (completedValidationBatches.includes(i)) {
            slog.info(`${source} > already processed batch ${i} (${i+1}/${keyBatches.length}), continuing`);
            continue;
        }
        await validateSalesOrderBatch(soTargetItems, keyBatches, i);
        if (endpointFailed) {
            mlog.error([`${source} Endpoint Failure detected at batch (${i+1}/${keyBatches.length})`])
            break batchLoop;
        }
        slog.info(`${source} Finished batch (${i+1}/${keyBatches.length})`);
        completedValidationBatches.push(i);
        await DELAY(2000);
    }
    write({errors: validationErrors}, 
        path.join(getProjectFolders().logDir, `${getFileNameTimestamp()}_reconcile_errors.json`)
    );
    write({completedBatches: completedValidationBatches, processed: validatedSalesOrders}, statePath);
    if (endpointFailed) {
        slog.debug(`oh no, endpoint failed...`)
    } else {
        slog.debug(`endpointFailed still false, so we might be okay`)
    }
}

async function validateSalesOrderBatch(
    /**map salesorder internalid to list of itemIds to verify existence in salesorder's item sublist */
    dict: { [key: string]: string[] }, 
    batches: string[][],
    batchIndex: number
): Promise<any> {
    const source = 
        `[${F}.${validateSalesOrderBatch.name}( ${batchIndex+1}/${batches.length} )]`;
    const batchKeys = batches[batchIndex];
    let skuDictionary = await getSkuDictionary();
    let indexCharLength = String(batchKeys.length).length;
    salesOrderLoop:
    for (let i = 0; i < batchKeys.length; i++) {
        const soInternalId = batchKeys[i];
        if (validatedSalesOrders.includes(soInternalId)) {
            slog.info(`${source} > Skipping processed salesorder from batch (${batchIndex+1}/${batches.length})`);
            continue salesOrderLoop;
        }
        const targetItemInternalIds = (dict[soInternalId] ?? []).map(itemId=>skuDictionary[itemId]);
        const req = generateSingleRecordRequest(RecordTypeEnum.SALES_ORDER, soInternalId);
        const res = await getRecordById(req) as RecordResponse;
        await DELAY(1000, null);
        if (!res || !isNonEmptyArray(res.results)) {
            mlog.error([`${source} Invalid Response: `,
                `getRecordById() response was undefined or had undefined results`,
                `sales order internalid: '${soInternalId}'`
            ].join(TAB));
            validationErrors.push({soInternalId, message: 'getRecordById() response was undefined or had undefined results'})
            continue;
        }
        let soResults = res.results as Required<RecordResult>[];
        if (soResults.length > 1) {
            mlog.warn(`multiple results returned from get single record request...`);
            validationErrors.push({soInternalId, message: 'multiple RecordResults returned from getRecordById()'})
            break;
        }
        let so = soResults[0];
        let itemSublist = so.sublists.item ?? [];
        if(!isNonEmptyArray(itemSublist)) return;
        let itemsFound: string[] = [];
        sublistLoop:
        for (let j = 0; j < itemSublist.length; j++) {
            let sublistLine = itemSublist[j];
            if (!hasKeys(sublistLine, 'item' )) {
                mlog.error([`${source} Invalid SublistLine in RecordResult`,
                    `salesorder RecordResult.sublists.item[${j}] does not have key 'item'`
                ].join(TAB));
                validationErrors.push({
                    soInternalId, subllistLineIndex: j, 
                    message: `salesorder RecordResult.sublists.item[${j}] does not have key 'item'`
                });
                break salesOrderLoop;
            }
            let currentItem = String(sublistLine.item);
            if (targetItemInternalIds.includes(currentItem) && !itemsFound.includes(currentItem)) {
                itemsFound.push(currentItem);
            }
        }
        if (itemsFound.length !== targetItemInternalIds.length) {
            const message = [
                `${source} endpoint failed. salesorder item sublist is missing ${
                    targetItemInternalIds.length - itemsFound.length
                } expected item(s)`,
                `sales order internalid: '${soInternalId}'`,
                `missingItems: ${targetItemInternalIds
                    .filter(id=>!itemsFound.includes(id))
                    .join(', ')
                }`,
                ` itemSublist: ${indentedStringify(itemSublist)}`,
            ].join(TAB);
            mlog.error(message);
            validationErrors.push({
                soInternalId,
                message
            })
            endpointFailed = true;
            break salesOrderLoop;
        }
        slog.info(`salesorder ${
            String(i+1).padStart(indexCharLength, ' ')}/${batchKeys.length
            } has all expected items! salesorder: '${soInternalId}'`
        );
        validatedSalesOrders.push(soInternalId);
    }


}

/**
 * @TODO parameterize
 * @returns **`relatedRecordDictionary`** `Promise<{ [id: string]: RecordResult[] }>`
 */
async function retrieveRelatedRecords(
    filePath: string
): Promise<{ [itemId: string]: RecordResult[] }> {
    const source = `[${F}.${retrieveRelatedRecords.name}()]`;
    const ITEM_ID_COLUMN = 'Item';
    let lnItems = await getColumnValues(filePath, ITEM_ID_COLUMN, itemIdExtractor);
    let itemBatches = partitionArrayBySize(lnItems, 50);
    let skuDictionary = await getSkuDictionary();
    /** `relatedRecordDictionary` */
    let dict: { [itemId: string]: RecordResult[] } = {};
    for (let i = 0; i < itemBatches.length; i++) {
        dict = await handleItemBatch(dict, i+1, itemBatches[i], skuDictionary);
        slog.debug(`${source} END batch ${i+1}/${itemBatches.length} ${'-'.repeat(16)}`);
    }
    return dict;
}

/**
 * @TODO parameterize
 * @returns 
 */
async function handleItemBatch(
    relatedRecordDictionary: { [itemId: string]: RecordResult[] },
    batchIndex: number,
    lnItems: string[], 
    skuDictionary: Record<string, string>
): Promise<{ [itemId: string]: RecordResult[] }> {
    const source = `[${F}.${handleItemBatch.name}( ${batchIndex} )]`;
    let numRelatedRecords = 0;
    let errorItems: string[] = [];
    itemLoop:
    for (let i = 0; i < lnItems.length; i++) {
        let itemId = lnItems[i];
        slog.debug(`${source} START loop iteration (${i+1}/${lnItems.length}) itemId: '${itemId}'`)
        if (!(itemId in skuDictionary)) {
            mlog.warn([`${source} at lnItems[${i}], itemId: '${itemId}'`,
                `found itemId not in skuDictionary -> need to check that it's in NS`,
            ].join(TAB));
            errorItems.push(itemId);
            continue itemLoop;
        }
        const req = await generateRelatedRecordRequest(itemId);
        relatedRecordDictionary[itemId] = [];
        const res = await getRelatedRecord(req) as RecordResponse;
        await DELAY(1000, null);
        if (!res.results) {
            mlog.warn([`${source} at lnItems[${i}], itemId: '${itemId}'`,
                `response.results was undefined, continuing...`
            ].join(TAB));
            errorItems.push(itemId);
            continue itemLoop;
        }
        let recordResults = res.results;
        relatedRecordDictionary[itemId].push(...recordResults);
        numRelatedRecords += recordResults.length
        slog.debug([`finished loop iteration (${i+1}/${lnItems.length}) itemId: '${itemId}'`,
            `related record count: ${recordResults.length}`
        ].join(TAB));
    }
    mlog.debug([`${source} reached end of function....`,
        `errorItems.length: ${errorItems.length}`,
    ].join(TAB));
    slog.debug(`batch's numRelatedRecords: ${numRelatedRecords}`);
    
    return relatedRecordDictionary
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
    const source = `[${F}.${generateRelatedRecordRequest.name}()]`;
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


function generateSingleRecordRequest(
    recordType: string | RecordTypeEnum,
    recordInternalId: string,
    responseOptions: RecordResponseOptions = {
        fields: ['externalid'],
        sublists: { item: ['item', 'line'] }
    }
): SingleRecordRequest {
    const idOptions = [{
        idProp: idPropertyEnum.INTERNAL_ID,
        idValue: Number(recordInternalId),
        searchOperator: SearchOperatorEnum.RECORD.ANY_OF
    }] as idSearchOptions[];
    return { recordType, idOptions, responseOptions } as SingleRecordRequest;

}
