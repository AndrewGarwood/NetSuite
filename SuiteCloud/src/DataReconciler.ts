/**
 * @file src/DataReconciler.ts
 */
import * as fs from "node:fs";
import { 
    EntityRecordTypeEnum, RecordTypeEnum, CustomerTaxItemEnum,
    CustomerStatusEnum, SearchOperatorEnum 
} from "./utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull,
    isNonEmptyString 
} from "typeshi:utils/typeValidation";
import { DATA_DIR, mainLogger as mlog, parseLogger as plog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, CLOUD_LOG_DIR, 
    getSkuDictionary,
    DELAY
} from "./config";
import { getColumnValues, getRows, 
    writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument, 
    isValidCsvSync,
    getFileNameTimestamp,
    indentedStringify
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
    partitionArrayBySize
} from "./api";
import { CleanStringOptions, clean, extractLeaf } from "typeshi:utils/regex"
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators";

const F = path.basename(__filename).replace(/\.[a-z]{1,}$/, '');

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
    const source = `[DataReconciler.validateFiles()]`
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
    const source = `[DataReconciler.extractTargetRows()]`
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
export async function validateGetRelatedRecord(): Promise<any> {
    const source = `[${F}.${validateGetRelatedRecord.name}()]`;
    const dictPath = path.join(CLOUD_LOG_DIR, 'items', 'related_record_dict.json');
    validate.existingFileArgument(source, '.json', {dictPath});
    let itemToRecords = read(dictPath) as { [itemId: string]: RecordResult[] };
    let keys = Object.keys(itemToRecords);
    let targetKeys = keys.filter(k=>isNonEmptyArray(itemToRecords[k]));
    let endpointFailed: boolean = false;
    let errorItems: string[] = [];
    let expectedNumProcessed = Object.values(itemToRecords).flat().length;
    let numProcessed = 0;
    let processed: RecordResult[] = [];
    let skuDictionary = await getSkuDictionary();
    let maxResultsLength = Math.max(
        ...Object.values(itemToRecords).map(results=>results.length)
    );
    let indexCharLength = String(targetKeys.length).length;
    let numResultsCharLength = String(maxResultsLength).length;
    mlog.debug([`${source} START`,
        `total num keys: ${keys.length}`,
        `non-empty keys: ${targetKeys.length}`,
        
    ].join(TAB), NL+`maxResultsLength: ${maxResultsLength}`);
    itemLoop:
    for (let i = 0; i < targetKeys.length; i++) {
        let itemId = targetKeys[i];
        if (!(itemId in skuDictionary)) {
            mlog.warn([`${source} at lnItems[${i}], itemId: '${itemId}'`,
                `found itemId not in skuDictionary -> need to check that it's in NS`,
            ].join(TAB));
            errorItems.push(itemId);
            continue itemLoop;
        }
        const itemInternalId = skuDictionary[itemId]
        let soRecords = itemToRecords[itemId];
        slog.debug([
            `Starting records from keyIndex ${String(i).padEnd(indexCharLength, ' ')} with itemId '${itemId}'`,
            `num records to process: ${soRecords.length}`
        ].join(TAB));
        for (let result of soRecords) {
            const { recordType, internalid: salesOrderInternalId } = result;
            const idOptions = [{
                idProp: idPropertyEnum.INTERNAL_ID,
                idValue: Number(salesOrderInternalId),
                searchOperator: SearchOperatorEnum.RECORD.ANY_OF
            }] as idSearchOptions[];
            const responseOptions = {
                fields: ['externalid'],
                sublists: { item: ['item'] }
            }
            const req: SingleRecordRequest = {recordType, idOptions, responseOptions};
            const res = await getRecordById(req);
            await DELAY(1000, null);
            if (!res.results) {
                mlog.error([`${source} at targetKeys[${i}], itemId: '${itemId}'`,
                    `results is undefined but we filtered by non empty ones from GET_RelatedRecord results...`,
                    `how is dat possible`
                ].join(TAB));
                errorItems.push(itemId);
                continue itemLoop;
            }
            if (isNonEmptyArray(res.results) && res.results.some(result=>isNull(result.sublists) || isNull(result.fields))) {
                mlog.error([`${source} at targetKeys[${i}], itemId: '${itemId}'`,
                    `there exists a result in res.results that is missing expected property: 'fields' or 'sublists'`,
                ].join(TAB));
                errorItems.push(itemId);
                continue itemLoop;
            }
            let recordResults = res.results as Required<RecordResult>[];
            for (let rec of recordResults) {
                let itemSublist = rec.sublists.item;
                if (!itemSublist.some(lineItem=>
                    hasKeys(lineItem, 'item') && Number(lineItem.item) === Number(itemInternalId))) {
                    mlog.error([`${source} at targetKeys[${i}], itemId: '${itemId}'`,
                        `PROBLEM!!!!!!!!`,
                        `There does not exist a SublistLine with SublistLine[item]=== internalid of current itemId`
                    ].join(TAB));
                    endpointFailed = true;
                    errorItems.push(itemId);
                    continue itemLoop;
                }
            }
        }
        numProcessed += soRecords.length;
        processed.push(...soRecords);
        slog.debug(` > Processed ${String(soRecords.length).padEnd(numResultsCharLength, ' ')} recordResult(s)`,
        `at keyIndex ${String(i).padEnd(indexCharLength, ' ')} with itemId '${itemId}'`)
    }
    mlog.info(`Finished processing itemIds in targetKeys... endpointFailed ? ${endpointFailed}`);
    slog.info(`expected numProcessed: ${expectedNumProcessed}`);
    slog.info(`  actual numProcessed: ${numProcessed}`);
    slog.info(`    errorItems.length: ${errorItems.length}`);
    write({errorItems}, path.join(CLOUD_LOG_DIR, 'items', 'related_record_errorItems.json'));
}

async function retrieveRelatedRecords(): Promise<{ [itemId: string]: RecordResult[] }> {
    const source = `[${F}.${retrieveRelatedRecords.name}()]`;
    const filePath = path.join(DATA_DIR, 'items', 'lot_numbered_inventory_item0.tsv');
    const ITEM_ID_COLUMN = 'Item';
    let lnItems = await getColumnValues(filePath, ITEM_ID_COLUMN, itemIdExtractor);
    let itemBatches = partitionArrayBySize(lnItems, 50);
    let skuDictionary = await getSkuDictionary();
    /** `relatedRecordDictionary` */
    let dict: { [itemId: string]: RecordResult[] } = {};
    for (let i = 0; i < itemBatches.length; i++) {
        dict = await handleBatch(dict, i+1, itemBatches[i], skuDictionary);
        slog.debug(`${source} END batch ${i+1}/${itemBatches.length} ${'-'.repeat(16)}`);
    }
    return dict;
}

async function handleBatch(
    relatedRecordDictionary: { [itemId: string]: RecordResult[] },
    batchIndex: number,
    lnItems: string[], 
    skuDictionary: Record<string, string>
): Promise<{ [itemId: string]: RecordResult[] }> {
    const source = `[${F}.${handleBatch.name}( ${batchIndex} )]`;
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

async function generateRelatedRecordRequest(
    itemId: string,
    idOptions: idSearchOptions[] = [],
): Promise<RelatedRecordRequest> {
    const source = `[${F}.${generateRelatedRecordRequest.name}()]`
    validate.stringArgument(source, {itemId});
    const parentRecordType = RecordTypeEnum.INVENTORY_ITEM;
    let skuDictionary = await getSkuDictionary();
    if (isNonEmptyString(skuDictionary[itemId])) {
        idOptions.push({
            idProp: idPropertyEnum.INTERNAL_ID,
            idValue: Number(skuDictionary[itemId]),
            searchOperator: SearchOperatorEnum.RECORD.ANY_OF
        });
    }
    idOptions.push({
        idProp: idPropertyEnum.ITEM_ID,
        idValue: itemId,
        searchOperator: SearchOperatorEnum.TEXT.IS
    });
    const childOptions: ChildSearchOptions[] = [{
        childRecordType: RecordTypeEnum.SALES_ORDER,
        fieldId: 'item',
        sublistId: 'item',
    }];
    const request = { parentRecordType, idOptions, childOptions } as RelatedRecordRequest;
    return request;
}



