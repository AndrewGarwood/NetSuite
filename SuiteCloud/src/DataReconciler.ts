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
    getProjectFolders, isEnvironmentInitialized, isDataInitialized,
    setSkuInternalId
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
    autoFormatLogsOnExit,
    RowSourceMetaData,
    isRowSourceMetaData
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
import { CLEAN_ITEM_ID_OPTIONS, unitType } from "src/parse_configurations/evaluators";
import { Factory } from "./api";
import { ItemColumnEnum } from "src/parse_configurations/item/itemConstants";
import { deleteItem } from "src/pipelines";
/** name of current file */
const F = extractFileName(__filename);

let placeholders: Required<RecordResult>[] | null = [];

type ReconcilerError = {
    readonly isError: true;
    source: string;
    message?: string;
    error?: any;
    [key: string]: any;
}

function ReconcilerError(
    source?: string,
    message?: string,
    error?: any,
    ...details: any[]
): ReconcilerError {
    return { 
        isError: true, 
        source: (isNonEmptyString(source) 
            ? source 
            : getSourceString(F, ReconcilerError.name, 'UNKNOWN_STAGE')
        ), 
        message, 
        error, 
        details 
    } as ReconcilerError;
}
function isReconcilerError(value: any): value is ReconcilerError {
    const candidate = value as ReconcilerError;
    return (isObject(candidate) 
        && isNonEmptyString(candidate.source)
        && (candidate.isError === true)
    );
}

type ReconcilerState = {
    stage: ItemReconcilerStageEnum;
    /** map `itemId` to list of `childRecordInternalId` */
    firstUpdate: { 
        [itemId: string]: {
            [childRecordType: string]: string[],
        }
    };
    itemsDeleted: string[];
    newItems: Record<string, string>;
    /** map `itemId` to list of `childRecordInternalId` */
    secondUpdate:  { 
        [itemId: string]: {
            [childRecordType: string]: string[],
        }
    };
    errors: any[];
    [key: string]: any;
}

let createOptionsDict: { [itemId: string]: Required<RecordOptions> } | null = null;
export function getCreateOptions(itemId: string): Required<RecordOptions> {
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

function isReconcilerState(value: any): value is ReconcilerState {
    const candidate = value as ReconcilerState;
    return (isObject(candidate)
        && isObject(candidate.firstUpdate, false)
        && (isEmptyArray(candidate.itemsDeleted) || isStringArray(candidate.itemsDeleted))
        && isObject(candidate.newItems, false)
        && isObject(candidate.secondUpdate, false)
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
enum ItemReconcilerStageEnum {
    PRE_PROCESS = 'PRE_PROCESS',
    GENERATE_PLACEHOLDER_UPDATE = 'GENERATE_PLACEHOLDER_UPDATE',
    RUN_PLACEHOLDER_UPDATE = 'RUN_PLACEHOLDER_UPDATE',
    VALIDATE_FIRST_UPDATE = 'VALIDATE_FIRST_UPDATE',
    DELETE_OLD_ITEM = 'DELETE_OLD_ITEM',
    CREATE_NEW_ITEM = 'CREATE_NEW_ITEM',
    GENERATE_NEW_ITEM_UPDATE = 'GENERATE_NEW_ITEM_UPDATE',
    RUN_NEW_ITEM_UPDATE = 'RUN_NEW_ITEM_UPDATE'
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
    let state = getModuleState(); // because ReconcilerState | null
    validate.objectArgument(source, {state, isReconcilerState});
    state.stage = ItemReconcilerStageEnum.PRE_PROCESS;
    placeholders = (read(path.join(wDir, 'item_placeholders.json')) as { 
        placeholders: Required<RecordResult>[]
    }).placeholders;
    validate.arrayArgument(source, {placeholders, isRecordResult});

    let lnii_data = read(path.join(wDir, 'lnii_options.json')) as { items: Required<RecordOptions>[] };
    validate.arrayArgument(source, {items: lnii_data.items, isRecordOptions});
    let dataSource = lnii_data.items[0].meta.dataSource ?? {};
    const [originalFilePath] = Object.keys(dataSource);
    let fileName = extractFileName(originalFilePath, false);
    let filePath = path.join(getProjectFolders().dataDir, 'accounting', 'items', fileName);
    validate.existingFileArgument(source, '.tsv', {filePath});
    let sourceRows = await getRows(filePath);
    for (let record of lnii_data.items) {
        if (!record.fields.unitstype) {
            let dataSource = record.meta.dataSource as RowSourceMetaData;
            validate.objectArgument(source, {dataSource, isRowSourceMetaData});
            let [rowIndex] = dataSource[originalFilePath];
            validate.numberArgument(source, {rowIndex}, true);
            const row = sourceRows[rowIndex];
            record.fields.unitstype = await unitType(row, ItemColumnEnum.UNIT_OF_MEASUREMENT);
        }
    }
    createOptionsDict = generateRecordDictionary(lnii_data.items);
    let addedPriceCount = 0;
    for (let itemId in createOptionsDict) {
        if (createOptionsDict[itemId].fields.unitstype === undefined) {
            throw new Error([`${source} Invalid RecordOptions in lnii_data`,
                `itemId: '${itemId}'`,
                `missing requiredField: 'unitstype'`,
            ].join(TAB));
        }
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
    let itemKeys = Object.keys(itemToSalesOrders); // itemToSalesOrders, itemToRevisions keys are same
    // = Array.from(new Set([
    //     ...Object.keys(itemToSalesOrders), 
    //     ...Object.keys(itemToRevisions)
    // ]));
    // mlog.debug(`itemToSalesOrders, itemToRevisions keys are same ? ${
    //     Object.keys(itemToSalesOrders).length === Object.keys(itemToRevisions).length
    //     && Object.keys(itemToSalesOrders).every(k=>Object.keys(itemToRevisions).includes(k))
    // }`);
    for (let itemId of itemKeys) {
        if (!(itemId in getSkuDictionary())) {
            throw new Error(`${source} item '${itemId}' not in skuDictionary...`)
        }
    }
    for (let itemId of itemKeys) {
        itemDependentDict[itemId] = {};
        if (itemId in itemToRevisions) {
            itemDependentDict[itemId][RecordTypeEnum.BOM_REVISION] = itemToRevisions[itemId];
        }
        if (itemId in itemToSalesOrders) {
            itemDependentDict[itemId][RecordTypeEnum.SALES_ORDER] = itemToSalesOrders[itemId];
        }
    }
    write(itemDependentDict, path.join(wDir, 'item_to_dependents.json'));
    itemLoop:
    for (let itemId of Object.keys(itemDependentDict).slice(0,2)) {
        if (!state.firstUpdate[itemId]) {
            state.firstUpdate[itemId] = {};
        }
        const itemInternalId = getSkuDictionary()[itemId];
        let firstUpdateDict: {
            [childRecordType: string]: {
                [childInternalId: string]: ReferenceFieldUpdate;
            } 
        } = {};
        firstUpdateLoop:
        for (let childRecordType in itemDependentDict[itemId]) {
            if (!state.firstUpdate[itemId][childRecordType]) {
                state.firstUpdate[itemId][childRecordType] = [];
            }
            if (!hasKeys(sublistReferenceDict, childRecordType)) {
                mlog.error(`${source} missing childRecordType '${childRecordType}' from config...`)
                break itemLoop;
            }
            firstUpdateDict[childRecordType] = {};
            firstChildLoop:
            for (let childInternalId of itemDependentDict[itemId][childRecordType]) {
                if (state.firstUpdate[itemId][childRecordType].includes(String(childInternalId))) {
                    continue firstChildLoop;
                }
                state.stage = ItemReconcilerStageEnum.GENERATE_PLACEHOLDER_UPDATE;
                let update = await generateReferenceUpdate(
                    itemId, 
                    itemInternalId, 
                    RecordTypeEnum.INVENTORY_ITEM,
                    childRecordType as RecordTypeEnum,
                    childInternalId, 
                    sublistReferenceDict[childRecordType],
                    placeholders.map(p=>p.internalid)
                );
                if (isReconcilerError(update)) {
                    mlog.error([`${source} ${generateReferenceUpdate.name} returned error value`,
                        `error: `, indentedStringify(update)
                    ].join(TAB))
                    state.errors.push({itemId, 
                        stage: state.stage, 
                        childRecordType, 
                        childInternalId, 
                        error: update
                    });
                    break itemLoop;
                }
                firstUpdateDict[childRecordType][childInternalId] = update;
                state.stage = ItemReconcilerStageEnum.RUN_PLACEHOLDER_UPDATE;
                let updateResult = await processReferenceUpdate(
                    itemId, 
                    childRecordType as RecordTypeEnum, 
                    childInternalId, 
                    update, 
                    sublistReferenceDict[childRecordType].responseOptions
                )
                if (isReconcilerError(updateResult)) {
                    mlog.error([`${source} ${processReferenceUpdate.name} returned error value`,
                        `error: `, indentedStringify(updateResult)
                    ].join(TAB));
                    state.errors.push({itemId, 
                        stage: state.stage, 
                        childRecordType, 
                        childInternalId, 
                        error: updateResult
                    });
                    break itemLoop;
                }
                state.firstUpdate[itemId][childRecordType].push(String(childInternalId));
            }
        }
        state.stage = ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE;
        let stillHasDependents = await hasDependentRecords(
            itemId, 
            RecordTypeEnum.INVENTORY_ITEM,
            Object.keys(itemDependentDict[itemId]).reduce((acc, childRecordType)=> {
                acc.push(Factory.ChildSearchOptions(
                    childRecordType as RecordTypeEnum, 
                    sublistReferenceDict[childRecordType].referenceFieldId, 
                    sublistReferenceDict[childRecordType].sublistId
                ));
                return acc;
            }, [] as ChildSearchOptions[])
        );
        if (isReconcilerError(stillHasDependents)) {
            mlog.error(`${source} hasDependentRecords returned error`,
                stillHasDependents
            );
            state.errors.push({itemId, stage: state.stage, error: stillHasDependents});
            break itemLoop;
        }
        let safeToDelete = (Object.keys(state.firstUpdate[itemId])
            .every(childRecordType=>{
                let actualProcessCount = state.firstUpdate[itemId][childRecordType].length;
                let expectedProcessCount = itemDependentDict[itemId][childRecordType].length;
                return actualProcessCount === expectedProcessCount;
            }) && !stillHasDependents
        );
        if (!safeToDelete) {
            slog.info(` -- safeToDelete === false, continuing itemLoop`);
            state.errors.push({itemId, stage: state.stage, safeToDelete, stillHasDependents});
            continue itemLoop;
        }
        if (!state.itemsDeleted.includes(itemId)) {
            state.stage = ItemReconcilerStageEnum.DELETE_OLD_ITEM;
            let deleteRes = await deleteItem(itemId, RecordTypeEnum.INVENTORY_ITEM);
            if (!deleteRes) {
                mlog.error([`${source} deleteItem response is null`,
                    `itemId: '${itemId}'`
                ].join(TAB));
                state.errors.push({itemId, stage: state.stage, message: `${source} deleteItem response is null`});
                break itemLoop;
            }
            state.itemsDeleted.push(itemId);
        }
        let newItemInternalId: string | null = null;
        if (!(itemId in state.newItems)) {
            state.stage = ItemReconcilerStageEnum.CREATE_NEW_ITEM;
            try {
                const createOptions = getCreateOptions(itemId);
                let createRes = await putSingleRecord(createOptions);
                newItemInternalId = String((createRes.results[0] ?? {internalid: undefined}).internalid);
                validate.numericStringArgument(source, {newItemInternalId});
            } catch (error: any) {
                mlog.error([`${source} error when creating new item`,
                    `itemId: '${itemId}'`
                ].join(TAB), error);
                state.errors.push({itemId, message: `${source} error when creating new item`, stage: state.stage})
                break itemLoop;
            }
            setSkuInternalId(itemId, newItemInternalId);
            slog.info([` -- Recreated item '${itemId}'`,
                `newInternalId: '${newItemInternalId}'`,
                `oldInternalId: '${itemInternalId}'`
            ].join(TAB));
            state.newItems[itemId] = newItemInternalId;
        } else {
            newItemInternalId = state.newItems[itemId];
        }
        
        if (!state.secondUpdate[itemId]) {
            state.secondUpdate[itemId] = {};
        }
        secondUpdateLoop:
        for (let childRecordType in firstUpdateDict) {
            if (!state.secondUpdate[itemId][childRecordType]) {
                state.secondUpdate[itemId][childRecordType] = [];
            }
            secondChildLoop:
            for (let childInternalId in firstUpdateDict[childRecordType]) {
                if (state.secondUpdate[itemId][childRecordType].includes(childInternalId)) {
                    continue secondChildLoop;
                }
                const prevUpdate = firstUpdateDict[childRecordType][childInternalId];
                for (const placeholderId in prevUpdate.lineCache) {
                    state.stage = ItemReconcilerStageEnum.GENERATE_NEW_ITEM_UPDATE;
                    const newUpdate = {
                        recordType: prevUpdate.recordType,
                        sublistId: sublistReferenceDict[childRecordType].sublistId,
                        referenceFieldId: sublistReferenceDict[childRecordType].referenceFieldId,
                        oldReference: placeholderId,
                        validationDictionary: prevUpdate.validationDictionary,
                        lineCache: { [newItemInternalId]: prevUpdate.lineCache[placeholderId] }
                    } as ReferenceFieldUpdate;
                    state.stage = ItemReconcilerStageEnum.RUN_NEW_ITEM_UPDATE;
                    let updateResult = await processReferenceUpdate(itemId, 
                        childRecordType as RecordTypeEnum,
                        childInternalId, 
                        newUpdate, 
                        sublistReferenceDict[childRecordType].responseOptions
                    )
                    if (isReconcilerError(updateResult)) {
                        mlog.error([`${source} secondUpdateLoop -> ${
                            processReferenceUpdate.name} returned error`,
                            state.errors.push({itemId, childRecordType, childInternalId, oldReference: placeholderId, stage: state.stage}),
                            `error: `, 
                            updateResult
                        ].join(TAB));
                        break itemLoop;
                    }
                }
                state.secondUpdate[itemId][childRecordType].push(childInternalId);
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
    childInternalId: string | number, 
    update: ReferenceFieldUpdate,
    responseOptions?: RecordResponseOptions
): Promise<undefined | ReconcilerError> {
    const source = getSourceString(F, processReferenceUpdate.name, parentItemId);
    try {
        validate.stringArgument(source, {parentItemId});
        validate.objectArgument(source, {update, isReferenceFieldUpdate});
        if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    } catch (error: any) {
        return ReconcilerError(source, `Invalid parameters received`, indentedStringify(error));
    }
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
    let childRecord: Required<RecordResult>;
    try {
        let getRes = await getRecordById(Factory.SingleRecordRequest(
            childRecordType, 
            idPropertyEnum.INTERNAL_ID, 
            childInternalId,
            responseOptions
        ));
        let [result] = getRes.results;
        validate.objectArgument(source, {result, isRecordResult});
        validate.objectArgument(source, {childSublistDictionary: result.sublists});
        childRecord = result as Required<RecordResult>;
    } catch (error: any) {
        return ReconcilerError(source, `Failed to get initial record response to store cache values before update`, indentedStringify(error));
    }
    let refKeys = Object.keys(lineCache);
    let targetLines = getLinesWithSublistFieldValue(
        childRecord.sublists[sublistId], 
        referenceFieldId, 
        oldReference
    ) as { [sublistFieldId: string]: FieldValue }[];
    mlog.debug([`${source} targetLines.length should be equal to Object.keys(lineCache).length ?`,
        `targetLines.length: ${targetLines.length}`,
        `    refKeys.length: ${refKeys.length}`,
        `refKeys.length === targetLines.length ? ${refKeys.length === targetLines.length}`
    ].join(TAB));
    if (refKeys.length !== targetLines.length) {
        mlog.error(`let's pause and review ....`);
        STOP_RUNNING(1);
    }
    const findLineWithOldReference: FindSublistLineWithValueOptions = {
        sublistId, fieldId: referenceFieldId, value: oldReference
    }
    let lastResult: Required<RecordResult> | null = null;
    for (let i = 0; i < refKeys.length; i++) {
        let newReferenceId = refKeys[i];
        let cachedLine = lineCache[newReferenceId];
        const recordOptions = Factory.RecordOptions(
            childRecordType,
            Factory.idSearchOptions(idPropertyEnum.INTERNAL_ID, childInternalId)
        );
        const sublistUpdateDict: SublistUpdateDictionary = Object.keys(cachedLine).reduce((acc, sublistFieldId)=>{
            acc[sublistFieldId] = {
                newValue: cachedLine[sublistFieldId],
                lineIdOptions: findLineWithOldReference
            }
            return acc
        }, {} as SublistUpdateDictionary);
        recordOptions.sublists[sublistId] = sublistUpdateDict;
        try {
            validate.objectArgument(source, {sublistUpdateDict, isSublistUpdateDictionary});
            validate.objectArgument(source, {recordOptions, isRecordOptions});
            let putResponse = await putSingleRecord(recordOptions, responseOptions);
            let result = putResponse.results[0];
            let validationResult = validateResultFields(result, validationDictionary);
            if (isReconcilerError(validationResult)) {
                return validationResult;
            }
            if (result && i === refKeys.length - 1) {
                lastResult = result as Required<RecordResult>;
            }
        } catch (error: any) {
            return ReconcilerError(source, 
                `encountered error during ${putSingleRecord.name}() or ${validateResultFields.name}()`,
                error
            );
        }
    } // end refKeyLoop

    if (lastResult) { // make sure old reference is gone and all updates went through.
        let newReferenceIds = Object.keys(update.lineCache);
        let sublistLines = lastResult.sublists[sublistId] ?? [];
        let linesWithNewReference = getLinesWithSublistFieldValue(sublistLines, referenceFieldId, ...newReferenceIds);
        let linesWithOldReference = getLinesWithSublistFieldValue(sublistLines, referenceFieldId, oldReference);
        if (linesWithOldReference.length > 0
            || newReferenceIds.length !== linesWithNewReference.length) {
            return ReconcilerError(source,
                `Update failed`, 
                `Invalid lastResult.sublists['${sublistId}']`, 
                [   
                    `   oldReference: ${oldReference}`,
                    `newReferenceIds: ${newReferenceIds.join(', ')}`,
                    `linesWithOldReference.length > 0 ? ${linesWithOldReference.length > 0}`,
                    `linesWithNewReference.length: ${linesWithNewReference.length}`,
                    `      newReferenceIds.length: ${newReferenceIds.length}`   
                ].join(TAB)
            );
        }
    }
    return;
}

/**
 * @param result 
 * @param validationDictionary
 * @returns `error` `if` some `result.fields[fieldId] !== validationDictionary[fieldId]` 
 */
function validateResultFields(
    result: RecordResult,
    validationDictionary: { [fieldId: string]: FieldValue }
): undefined | ReconcilerError {
    const source = getSourceString(F, validateResultFields.name);
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
     * ideally, num keys in lineCache = number of lines where `line[referenceFieldId] = oldReference`
     * @keys new `internalid` value
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
async function generateReferenceUpdate(
    parentItemId: string,
    oldReferenceId: string,
    parentRecordType: RecordTypeEnum,
    childRecordType: RecordTypeEnum,
    childInternalId: string | number,
    referenceOptions: SublistRecordReferenceOptions,
    newReferenceIds: string[] | number[]
): Promise<ReferenceFieldUpdate | ReconcilerError> {
    const source = getSourceString(F, generateReferenceUpdate.name, 
        JSON.stringify({parentItemId, childRecordType, childInternalId})
    );
    const { 
        referenceFieldId, 
        sublistId, 
        responseOptions: childResponseOptions, 
        cacheOptions
    } = referenceOptions;
    try {
        validate.multipleStringArguments(source, {
            parentItemId, referenceFieldId, sublistId, oldReferenceId}
        );
        validate.numericStringArgument(source, {childInternalId}, true, true)
        validate.enumArgument(source, {parentRecordType, isRecordTypeEnum});
        validate.enumArgument(source, {childRecordType, isRecordTypeEnum});
        validate.objectArgument(source, {childResponseOptions, isRecordResponseOptions})
        validate.objectArgument(source, {cacheOptions, isRecordResponseOptions});
        validate.arrayArgument(source, {newReferenceIds, isNumeric});
    } catch (error: any) {
        return ReconcilerError(source, `Invalid parameters`, indentedStringify(error));
    }

    childInternalId = String(childInternalId);
    newReferenceIds = (isIntegerArray(newReferenceIds) 
        ? newReferenceIds.map(id=>String(id)) 
        : newReferenceIds
    ) as string[];
    let child: Required<RecordResult>;
    try {
        child = (await getRecordById(
            Factory.SingleRecordRequest(
                childRecordType, 
                idPropertyEnum.INTERNAL_ID, 
                childInternalId, 
                childResponseOptions
            )
        )).results[0] as Required<RecordResult>;
    } catch (error: any) {
        return ReconcilerError(source,`Error when calling ${getRecordById.name}`,error)
    }
    if (!isRecordResult(child) || !isObject(child.sublists) || !hasKeys(child.sublists, sublistId)) {
        return ReconcilerError(source, `Unable to access child.sublists[sublistId]`,
            `${source} child's sublist is undefined`,
            `from <${childRecordType}>RecordResult.sublists['${sublistId}']`,
            `isRecordResult(child) ? ${isRecordResult(child)}`
        )
    }
    const update = {
        recordType: childRecordType, 
        referenceFieldId: referenceFieldId, 
        sublistId,
        oldReference: oldReferenceId, 
        validationDictionary: {},
        lineCache: {}
    } as ReferenceFieldUpdate;
    // ========================================================================
    // handle update.validationDictionary
    // ========================================================================
    cacheOptions.fields = (isStringArray(cacheOptions.fields) 
        ? cacheOptions.fields
        : [cacheOptions.fields]
    )
    for (let cacheFieldId of cacheOptions.fields) {
        let cacheValue = child.fields[cacheFieldId];
        if (!hasKeys(child.fields, [cacheFieldId])) {
            return ReconcilerError(source,
                `Error processing cacheOptions.fields`,
                `hasKeys(child.fields, cacheFieldId) === false`,
                `cacheFieldId: '${cacheFieldId}'`,
                `child.fields: ${indentedStringify(child.fields)}`
            );
        }
        if (isFieldValue(cacheValue)) {
            update.validationDictionary[cacheFieldId] = cacheValue
        } else {
            return ReconcilerError(source, 
                `Invalid FieldValue in get child.fields`,
                `Unable to store value to validationDictionary`, 
                [
                    `${source} Invalid FieldValue in get child.fields`,
                    `when setting update.parentValidationDictionary['${cacheFieldId}']`,
                    `from <${childRecordType}>RecordResult.fields['${cacheFieldId}']`,
                    `-- <${childRecordType}>RecordResult.fields['${cacheFieldId}'] = ${cacheValue}`
                ].join(TAB)
            );
        }
    }
    // ========================================================================
    // handle update.lineCache
    // ========================================================================
    let sublistLines = child.sublists[sublistId] ?? [];
    let targetLines = getLinesWithSublistFieldValue(
        sublistLines, referenceFieldId, oldReferenceId
    );
    newReferenceIds = newReferenceIds.slice(0, targetLines.length)
    if (targetLines.length > newReferenceIds.length && newReferenceIds.length !== 1) {
        return ReconcilerError(source,
            `Unable to associate new reference id's to each occurrence of oldReferenceId`,
            `targetLines.length > newReferenceIds.length && newReferenceIds.length !== 1`
        );
    }
    let sublistCacheFields = (isStringArray(cacheOptions.sublists[sublistId]) 
        ? cacheOptions.sublists[sublistId]
        : [cacheOptions.sublists[sublistId]]
    );
    for (let j = 0; j < targetLines.length; j++) {
        const line = targetLines[j];
        let lineCache = sublistCacheFields.reduce((acc, sublistFieldId)=>{
            if (isFieldValue(line[sublistFieldId])) {
                acc[sublistFieldId] = line[sublistFieldId]
            }
            return acc;
        }, {} as { [sublistFieldId: string]: FieldValue });
        let newReferenceValue = (newReferenceIds.length === 1 
            ? newReferenceIds[0] 
            : newReferenceIds[j]
        );
        if (isEmpty(newReferenceValue)) {
            return ReconcilerError(source, `Invalid newReferenceId value`,
                `isEmpty(newReferenceValue) === true`,
                `index out of bounds or something?`
                
            )
        }
        update.lineCache[newReferenceValue] = lineCache;
    }
    return update;
}


/**
 * @parent is the record such that `childRecord.sublists[sublistId][referenceFieldId] = parentInternalId`
 * @returns **`dictionary`** `{ [childRecordId: string]: SublistLineRecordReferenceFieldUpdate }`
 */
async function PREV_generateReferenceUpdateDictionary(
    parentItemId: string,
    parentInternalId: string,
    parentRecordType: RecordTypeEnum,
    childRecordType: RecordTypeEnum,
    childInternalIds: string[] | number[],
    referenceOptions: SublistRecordReferenceOptions,
    newReferenceIds: string[] | number[]
): Promise<{
    [childRecordId: string]: ReferenceFieldUpdate
}> {
    const source = getSourceString(F, PREV_generateReferenceUpdateDictionary.name, parentItemId);
    const { referenceFieldId, sublistId, responseOptions: childResponseOptions, cacheOptions} = referenceOptions;
    validate.enumArgument(source, {parentRecordType, isRecordTypeEnum});
    validate.enumArgument(source, {childRecordType, isRecordTypeEnum});
    validate.multipleStringArguments(source, {parentItemId, referenceFieldId, sublistId, parentInternalId});
    validate.objectArgument(source, {childResponseOptions, isRecordResponseOptions})
    validate.objectArgument(source, {cacheOptions, isRecordResponseOptions});
    validate.arrayArgument(source, {childInternalIds, isNumeric});
    validate.arrayArgument(source, {newReferenceIds, isNumeric});

    const dict: {
        [childRecordId: string]: ReferenceFieldUpdate
    } = {};
    for (let i = 0; i < childInternalIds.length; i++) {
        const childInternalId = String(childInternalIds[i]);
        let child = (await getRecordById(
            Factory.SingleRecordRequest(
                childRecordType, 
                idPropertyEnum.INTERNAL_ID, 
                childInternalId, 
                childResponseOptions
            )
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
        let targetLines = getLinesWithSublistFieldValue(
            sublistLines, referenceFieldId, parentInternalId
        );
        if (targetLines.length > newReferenceIds.length) {
            throw new Error(`${source} targetLines.length > newReferenceIds.length`)
        }
        let sublistCacheFields = (isStringArray(cacheOptions.sublists[sublistId]) 
            ? cacheOptions.sublists[sublistId]
            : [cacheOptions.sublists[sublistId]]
        );
        validate.arrayArgument(source, {sublistCacheFields, isStringArray});
        for (let j = 0; j < targetLines.length; j++) {
            const line = targetLines[j];
            let lineCache = sublistCacheFields.reduce((acc, sublistFieldId)=>{
                if (isFieldValue(line[sublistFieldId])) {
                    acc[sublistFieldId] = line[sublistFieldId]
                }
                return acc;
            }, {} as {[sublistFieldId: string]: FieldValue});
            let newReferenceValue = (isNonEmptyString(newReferenceIds[j]) 
                ? newReferenceIds[j] 
                : String(newReferenceIds[j])
            );
            if (!isEmpty(newReferenceValue)) {
                update.lineCache[newReferenceValue] = lineCache;
            }
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
    try {
        validate.arrayArgument(source, {records, isRecordOptions});
        validate.stringArgument(source, {idField});
        validate.enumArgument(source, {recordType, isRecordTypeEnum});
    } catch (error: any) {
        mlog.error(`${source} Invalid Arguments:`, indentedStringify(error),
            `${NL} Returning empty object...`
        );
        return {};
    }
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