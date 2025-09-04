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
    isEmpty,
    isNumeric
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
    isAuthInitialized, deleteRecord,
    isRecordOptions,
    putSingleRecord,
    isFieldValue,
    isSublistUpdateDictionary
} from "./api";
import { CleanStringOptions, StringReplaceOptions, clean, extractFileName, extractLeaf } from "typeshi:utils/regex"
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators";
import { Factory } from "./api";

const F = extractFileName(__filename);

let placeholders: Required<RecordResult>[] | null = [];

type TransactionUpdateDictionary = {
    [tranInternalId: string]: TransactionLineItemUpdate
}

type TransactionLineItemUpdate = {
    tranType: RecordTypeEnum;
    replacements: ReplacementDetails[];
    fields?: FieldDictionary;
    originalTotal: number;
}

type ReplacementDetails = {
    newItemInternalId: string;
    newItemId: string;
    oldItemInternalId: string;
    quantity: number;
    rate: number;
}

type ReconcilerError = {
    readonly isError: true;
    source: string;
    message?: string;
    error?: any;
    [key: string]: any;
}

function ReconcilerError(
    source: string,
    message?: string,
    error?: any,
    ...details: any[]
): ReconcilerError {
    return { isError: true, source, message, error, details } as ReconcilerError;
}
function isReconcilerError(value: any): value is ReconcilerError {
    const candidate = value as ReconcilerError;
    return (isObject(candidate) 
        && isNonEmptyString(candidate.source)
        && (candidate.isError === true)
    );
}

type ReconcilerState = {
    /** map itemId to list of tranInternalId */
    firstUpdateCompleted: { 
        [itemId: string]: {
            [childRecordType: string]: string[],
        }
    };
    itemsDeleted: string[];
    newItems: Record<string, string>;
    /** map itemId to list of tranInternalId */
    secondUpdateCompleted:  { 
        [itemId: string]: {
            [childRecordType: string]: string[],
        }
    };
    errors: any[];
    [key: string]: any;
}

let createOptionsDict: { [itemId: string]: Required<RecordOptions> } | null = null;
export function getCreateOptions(itemId: string): RecordOptions {
    const source = getSourceString(F, getCreateOptions.name, itemId)
    if (!createOptionsDict) {
        throw new Error(`${source} createOptionsDict: { [itemId: string]: RecordOptions } has not been loaded yet`);
    }
    if (!hasKeys(createOptionsDict, itemId)) {
        throw new Error(`${source} itemId '${itemId}' is not a key in createOptionsDict`)
    }
    return createOptionsDict[itemId];
}

let moduleState: ReconcilerState | null = null;
export function getModuleState(): ReconcilerState {
    if (!moduleState) {
        throw new Error(`${getSourceString(F, getModuleState.name)} state has not been loaded yet`);
    }
    return moduleState;
}

function isReconcileState(value: any): value is ReconcilerState {
    const candidate = value as ReconcilerState;
    return (isObject(candidate)
        && isObject(candidate.firstUpdateCompleted, false)
        && (isEmptyArray(candidate.itemsDeleted) || isStringArray(candidate.itemsDeleted))
        && isObject(candidate.newItems, false)
        && isObject(candidate.secondUpdateCompleted, false)
    );
}
type SublistRecordReferenceOptions = { 
    referenceFieldId: string; 
    sublistId: string;
    cacheOptions: CacheOptions;
    responseOptions: Required<RecordResponseOptions>;
}
const revCacheOptions: CacheOptions = {
    fields: ['name'],
    sublists: {
        component: [
            'quantity', 'bomquantity', 'componentyield', 'description', 
            //'itemsource', 'itemsourcelist'
        ] 
    }
}
const revResponseOptions: Required<RecordResponseOptions> = {
    fields: ['externalid', 'billofmaterial', 'name'],
    sublists: { 
        component: [
            'internalid','item', 'quantity', 'bomquantity', 'unit', 'componentyield',
            'description', // 'itemsource', 'itemsourcelist'
        ]
    }

}
const soCacheOptions: CacheOptions = {
    fields: ['total'],
    sublists: {
        item: ['quantity', 'quantitybilled', 'rate']
    }
}
const soResponseOptions: Required<RecordResponseOptions> = {
    fields: ['externalid', 'tranid', 'amount', 'memo', 'total'],
    sublists: {
        item: ['id', 'item', 'quantity', 'rate', 'quantitybilled']
    }
}

/**
 * @TODO refactor
 */
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
    const statePath = path.join(wDir, 'reconcile_state.json');
    validate.existingFileArgument(source, '.json', {statePath});

    moduleState = read(statePath) as ReconcilerState;
    let state = getModuleState(); // because ReconcileState | null
    validate.objectArgument(source, {state, isReconcileState});

    placeholders = (read(path.join(wDir, 'item_placeholders.json')) as { 
        placeholders: Required<RecordResult>[]
    }).placeholders;
    validate.arrayArgument(source, {placeholders, isRecordResult});

    let lnii_data = read(path.join(wDir, 'lnii_options.json')) as { items: Required<RecordOptions>[] };
    validate.arrayArgument(source, {items: lnii_data.items, isRecordOptions});
    createOptionsDict = generateRecordDictionary(lnii_data.items);
    let addedPriceCount = 0;
    for (let itemId in createOptionsDict) {
        if (!isNonEmptyArray(createOptionsDict[itemId].sublists.price1)) {
            createOptionsDict[itemId].sublists.price1 = [{
                pricelevel: 1, 
                price: 0.00
            }]
            addedPriceCount++;
        }
    }
    slog.info([` -- createOptionsDict num times had to add price1 sublist: ${addedPriceCount}`,
        `-- reading in salesorder data and bomrevision data...`
    ].join(NL));

    let soData = read(
        path.join(wDir, 'item_to_salesorders.json')
    ) as {[itemId: string]: RecordResult[]} ?? {};
    if (isEmpty(soData)) {
        return ReconcilerError(source, `soData is empty`,
            `unable to read data from provided json path`
        );
    }
    const itemToSalesOrders = (Object.keys(soData)
        .reduce((acc, itemId) => {
            acc[itemId] = soData[itemId].map(r=>r.internalid);
            return acc;
        }, {} as { [itemId: string]: number[] })
    );
    slog.info([` -- read salesorder data into itemToSalesOrders`,
        `keys.length: ${Object.keys(itemToSalesOrders).length}`,
        `values.flat.length: ${Object.values(itemToSalesOrders).flat().length}`
    ].join(TAB));
    let revisionData = read(
        path.join(wDir, 'item_to_revisions.json')
    ) as {[itemId: string]: RecordResult[]} ?? {}
    if (isEmpty(revisionData)) {
        return ReconcilerError(source, `revisionData is empty`,
            `unable to read data from provided json path`
        );
    }
    const itemToRevisions = (Object.keys(revisionData)
        .reduce((acc, itemId)=> {
            acc[itemId] = revisionData[itemId].map(r=>r.internalid);
            return acc;
        }, {} as { [itemId: string]: number[] })
    );
    slog.info([` -- read bomrevision data into itemToRevisions`,
        `keys.length: ${Object.keys(itemToRevisions).length}`,
        `values.flat.length: ${Object.values(itemToRevisions).flat().length}`
    ].join(TAB));

    const itemDependentDict: {
        [itemId: string]: {
            [childRecordType: string | RecordTypeEnum]: number[]
        }
    } = {};
    let keys = Array.from(new Set([
        ...Object.keys(itemToSalesOrders), 
        ...Object.keys(itemToRevisions)
    ]));
    for (let itemId of keys) {
        if (!(itemId in getSkuDictionary())) {
            throw new Error(`${source} item '${itemId}' not in skuDictionary...`)
        }
    }
    for (let itemId of keys) {
        itemDependentDict[itemId] = {};
        if (itemId in itemToRevisions) {
            itemDependentDict[itemId][RecordTypeEnum.BOM_REVISION] = itemToRevisions[itemId];
        }
        if (itemId in itemToSalesOrders) {
            itemDependentDict[itemId][RecordTypeEnum.SALES_ORDER] = itemToSalesOrders[itemId];
        }
    }
    write(itemDependentDict, path.join(wDir, 'item_to_dependents.json'));
    const sublistReferenceDict: {
        [recordType: string]: SublistRecordReferenceOptions
    } = {
        [RecordTypeEnum.BOM_REVISION]: {
            referenceFieldId: 'item',
            sublistId: 'component',
            cacheOptions: revCacheOptions,
            responseOptions: revResponseOptions
        },
        [RecordTypeEnum.SALES_ORDER]: {
            referenceFieldId: 'item',
            sublistId: 'item',
            cacheOptions: soCacheOptions,
            responseOptions: soResponseOptions
        }
    }
    itemLoop:
    for (let itemId in itemDependentDict) {
        childTypeLoop:
        for (let childRecordType in itemDependentDict[itemId]) {
            if (!hasKeys(sublistReferenceDict, childRecordType)) {
                mlog.error(`${source} missing childRecordType '${childRecordType}' from config...`)
                break itemLoop;
            }
            const childUpdateDict = await generateReferenceUpdateDictionary(
                itemId, 
                getSkuDictionary()[itemId], 
                RecordTypeEnum.INVENTORY_ITEM, 
                childRecordType as RecordTypeEnum,
                itemDependentDict[itemId][childRecordType],
                sublistReferenceDict[childRecordType]
            );
            childUpdateLoop:
            for (let childInternalId in childUpdateDict) {
                let update: ReferenceFieldUpdate = childUpdateDict[childInternalId];
            }
        }
    }
    




    write(state, statePath);
}

/**
 * @consideration change name back to processSublistReferenceUpdate; worry about abstracting to body fields later...  
 */
async function processReferenceUpdate(
    parentItemId: string,
    childRecordType: RecordTypeEnum,
    childInternalId: string, 
    update: ReferenceFieldUpdate,
    responseOptions?: RecordResponseOptions
): Promise<any | ReconcilerError> {
    const source = getSourceString(F, processReferenceUpdate.name, parentItemId);
    validate.stringArgument(source, {parentItemId});
    validate.objectArgument(source, {update, isReferenceFieldUpdate});
    if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});

    mlog.info(`${source} START`);
    const { 
        referenceFieldId, sublistId, oldReference, 
        validationDictionary, lineCache
    } = update as ReferenceFieldUpdate;
    if (childRecordType !== update.recordType) {
        return ReconcilerError(source, `recordType inconsistency`,
            `Invalid parameters: childRecordType !== update.recordType`,
            `childRecordType: '${childRecordType}'`,
            `update.recordType: '${update.recordType}'`
        )
    }
    const findLineWithOldReference: FindSublistLineWithValueOptions = {
        sublistId, fieldId: referenceFieldId, value: oldReference
    }
    let lastResult: Required<RecordResult> | null = null;
    let refKeys = Object.keys(lineCache);
    for (let i = 0; i < refKeys.length; i++) {
        let newReferenceId = refKeys[i];
        let cachedLine = lineCache[newReferenceId];
        const recordOptions = Factory.RecordOptions(
            childRecordType,
            Factory.idSearchOptions(idPropertyEnum.INTERNAL_ID, childInternalId)
        );
        const sublistUpdateDict: SublistUpdateDictionary = Object.keys(cachedLine).reduce((acc, fieldId)=>{
            acc[fieldId] = {
                newValue: cachedLine[fieldId],
                lineIdOptions: findLineWithOldReference
            }
            return acc
        }, {} as SublistUpdateDictionary);
        recordOptions.sublists[sublistId] = sublistUpdateDict;
        try {
            let putResponse = await putSingleRecord(recordOptions, responseOptions);
            let result = putResponse.results[0];
            let validationResult = validateUpdateResult(result, validationDictionary);
            if (isReconcilerError(validationResult)) {
                return validationResult;
            }
            if (result && i === refKeys.length-1) {
                lastResult = result as Required<RecordResult>;
            }
        } catch (error: any) {
            return ReconcilerError(source, 
                `encountered error during ${putSingleRecord.name}() or ${validateUpdateResult.name}()`,
                error
            );
        }

    }
}

/**
 * @param result 
 * @param validationDictionary
 * @returns `error` `if` some `result.fields[fieldId] !== validationDictionary[fieldId]` 
 */
function validateUpdateResult(
    result: RecordResult,
    validationDictionary: { [fieldId: string]: FieldValue }
): undefined | ReconcilerError {
    const source = getSourceString(F, validateUpdateResult.name);
    validate.objectArgument(source, {result, isRecordResult});
    result.fields = isObject(result.fields) ? result.fields : {};
    for (let fieldId in validationDictionary) {
        if (String(result.fields[fieldId]) !== String(validationDictionary[fieldId])) {
            return ReconcilerError(source, `encountered invalid update result`,
                `Invalid Update Result upon comparing cached values`,
                `String(result.fields[fieldId]) !== String(validationDictionary[fieldId])`,
                `fieldId: '${fieldId}'`,
                `       String(result.fields[fieldId]): '${String(result.fields[fieldId])}'`,
                `String(validationDictionary[fieldId]): '${String(validationDictionary[fieldId])}'`
            )
        }
    }
}



type ReferenceFieldUpdate = {
    recordType: RecordTypeEnum;
    sublistId: string;
    referenceFieldId: string;
    /** old internalid value*/
    oldReference: string;
    validationDictionary: { [fieldId: string]: FieldValue };
    /**
     * @keys = new internalid value
     * */
    lineCache: {
        [newReference: string]: { [sublistFieldId: string]: FieldValue }   
    };
}

function isReferenceFieldUpdate(value: any): value is ReferenceFieldUpdate {
    const candidate = value as ReferenceFieldUpdate;
    return (isObject(candidate) 
        && isRecordTypeEnum(candidate.recordType)
        && isNonEmptyString(candidate.sublistId) // need to make optional if abstract to allow body fields...   
        && isNonEmptyString(candidate.referenceFieldId)
        && isNumeric(candidate.oldReference)
        && isObject(candidate.validationDictionary, false)
        && isObject(candidate.lineCache, false) 
        && (Object.keys(candidate.lineCache)
            .every(newReferenceId=>isNumeric(newReferenceId) 
                && isObject(candidate.lineCache[newReferenceId])
            )
        )
    )
}

type CacheOptions = Required<RecordResponseOptions>;

/**
 * @parent is the record such that `childRecord.sublists[sublistId][referenceFieldId] = parentInternalId`
 * @returns **`dictionary`** `{ [childRecordId: string]: SublistLineRecordReferenceFieldUpdate }`
 */
async function generateReferenceUpdateDictionary(
    parentItemId: string,
    parentInternalId: string,
    parentRecordType: RecordTypeEnum,
    childRecordType: RecordTypeEnum,
    childInternalIds: number[],
    referenceOptions: SublistRecordReferenceOptions
): Promise<{
    [childRecordId: string]: ReferenceFieldUpdate
}> {
    const source = getSourceString(F, generateReferenceUpdateDictionary.name, parentItemId);
    const { referenceFieldId, sublistId, responseOptions: childResponseOptions, cacheOptions} = referenceOptions;
    validate.enumArgument(source, {parentRecordType, RecordTypeEnum});
    validate.enumArgument(source, {childRecordType, RecordTypeEnum});
    validate.multipleStringArguments(source, {parentItemId, referenceFieldId, sublistId, parentInternalId});
    validate.objectArgument(source, {childResponseOptions, isRecordResponseOptions})
    validate.objectArgument(source, {cacheOptions, isRecordResponseOptions});
    validate.arrayArgument(source, {childRecordIds: childInternalIds, isIntegerArray});
    if (!placeholders && !isNonEmptyArray(placeholders)) {
        mlog.error(`${source} Cannot handle replacement without instantiation of placeholders`)
        throw new Error(
            `${source} Cannot handle replacement without instantiation of placeholders`
        );
    }
    const dict: {
        [childRecordId: string]: ReferenceFieldUpdate
    } = {};
    for (let i = 0; i < childInternalIds.length; i++) {
        const childInternalId = String(childInternalIds[i]);
        let child = (await getRecordById(
            Factory.SingleRecordRequest(childRecordType, idPropertyEnum.INTERNAL_ID, childInternalId, childResponseOptions)
        )).results[0] as Required<RecordResult>;
        if (!child) {
            mlog.error([`${source} initialChild is undefined`,
                `at childRecordIds[${i}]`,
            ].join(TAB));
            break;
        }
        if (!hasKeys(child.sublists, sublistId)) {
            mlog.error([`${source} child's sublist is undefined`,
                `at childRecordIds[${i}]`,
                `from <${childRecordType}>RecordResult.sublists['${sublistId}']`,
            ].join(TAB));
            break;
        }
        const update = {
            recordType: childRecordType, 
            referenceFieldId: referenceFieldId, 
            sublistId,
            oldReference: parentInternalId, 
            validationDictionary: {},
            lineCache: {}
        } as ReferenceFieldUpdate;
        cacheOptions.fields = (isStringArray(cacheOptions.fields) 
            ? cacheOptions.fields
            : [cacheOptions.fields]
        )
        for (let cacheFieldId in cacheOptions.fields) {
            let cacheValue = child.fields[cacheFieldId];
            if (isFieldValue(cacheValue)) {
                update.validationDictionary[cacheFieldId] = cacheValue
            } else {
                mlog.error([`${source} Invalid FieldValue in get child.fields`,
                    `at childRecordIds[${i}]`,
                    `when setting update.parentValidationDictionary['${cacheFieldId}']`,
                    `from <${childRecordType}>RecordResult.fields['${cacheFieldId}']`,
                    `-- <${childRecordType}>RecordResult.fields['${cacheFieldId}'] = ${cacheValue}`
                ].join(TAB));
                break;
            }
        }
        let sublistLines = child.sublists[sublistId] ?? [];
        let targetLines = getLinesWithSublistFieldValue(sublistLines, referenceFieldId, parentInternalId);
        let sublistCacheFields = (isStringArray(cacheOptions.sublists[sublistId]) 
            ? cacheOptions.sublists[sublistId]
            : [cacheOptions.sublists[sublistId]]
        )
        validate.arrayArgument(source, {sublistCacheFields, isStringArray});
        for (let j = 0; j < targetLines.length; j++) {
            const line = targetLines[j];
            let lineCache = sublistCacheFields.reduce((acc, sublistFieldId)=>{
                if (isFieldValue(line[sublistFieldId])) {
                    acc[sublistFieldId] = line[sublistFieldId]
                }
                return acc;
            }, {} as {[fieldId: string]: FieldValue});
            let newReferenceValue = String(placeholders[j].internalid);
            update.lineCache[newReferenceValue] = lineCache;
        }
        dict[childInternalId] = update;
    }
    return dict;
}

function generateRecordDictionary(
    records: Required<RecordOptions>[],
    idField: string | idPropertyEnum = idPropertyEnum.ITEM_ID,
    recordType: RecordTypeEnum = RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM
): { [itemId: string]: Required<RecordOptions> } {
    const source = getSourceString(F, generateRecordDictionary.name);
    const dict: { [itemId: string]: Required<RecordOptions> } = {};
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (recordType && record.recordType !== recordType) {
            mlog.error([`${source} Encountered unexpected recordType at records[${i}]`,
                `expected: '${recordType}'`
            ].join(TAB));
            throw new Error(`${source} Invalid record.recordType at records[${i}]`)
        }
        let idValue = record.fields[idField] ?? '';
        if (!isNonEmptyString(idValue)) {
            mlog.error([`${source} Unable to get idValue from record.fields`,
                `at records[${i}]`,
                `idField: '${idField}'`
            ].join(TAB));
            throw new Error([`${source} Unable to get idValue from record.fields`
            ].join(TAB));
        }
        dict[idValue] = record;
    }

    return dict;
}

async function hasDependentRecords(
    itemId: string,
    parentRecordType: RecordTypeEnum,
    childOptions: ChildSearchOptions[]
): Promise<boolean | ReconcilerError> {
    const source = getSourceString(F, hasDependentRecords.name, itemId);
    let result: RecordResult | null = null;
    try {
        let getRes = await getRecordById(
            Factory.SingleRecordRequest(parentRecordType, idPropertyEnum.ITEM_ID, itemId)
        );
        result = getRes.results[0] 
    } catch (error: any) {
        return ReconcilerError(source, 
            `${source} error occurred when calling ${getRecordById.name}`,
            error
        );
    }
    if (!result) {
        return ReconcilerError(source, 
            `get request failed, unable to check for dependents`,
            `no results from getRecordById(itemId: '${itemId}')`
        );
    }
    const itemInternalId = result.internalid;
    try {
        let getRes = await getRelatedRecord(Factory.RelatedRecordRequest(
            parentRecordType, idPropertyEnum.INTERNAL_ID, itemInternalId, childOptions
        ));
        let results = getRes.results ?? [];
        return results.length > 0;
    } catch (error: any) {
        return ReconcilerError(source, 
            `${source} error occurred when calling ${getRelatedRecord.name}`,
            error
        );
    }
}

const tranTypePattern = new RegExp(/(?<=\()[\sA-Z]+(?=\)<[a-z]+>$)/i);
/**
 * handle this later...
 * @param memo 
 * @param stringReplaceOptions 
 * @returns 
 */
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