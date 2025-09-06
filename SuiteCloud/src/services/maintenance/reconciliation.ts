/**
 * @file src/services/maintenance/reconciliation.ts
 */

import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { 
    RecordTypeEnum, 
} from "../../utils/ns";
import { isNonEmptyArray, isEmptyArray, hasKeys, isNullLike as isNull,
    isNonEmptyString, 
    isStringArray,
    isIntegerArray,
    isObject,
    isEmpty,
    isNumeric,
    isInteger
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, parseLogger as plog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, 
    getSkuDictionary,
    DELAY,
    getProjectFolders,
    setSkuInternalId,
    getClassDictionary
} from "../../config";
import { 
    getColumnValues,
    writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    isValidCsvSync,
    indentedStringify,
    getSourceString,
} from "typeshi:utils/io";
import { 
    RecordOptions, 
    getRecordById,
    idPropertyEnum,
    ChildSearchOptions,
    isRecordTypeEnum,
    RecordResult, 
    isRecordResult,
    RecordResponseOptions,
    isRecordResponseOptions,
    FieldValue,
    SublistUpdateDictionary,
    FindSublistLineWithValueOptions,
    isRecordOptions,
    putSingleRecord,
    isFieldValue,
    isSublistUpdateDictionary
} from "../../api";
import { CleanStringOptions, StringReplaceOptions, clean, extractFileName, extractLeaf } from "typeshi:utils/regex"
import { CLEAN_ITEM_ID_OPTIONS } from "src/parse_configurations/evaluators";
import { Factory } from "../../api";
import { deleteItem } from "src/pipelines";
import { generateRecordDictionary, getLinesWithSublistFieldValue, hasDependentRecords } from "./RecordManager";
import { 
    CacheOptions, 
    DependentUpdateHistory, 
    ItemReconcilerStageEnum, 
    ReconcilerError, 
    ReconcilerState, 
    ReferenceFieldUpdate, 
    SublistRecordReferenceOptions 
} from "./types/Reconcile";
import { isReconcilerError, isReconcilerState, isReferenceFieldUpdate } from "./types/Reconcile.TypeGuards";
import { sublistReferenceDictionary } from "./reconcileOptions";


const F = extractFileName(__filename);


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


/**
 * @TODO refactor
 */
export async function reconcileInventoryItems(
    placeholderIds: string[] | number[],
    newItems: Required<RecordOptions>[],
    refDict: { [recordType: string]: SublistRecordReferenceOptions } = sublistReferenceDictionary,
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum = ItemReconcilerStageEnum.END,
): Promise<DependentUpdateHistory> {
    const source = getSourceString(F, reconcileInventoryItems.name);
    let wDir = path.join(getProjectFolders().dataDir, 'workspace');
    validate.existingDirectoryArgument(source, {wDir});
    const statePath = path.join(wDir, 'reconcile_state.json');
    validate.existingFileArgument(source, '.json', {statePath});

    moduleState = read(statePath) as ReconcilerState;
    let state = getModuleState(); // because ReconcilerState | null
    validate.objectArgument(source, {state, isReconcilerState});

    validate.arrayArgument(source, {newItems, isRecordOptions});
    createOptionsDict = generateRecordDictionary(newItems, idPropertyEnum.ITEM_ID);
    state.stage = ItemReconcilerStageEnum.PRE_PROCESS;
    slog.info([
        `reading in salesorder data...`
    ].join(NL));
    // refactor this io into params
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


    const itemDependentDict: {
        [itemId: string]: {
            [childRecordType: string | RecordTypeEnum]: number[]
        }
    } = {};
    let itemKeys = Object.keys(itemToSalesOrders); // itemToSalesOrders, itemToRevisions keys are same
    for (let itemId of itemKeys) {
        if (!(itemId in getSkuDictionary())) {
            throw new Error(`${source} item '${itemId}' not in skuDictionary...`)
        }
    }
    for (let itemId of itemKeys) {
        itemDependentDict[itemId] = {};
        if (itemId in itemToSalesOrders) {
            itemDependentDict[itemId][RecordTypeEnum.SALES_ORDER] = itemToSalesOrders[itemId];
        }
    }
    let newHistory = await processDependentDictionary(
        itemDependentDict,
        placeholderIds,
        RecordTypeEnum.INVENTORY_ITEM,
        refDict,
        updateHistory,
        stopAfter
    );
    Object.assign(updateHistory, newHistory);
    write(state, statePath);
    return updateHistory
}

/**
 * @TODO refactor
 * @param dependentIdDict 
 * @param placeholderIds 
 * @param parentRecordType 
 * @param referenceDict 
 * @param updateHistory 
 * @param stopAfter 
 * @returns **`updateHistory`** with new entries (not overwriting)
 */
async function processDependentDictionary(
    dependentIdDict: {
        [itemId: string]: {
            [childRecordType: string | RecordTypeEnum]: number[]
        }
    },
    placeholderIds: string[] | number[],
    parentRecordType: RecordTypeEnum,
    referenceDict: { [recordType: string]: SublistRecordReferenceOptions },
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum = ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE,
): Promise<DependentUpdateHistory> {
    const source = getSourceString(F, processDependentDictionary.name);
    let state = getModuleState();
    validate.objectArgument(source, {state, isReconcilerState});
    let validKeys = Object.keys(dependentIdDict).filter(itemId=>
        Object.keys(dependentIdDict[itemId])
            .some(cType=>isNonEmptyArray(dependentIdDict[itemId][cType]))
    )
    slog.info(`${source} (START) parentRecordType: '${parentRecordType}'`,
        ` -- validKeys.length: ${validKeys.length}`,
        ` -- receivedKeys.length: ${Object.keys(dependentIdDict).length}`
    )
    itemLoop:
    for (let itemId of validKeys.slice(0, 2)) { // remove slice after testing...
        if (!updateHistory[itemId]) {
            updateHistory[itemId] = {
                first: {},
                second: {}
            }
        }
        if (!state.firstUpdate[itemId]) {
            state.firstUpdate[itemId] = {};
        }
        const itemInternalId = getSkuDictionary()[itemId];
        firstUpdateLoop:
        for (let childRecordType in dependentIdDict[itemId]) {
            if (state.itemsDeleted.includes(itemId)) break firstUpdateLoop;
            if (!state.firstUpdate[itemId][childRecordType]) {
                state.firstUpdate[itemId][childRecordType] = [];
            }
            if (!hasKeys(referenceDict, childRecordType)) {
                mlog.error(`${source} missing childRecordType '${childRecordType}' from config...`)
                break itemLoop;
            }
            updateHistory[itemId].first[childRecordType] = updateHistory[itemId].first[childRecordType] ?? {};
            firstChildLoop:
            for (let childInternalId of dependentIdDict[itemId][childRecordType]) {
                if (state.firstUpdate[itemId][childRecordType].includes(String(childInternalId))) {
                    continue firstChildLoop;
                }
                state.stage = ItemReconcilerStageEnum.GENERATE_PLACEHOLDER_UPDATE;
                let update = await generateReferenceUpdate(
                    itemId, 
                    itemInternalId, 
                    parentRecordType,
                    childRecordType as RecordTypeEnum,
                    childInternalId, 
                    referenceDict[childRecordType],
                    placeholderIds
                );
                if (isReconcilerError(update)) {
                    mlog.error([`${source} ${generateReferenceUpdate.name} returned error value`,
                        `error: `, indentedStringify(update)
                    ].join(TAB));
                    state.errors.push({itemId, 
                        stage: state.stage, 
                        childRecordType, 
                        childInternalId, 
                        error: update
                    });
                    break itemLoop;
                }
                if (!updateHistory[itemId].first[childRecordType][childInternalId]) {
                    updateHistory[itemId].first[childRecordType][childInternalId] = []
                }
                updateHistory[itemId].first[childRecordType][childInternalId].push(update);
                state.stage = ItemReconcilerStageEnum.RUN_PLACEHOLDER_UPDATE;
                let updateResult = await processReferenceUpdate(
                    itemId, 
                    childRecordType as RecordTypeEnum, 
                    childInternalId, 
                    update, 
                    referenceDict[childRecordType].responseOptions
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
        } // end firstUpdateLoop
        state.stage = ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE;
        let stillHasDependents = (state.itemsDeleted.includes(itemId) 
            ? false 
            : await hasDependentRecords(
                itemId, 
                parentRecordType,
                Object.keys(dependentIdDict[itemId]).reduce((acc, childRecordType)=> {
                if (isNonEmptyArray(dependentIdDict[itemId][childRecordType])) { // if has childInternalId array non-empty
                    acc.push(Factory.ChildSearchOptions(
                        childRecordType as RecordTypeEnum, 
                        referenceDict[childRecordType].referenceFieldId, 
                        referenceDict[childRecordType].sublistId
                    ));
                }
                return acc;
            }, [] as ChildSearchOptions[])
        ));
        if (isReconcilerError(stillHasDependents)) {
            mlog.error(`${source} hasDependentRecords returned error`,
                stillHasDependents
            );
            state.errors.push({itemId, stage: state.stage, error: stillHasDependents});
            break itemLoop;
        }
        let safeToDelete = (state.itemsDeleted.includes(itemId) 
            || (Object.keys(state.firstUpdate[itemId]).every(childRecordType=>{
                    let actualProcessCount = state.firstUpdate[itemId][childRecordType].length;
                    let expectedProcessCount = (dependentIdDict[itemId][childRecordType] ?? []).length;
                    return actualProcessCount === expectedProcessCount;
                }) 
                && 
                !stillHasDependents
            )
        );
        if (!safeToDelete) {
            slog.info(` -- safeToDelete === false, aborting itemLoop`);
            state.errors.push({itemId, stage: state.stage, safeToDelete, stillHasDependents});
            break itemLoop;
        }
        if (stopAfter === ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE) {
            continue itemLoop;
        }
        if (!state.itemsDeleted.includes(itemId)) {
            state.stage = ItemReconcilerStageEnum.DELETE_OLD_ITEM;
            let deleteRes = await deleteItem(itemId, parentRecordType);
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
                if (!hasKeys(createOptions.fields, ['cogsaccount', 'assetaccount'], true)) {
                    mlog.error([`${source} missing account field(s)...`,
                        ` cogsaccount in fields ? ${'cogsaccount' in createOptions.fields}`,
                        `assetaccount in fields ? ${'assetaccount' in createOptions.fields}`,
                    ].join(TAB));
                    STOP_RUNNING(1);
                }
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
        for (let childRecordType in updateHistory[itemId].first) {
            if (!state.secondUpdate[itemId][childRecordType]) {
                state.secondUpdate[itemId][childRecordType] = [];
            }
            if (!updateHistory[itemId].second[childRecordType]) {
                updateHistory[itemId].second[childRecordType] = {};
            }
            secondChildLoop:
            for (let childInternalId in updateHistory[itemId].first[childRecordType]) {
                if (state.secondUpdate[itemId][childRecordType].includes(childInternalId)) {
                    continue secondChildLoop;
                }
                if (!updateHistory[itemId].second[childRecordType][childInternalId]) {
                    updateHistory[itemId].second[childRecordType][childInternalId] = []
                }
                const [prevUpdate] = updateHistory[itemId].first[childRecordType][childInternalId];
                for (const placeholderId in prevUpdate.lineCache) {
                    state.stage = ItemReconcilerStageEnum.GENERATE_NEW_ITEM_UPDATE;
                    const newUpdate = {
                        recordType: prevUpdate.recordType,
                        sublistId: referenceDict[childRecordType].sublistId,
                        referenceFieldId: referenceDict[childRecordType].referenceFieldId,
                        oldReference: placeholderId,
                        validationDictionary: prevUpdate.validationDictionary,
                        lineCache: { [newItemInternalId]: prevUpdate.lineCache[placeholderId] }
                    } as ReferenceFieldUpdate;
                    state.stage = ItemReconcilerStageEnum.RUN_NEW_ITEM_UPDATE;
                    let updateResult = await processReferenceUpdate(itemId, 
                        childRecordType as RecordTypeEnum,
                        childInternalId, 
                        newUpdate, 
                        referenceDict[childRecordType].responseOptions
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
                    updateHistory[itemId].second[childRecordType][childInternalId]
                        .push(newUpdate);
                }
                state.secondUpdate[itemId][childRecordType].push(childInternalId);
            }
        }
    } // end itemLoop
    return updateHistory;
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
        return ReconcilerError(source, 
            `Failed to get initial record response to store cache values before update`, 
            indentedStringify(error)
        );
    }
    let refKeys = Object.keys(lineCache);
    let targetLines = getLinesWithSublistFieldValue(
        childRecord.sublists[sublistId], 
        referenceFieldId, 
        oldReference
    ) as { [sublistFieldId: string]: FieldValue }[];
    if (targetLines.length === 0) {
        mlog.warn([`${source} targetLines.length === 0`,
            `i.e. getLinesWithSublistFieldValue('${oldReference}').length ==== 0`,
            `-> already updated ?`,
            `no need to make put request -> exiting function early`
        ].join(TAB));
        return;
    }
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
        sublistUpdateDict[referenceFieldId] = { // actually overwrite the reference
            newValue: newReferenceId,
            lineIdOptions: findLineWithOldReference
        }
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
        if (linesWithOldReference.length > 0) {
            return ReconcilerError(source,
                `Update failed (lastResult validation check)`, 
                `Invalid lastResult.sublists['${sublistId}']`, 
                ...[`   oldReference: ${oldReference}`,
                    `newReferenceIds: ${newReferenceIds.join(', ')}`,
                    `linesWithOldReference.length > 0 ? ${linesWithOldReference.length > 0}`,
                    `linesWithNewReference.length: ${linesWithNewReference.length}`,
                    `      newReferenceIds.length: ${newReferenceIds.length}`,
            ]);
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



export async function reconcileAssemblyItems(
    dependentIdDict: {
        [assemItemId: string]: {
            [childRecordType: string]: number[]
        }
    },
    refDict: {
        [recordType: string]: SublistRecordReferenceOptions
    },
    placeholderIds: string[] | number[],
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum = ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE,
): Promise<DependentUpdateHistory> {
    const source = getSourceString(F, reconcileInventoryItems.name);
    for (let itemId of Object.keys(dependentIdDict)) {
        if (!(itemId in getSkuDictionary())) {
            throw new Error(`${source} item '${itemId}' not in skuDictionary...`)
        }
    }
    let wDir = path.join(getProjectFolders().dataDir, 'workspace');
    validate.existingDirectoryArgument(source, {wDir});
    const statePath = path.join(wDir, 'reconcile_state.json');
    validate.existingFileArgument(source, '.json', {statePath});
    moduleState = read(statePath) as ReconcilerState;
    let state = getModuleState(); // because ReconcilerState | null
    updateHistory = await processDependentDictionary(
        dependentIdDict, 
        placeholderIds,
        RecordTypeEnum.ASSEMBLY_ITEM, 
        refDict,
        updateHistory, 
        stopAfter
    )
    write(state, statePath);
    return updateHistory
}

const itemIdExtractor = async (
    value: string, 
    cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
): Promise<string> => {
    return clean(extractLeaf(value), cleanOptions);
}


/**
 * this function should be redundant if I modify the history object correctly/safely in {@link processDependentDictionary}
 * @param existingHistory 
 * @param newHistory 
 * @returns 
 */
export function appendUpdateHistory(
    existingHistory: DependentUpdateHistory, 
    newHistory: DependentUpdateHistory
): DependentUpdateHistory {
    const source = getSourceString(F, appendUpdateHistory.name);
    for (const [itemId, updateSets] of Object.entries(newHistory)) {
        if (!hasKeys(existingHistory, itemId)) {
            existingHistory[itemId] = newHistory[itemId];
            continue;
        }
        let newFirst = updateSets.first;
        firstChildTypeLoop:
        for (let childRecordType in newFirst) {
            if (!hasKeys(existingHistory[itemId].first, childRecordType)) {
                existingHistory[itemId].first[childRecordType] = newFirst[childRecordType];
                continue firstChildTypeLoop;
            }
            firstChildInternalIdLoop:
            for (let childInternalId in newFirst[childRecordType]) {
                if (!hasKeys(existingHistory[itemId].first[childRecordType], childInternalId)) {
                    existingHistory[itemId].first[childRecordType][childInternalId] = newFirst[childRecordType][childInternalId];
                } // else no need to overwrite
                continue firstChildInternalIdLoop;
            }
        }
        let newSecond = updateSets.second;
        secondChildTypeLoop:
        for (let childRecordType in newSecond) {
            if (!hasKeys(existingHistory[itemId].second, childRecordType)) {
                existingHistory[itemId].second[childRecordType] = newSecond[childRecordType];
                continue secondChildTypeLoop;
            }
            secondChildInternalIdLoop:
            for (let childInternalId in newSecond[childRecordType]) {
                if (!hasKeys(existingHistory[itemId].second[childRecordType], childInternalId)) {
                    existingHistory[itemId].second[childRecordType][childInternalId] = newSecond[childRecordType][childInternalId];
                } // else no need to overwrite
                continue secondChildInternalIdLoop;
            }
        }
    }
    return existingHistory;
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
