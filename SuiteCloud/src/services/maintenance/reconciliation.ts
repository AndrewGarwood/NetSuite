/**
 * @file src/services/maintenance/reconciliation.ts
 */
import { 
    RecordTypeEnum, 
} from "../../utils/ns";
import { 
    isNonEmptyArray, isEmptyArray, hasKeys,
    isNonEmptyString, 
    isStringArray,
    isIntegerArray,
    isObject,
    isEmpty,
    isNumeric,
    isInteger
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, 
    getSkuDictionary,
    DELAY,
    getProjectFolders,
    setSkuInternalId,
    getClassDictionary
} from "../../config";
import { getColumnValues, getRows, 
    writeObjectToJsonSync as write, 
    readJsonFileAsObject as read, 
    getIndexedColumnValues, handleFileArgument, 
    isValidCsvSync,
    getFileNameTimestamp,
    indentedStringify,
    isFile,
    getSourceString,
    getCurrentPacificTime,
    RowSourceMetaData,
    isRowSourceMetaData
} from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { 
    RecordOptions, 
    getRecordById, 
    idPropertyEnum,
    ChildSearchOptions,
    RecordResponse, 
    getRelatedRecord,
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
import { Factory } from "../../api";
import { deleteItem } from "src/pipelines";
import { 
    generateRecordDictionary, getLinesWithSublistFieldValue, hasDependentRecords 
} from "./RecordManager";
import { 
    CacheOptions, DependentDictionary, DependentUpdateHistory, 
    ItemReconcilerStageEnum, ReconcilerError, 
    ReconcilerState, ReferenceFieldUpdate, 
    SublistRecordReferenceOptions 
} from "./types/Reconcile";
import { 
    isReconcilerError, isReconcilerState, isReferenceFieldUpdate 
} from "./types/Reconcile.TypeGuards";


let wDir: string | null = null;
let moduleState: ReconcilerState | null = null;
let createOptionsDict: { [itemId: string]: Required<RecordOptions> } | null = null;

export function getModuleState(): ReconcilerState {
    const source = getSourceString(__filename, getModuleState.name);
    if (!moduleState) {
        throw new Error(`${source} state has not been loaded yet`);
    }
    try {
        validate.objectArgument(source, {moduleState, isReconcilerState});
    } catch(error: any) {
        throw new Error([`${source} Invalid state`, error].join(NL))
    }
    return moduleState;
}

export function getCreateOptions(itemId: string): Required<RecordOptions> {
    const source = getSourceString(__filename, getCreateOptions.name, itemId)
    if (!createOptionsDict) {
        throw new Error(`${source} createOptionsDict: { [itemId: string]: RecordOptions } has not been loaded yet`);
    }
    if (!hasKeys(createOptionsDict, itemId)) {
        throw new Error(`${source} itemId '${itemId}' is not a key in createOptionsDict`)
    }
    return createOptionsDict[itemId];
}

/**
 * @TODO refactor
 */
export async function reconcileInventoryItems(
    targetItemIds: string[],
    placeholderIds: string[] | number[],
    newItems: Required<RecordOptions>[],
    refDict: { [recordType: string]: SublistRecordReferenceOptions },
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum = ItemReconcilerStageEnum.END,
): Promise<DependentUpdateHistory> {
    const source = getSourceString(__filename, reconcileInventoryItems.name);
    mlog.info(`${source} (START), pre-processing...`);
    wDir = path.join(getProjectFolders().dataDir, 'workspace');
    validate.existingDirectoryArgument(source, {wDir});
    let statePath = path.join(wDir, `${RecordTypeEnum.INVENTORY_ITEM}_reconcile_state.json`);
    validate.existingFileArgument(source, '.json', {statePath});

    moduleState = read(statePath) as ReconcilerState;
    let state = getModuleState();
    state = updateState(updateHistory);
    state.currentStage = ItemReconcilerStageEnum.PRE_PROCESS;
    createOptionsDict = generateRecordDictionary(newItems, idPropertyEnum.ITEM_ID);
    let targetItemDict: DependentDictionary = await generateDependentDictionary(
        targetItemIds, RecordTypeEnum.INVENTORY_ITEM, refDict
    );
    slog.debug([`${source} calling ${processDependentDictionary.name}(...)`,
        ` -- param itemIds.length: ${targetItemIds.length}`,
        ` -- dict itemKeys.length: ${Object.keys(targetItemDict).length}`
    ].join(NL));
    // STOP_RUNNING(1)
    let newHistory = await processDependentDictionary(
        targetItemDict,
        placeholderIds,
        RecordTypeEnum.INVENTORY_ITEM,
        refDict,
        updateHistory,
        stopAfter
    );
    updateHistory = appendUpdateHistory(updateHistory, newHistory);
    write(state, statePath);
    return updateHistory;
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
    dependentIdDict: DependentDictionary,
    placeholderIds: string[] | number[],
    parentRecordType: RecordTypeEnum,
    referenceDict: { [recordType: string]: SublistRecordReferenceOptions },
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum,
    /**
     * `if` `saveInterval` > `dependentIdDict[itemId][childRecordType].length` 
     * - call saveHistory once for every `{saveInterval}` calls of `processReferenceUpdate()`
     * @note `saveHistory()` is called at end of each `dependentIdDict[itemId][childRecordType]` loop
     * */
    saveInterval: number = 10
): Promise<DependentUpdateHistory> {
    const source = getSourceString(__filename, processDependentDictionary.name);
    let state = getModuleState();
    let itemKeys = Object.keys(dependentIdDict)
    // .filter(itemId=>
    //     Object.keys(dependentIdDict[itemId])
    //         .some(childRecordType=>isNonEmptyArray(dependentIdDict[itemId][childRecordType]))
    // );
    slog.info([`${source} (START) parentRecordType: '${parentRecordType}'`,
        ` -- itemKeys.length: ${itemKeys.length}`,
        // ` -- receivedKeys.length: ${Object.keys(dependentIdDict).length}`
    ].join(NL));
    itemLoop:
    for (let i = 0; i < itemKeys.length; i++) {
        let itemId = itemKeys[i]; 
        const itemStartTime = Date.now();
        if (!updateHistory[itemId]) {
            updateHistory[itemId] = {
                first: {},
                second: {}
            }
        }
        const itemInternalId = getSkuDictionary()[itemId];
        firstUpdateLoop:
        for (let childRecordType in dependentIdDict[itemId]) {
            if (state.itemsDeleted.includes(itemId)) break firstUpdateLoop;
            if (!hasKeys(referenceDict, childRecordType)) {
                mlog.error(`${source} missing childRecordType '${childRecordType}' from config...`)
                break itemLoop;
            }
            if (!updateHistory[itemId].first[childRecordType]) {
                updateHistory[itemId].first[childRecordType] = {};
            }
            const children = dependentIdDict[itemId][childRecordType];
            slog.debug([
                `start firstChildLoop for item: '${itemId}'`,
                `${childRecordType} count: ${children.length}`
            ].join(', '));
            firstChildLoop:
            for (let j = 0; j < children.length; j++) {
                const childInternalId = children[j];
                if (state.firstUpdate[itemId] 
                    && state.firstUpdate[itemId][childRecordType] 
                    && state.firstUpdate[itemId][childRecordType].includes(String(childInternalId))) {
                    continue firstChildLoop;
                }
                state.currentStage = ItemReconcilerStageEnum.GENERATE_PLACEHOLDER_UPDATE;
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
                    mlog.error([`${source} ${generateReferenceUpdate.name} returned error:`,
                        indentedStringify(update)
                    ].join(TAB));
                    state.errors.push({itemId, 
                        stage: state.currentStage, 
                        childRecordType, 
                        childInternalId, 
                        error: update
                    });
                    break itemLoop;
                }
                state.currentStage = ItemReconcilerStageEnum.RUN_PLACEHOLDER_UPDATE;
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
                        stage: state.currentStage, 
                        childRecordType, 
                        childInternalId, 
                        error: updateResult
                    });
                    break itemLoop;
                }
                if (!updateHistory[itemId].first[childRecordType][childInternalId]) {
                    updateHistory[itemId].first[childRecordType][childInternalId] = [];
                }
                updateHistory[itemId].first[childRecordType][childInternalId].push(update);
                if (j > 1 && (j + 1) % saveInterval === 0) {
                    slog.debug([
                        ` -- [1] saveHistory() @ ${childRecordType} index (${j+1} / ${children.length} )`
                    ].join(TAB));
                    saveHistory(updateHistory, parentRecordType);
                }
            }
            
            slog.debug([
                `end firstChildLoop for item: '${itemId}', childRecordType: ${childRecordType}`,
                `Elapsed time for item: ${(Date.now() - itemStartTime)/(60 * 1000)} minute(s)`,
                `saving history...`
            ].join(', '));
            saveHistory(updateHistory, parentRecordType);
        } // end firstUpdateLoop        
        if (stopAfter === ItemReconcilerStageEnum.RUN_PLACEHOLDER_UPDATE) {
            continue itemLoop;
        }
        slog.debug( `seeing if need to delete old reference...`);
        let deleteResult = await handleDelete(itemId, parentRecordType, dependentIdDict, referenceDict);
        if (isReconcilerError(deleteResult)) {
            state.errors.push({timestamp: getCurrentPacificTime(), itemId, error: deleteResult});
            mlog.error([`${source} Error when calling ${handleDelete.name}('${itemId}'), error:`, 
                indentedStringify(deleteResult), ` -- exiting itemLoop...`
            ].join(NL));
            break itemLoop;
        }
        
        slog.debug( `seeing if need to create new reference...`);
        const newItemInternalId: string | ReconcilerError = (itemId in state.newItems
            ? state.newItems[itemId] 
            : await handleCreate(itemId)
        );
        if (isReconcilerError(newItemInternalId)) {
            mlog.error([`${source} Error obtaining newItemInternalId from ${handleCreate.name}('${itemId}')`,
                indentedStringify(newItemInternalId)
            ].join(NL));
            state.errors.push({itemId, 
                stage: state.currentStage,
                error: newItemInternalId
            });
            break itemLoop;
        }
        secondUpdateLoop:
        for (let childRecordType in updateHistory[itemId].first) {
            if (!updateHistory[itemId].second[childRecordType]) {
                updateHistory[itemId].second[childRecordType] = {};
            }
            const prevUpdates = updateHistory[itemId].first[childRecordType];
            const children = Object.keys(prevUpdates);
            slog.debug([
                `start secondChildLoop for item: '${itemId}'`,
                `${childRecordType} count: ${children.length}`
            ].join(', '));
            secondChildLoop:
            for (let j = 0; j < children.length; j++) {
                const childInternalId = children[j];
                if (state.secondUpdate[itemId]
                    && state.secondUpdate[itemId][childRecordType]
                    && state.secondUpdate[itemId][childRecordType].includes(childInternalId)) {
                    continue secondChildLoop;
                }
                const secondUpdates: ReferenceFieldUpdate[] = [];
                const [prevUpdate] = prevUpdates[childInternalId];
                for (const placeholderId in prevUpdate.lineCache) {
                    const newUpdate = {
                        recordType: prevUpdate.recordType,
                        sublistId: referenceDict[childRecordType].sublistId,
                        referenceFieldId: referenceDict[childRecordType].referenceFieldId,
                        oldReference: placeholderId,
                        validationDictionary: prevUpdate.validationDictionary,
                        lineCache: { [newItemInternalId]: prevUpdate.lineCache[placeholderId] }
                    } as ReferenceFieldUpdate;
                    state.currentStage = ItemReconcilerStageEnum.RUN_NEW_ITEM_UPDATE;
                    let updateResult = await processReferenceUpdate(
                        itemId, 
                        childRecordType as RecordTypeEnum,
                        childInternalId, 
                        newUpdate, 
                        referenceDict[childRecordType].responseOptions,
                        true
                    )
                    if (isReconcilerError(updateResult)) {
                        mlog.error([`${source} secondUpdateLoop`,
                            `${processReferenceUpdate.name}() returned error:`,
                            indentedStringify(updateResult)
                        ].join(NL));
                        state.errors.push({timestamp: getCurrentPacificTime(), 
                            itemId, childRecordType, childInternalId, 
                            oldReference: placeholderId, stage: state.currentStage,
                            error: updateResult
                        })
                        break itemLoop;
                    }
                    secondUpdates.push(newUpdate);
                }
                if (isNonEmptyArray(secondUpdates)) {
                    updateHistory[itemId].second[childRecordType][childInternalId] = secondUpdates;
                }
                if (j > 1 && (j + 1) % saveInterval === 0) {
                    slog.debug([
                        ` -- [2] saveHistory() @ ${childRecordType} index (${j+1} / ${children.length} )`
                    ].join(TAB));
                    saveHistory(updateHistory, parentRecordType);
                }
            }
        } // end secondUpdateLoop
        slog.debug([`end secondUpdateLoop for item '${itemId}'`,
            `Elapsed time for item: ${
                ((Date.now() - itemStartTime)/(60 * 1000)).toFixed(3)
            } minute(s)`,
            `saving history...`,
            ].join(', '));
        saveHistory(updateHistory, parentRecordType);
        slog.debug(`finished '${itemId}' @ keyIndex ( ${i+1} / ${itemKeys.length} )`);

    } // end itemLoop
    slog.debug(`end itemLoop, updating state...`);
    updateState(updateHistory);
    return updateHistory;
}

/**
 * @consideration change name back to processSublistReferenceUpdate; 
 * worry about abstracting to body fields later...  
 */
async function processReferenceUpdate(
    parentItemId: string,
    childRecordType: RecordTypeEnum,
    childInternalId: string | number, 
    update: ReferenceFieldUpdate,
    responseOptions: RecordResponseOptions,
    isSecondUpdate: boolean = false,
): Promise<undefined | ReconcilerError> {
    const source = getSourceString(__filename, processReferenceUpdate.name, parentItemId);
    try {
        validate.stringArgument(source, {parentItemId});
        validate.objectArgument(source, {update, isReferenceFieldUpdate});
        if (responseOptions) validate.objectArgument(source, {responseOptions, isRecordResponseOptions});
    } catch (error: any) {
        return ReconcilerError(source, `Invalid parameters received`, indentedStringify(error));
    }
    // slog.info(`${source} START`);
    const { 
        referenceFieldId, sublistId, oldReference, 
        validationDictionary, lineCache
    } = update as ReferenceFieldUpdate;
    if (childRecordType !== update.recordType) {
        return ReconcilerError(source, `recordType inconsistency`,
            `Invalid parameters: childRecordType !== update.recordType`,
            ...[
                `  childRecordType: '${childRecordType}'`,
                `update.recordType: '${update.recordType}'`
            ]
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
            `Failed to get initial record response to store cache values before update; isSecondUpdate ? ${isSecondUpdate}`, 
            indentedStringify(error)
        );
    }
    let targetReferences = Object.keys(lineCache);
    let targetLines = getLinesWithSublistFieldValue(
        childRecord.sublists[sublistId], 
        referenceFieldId, 
        oldReference
    ) as { [sublistFieldId: string]: FieldValue }[];
    if (targetLines.length === 0) {
        slog.warn([`${source} ${childRecordType} ${childInternalId}, isSecondUpdate ? ${isSecondUpdate}`,
            `targetLines.length = 0 = getLinesWithSublistFieldValue('${oldReference}')`,
            `-> already updated ? -> no need to make put request -> exiting function early`
        ].join(TAB));
        return;
    }
    if (targetReferences.length !== targetLines.length) {
        mlog.error(`${source} let's pause and review ....`);
        STOP_RUNNING(1);
    }
    const findLineWithOldReference: FindSublistLineWithValueOptions = {
        sublistId, fieldId: referenceFieldId, value: oldReference
    }
    let allUpdatesProcessed = false;
    // let lastResult: Required<RecordResult> | null = null;
    for (let i = 0; i < targetReferences.length; i++) {
        let newReferenceId = targetReferences[i];
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
            validate.objectArgument(source, {sublistUpdateDict: recordOptions.sublists[sublistId], isSublistUpdateDictionary});
            validate.objectArgument(source, {recordOptions, isRecordOptions});
            let putResponse = await putSingleRecord(recordOptions, responseOptions);
            // let result = putResponse.results[0];
            // let validationResult = validateResultFields(result, validationDictionary);
            // if (isReconcilerError(validationResult)) {
            //     return validationResult;
            // }
            if (putResponse.results[0] && i === targetReferences.length - 1) {
                allUpdatesProcessed = true;
            }
        } catch (error: any) {
            return ReconcilerError(source, 
                `encountered error during ${putSingleRecord.name}() or ${validateResultFields.name}()`,
                error
            );
        }
    } // end refKeyLoop
    if (!allUpdatesProcessed) {
        return ReconcilerError(source, 
            `Not all updates processed`, 
            `Unable to proceed with validation`, 
            {allUpdatesProcessed, isSecondUpdate, childRecordType, childInternalId}
        );
    }
    if (allUpdatesProcessed && isSecondUpdate) { // if can do second validation
        // slog.debug(`${source} @ second validation for ${childRecordType} '${childInternalId}'`);
        const getRes = await getRecordById(Factory.SingleRecordRequest(
            childRecordType, idPropertyEnum.INTERNAL_ID, childInternalId, responseOptions)
        );
        const resResult = getRes.results[0] as Required<RecordResult>;
        if (!isRecordResult(resResult)) {
            return ReconcilerError(source, `error during second validation`, 
                `getRecordById().results[0] is invalid`, `response: ${indentedStringify(getRes)}`
            );
        }
        let validationResult = validateResultFields(resResult, validationDictionary);
        if (isReconcilerError(validationResult)) {
            return validationResult;
        }
        let newReferenceIds = Object.keys(update.lineCache);
        let sublistLines = resResult.sublists[sublistId] ?? [];
        let linesWithNewReference = getLinesWithSublistFieldValue(sublistLines, referenceFieldId, ...newReferenceIds);
        let linesWithOldReference = getLinesWithSublistFieldValue(sublistLines, referenceFieldId, oldReference);
        if (linesWithOldReference.length > 0) {
            return ReconcilerError(source,
                `Update failed (get after updates validation check)`, 
                `Invalid lastResult.sublists['${sublistId}']`, ...[
                    `   oldReference: ${oldReference}`,
                    `newReferenceIds: ${newReferenceIds.join(', ')}`,
                    `linesWithOldReference.length > 0 ? ${linesWithOldReference.length > 0}`,
                    `linesWithNewReference.length: ${linesWithNewReference.length}`,
                    `      newReferenceIds.length: ${newReferenceIds.length}`,
            ]);
        }
        // slog.debug(` -- second validation passed!`);
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
    const source = getSourceString(__filename, validateResultFields.name);
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

async function handleCreate(
    itemId: string
): Promise<string | ReconcilerError> {
    const source = getSourceString(__filename, handleCreate.name);
    let newItemInternalId: string = '';
    let state = getModuleState();
    if (!(itemId in state.newItems)) {
        slog.debug(` -- itemId not in state.newItems, trying to create new item...`);
        state.currentStage = ItemReconcilerStageEnum.CREATE_NEW_ITEM;
        try {
            const createOptions = getCreateOptions(itemId);
            let createRes = await putSingleRecord(createOptions);
            newItemInternalId = String((
                createRes.results[0] ?? {internalid: undefined}
            ).internalid);
            validate.numericStringArgument(source, {newItemInternalId});
        } catch (error: any) {
            return ReconcilerError(source, `${source} error when creating new item`, {
                timestamp: getCurrentPacificTime(), itemId, 
                message: `${source} error when creating new item`, stage: state.currentStage
            })
        }
        let itemInternalId = setSkuInternalId(itemId, newItemInternalId);
        slog.info([` -- Recreated item '${itemId}'`,
            `newInternalId: '${newItemInternalId}'`,
            `oldInternalId: '${itemInternalId}'`
        ].join(TAB));
        state.newItems[itemId] = newItemInternalId;
    } else {
        newItemInternalId = state.newItems[itemId];
        slog.debug(` -- already recreated item, newInternalId: ${newItemInternalId}`)
    }
    if (isNonEmptyString(newItemInternalId)) return newItemInternalId;
    return ReconcilerError(source, `reached end of ${handleCreate.name} without getting item internalid`, 
        `No valid newItemInternalId obtained`
    )
}

async function handleDelete(
    itemId: string,
    parentRecordType: RecordTypeEnum,
    dependentIdDict: DependentDictionary,
    referenceDict: {
        [recordType: string]: SublistRecordReferenceOptions
    },
): Promise<undefined | ReconcilerError> {
    const source = getSourceString(__filename, handleDelete.name, itemId);
    let state = getModuleState();
    if (state.itemsDeleted.includes(itemId)) return;
    let stillHasDependents = (await hasDependentRecords(
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
        return ReconcilerError(source, `${source} hasDependentRecords returned error`, stillHasDependents)
    }
    let safeToDelete = (state.itemsDeleted.includes(itemId) || !stillHasDependents 
    );
    if (!safeToDelete) {
        return ReconcilerError(source, ` -- safeToDelete === false, aborting itemLoop`, {
            timestamp: getCurrentPacificTime(), itemId, stage: state.currentStage, safeToDelete, stillHasDependents
        })
    }

    if (!state.itemsDeleted.includes(itemId)) {
        slog.debug(` -- itemId not in state.itemsDeleted, trying to delete item...`)
        state.currentStage = ItemReconcilerStageEnum.DELETE_OLD_ITEM;
        let deleteRes = await deleteItem(itemId, parentRecordType);
        if (!deleteRes) {
            return ReconcilerError(source, `${source} deleteItem response is null`, {
                timestamp: getCurrentPacificTime(), itemId, stage: state.currentStage, message: `${source} deleteItem response is null`
            });
        }
        state.itemsDeleted.push(itemId);
    }
    return;
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
    const source = getSourceString(__filename, generateReferenceUpdate.name, 
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



async function reconcileAssemblyItems(
    dependentIdDict: DependentDictionary,
    referenceDict: {
        [recordType: string]: SublistRecordReferenceOptions
    },
    placeholderIds: string[] | number[],
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum = ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE,
): Promise<DependentUpdateHistory> {
    const source = getSourceString(__filename, reconcileInventoryItems.name);
    for (let itemId of Object.keys(dependentIdDict)) {
        if (!(itemId in getSkuDictionary())) {
            throw new Error(`${source} item '${itemId}' not in skuDictionary...`)
        }
    }
    wDir = path.join(getProjectFolders().dataDir, 'workspace');
    validate.existingDirectoryArgument(source, {wDir});
    const statePath = path.join(wDir, 'reconcile_state.json');
    validate.existingFileArgument(source, '.json', {statePath});
    moduleState = read(statePath) as ReconcilerState;
    let state = getModuleState(); // because ReconcilerState | null
    updateHistory = await processDependentDictionary(
        dependentIdDict, 
        placeholderIds,
        RecordTypeEnum.ASSEMBLY_ITEM, 
        referenceDict,
        updateHistory, 
        stopAfter
    )
    write(state, statePath);
    return updateHistory
}

// const itemIdExtractor = async (
//     value: string, 
//     cleanOptions: CleanStringOptions = CLEAN_ITEM_ID_OPTIONS
// ): Promise<string> => {
//     return clean(extractLeaf(value), cleanOptions);
// }

/**
 * - this function should be redundant if I modify the history object correctly/safely in {@link processDependentDictionary}
 * - 
 * @param existingHistory 
 * @param newHistory 
 * @returns **`existingHistory`** with novel data from `newHistory`
 */
export function appendUpdateHistory(
    existingHistory: DependentUpdateHistory, 
    newHistory: DependentUpdateHistory
): DependentUpdateHistory {
    const source = getSourceString(__filename, appendUpdateHistory.name);
    let numEdits = 0;
    for (const [itemId, childUpdateDict] of Object.entries(newHistory)) {
        if (!hasKeys(existingHistory, itemId)) {
            existingHistory[itemId] = newHistory[itemId];
            continue;
        }
        let newFirst = childUpdateDict.first;
        firstChildTypeLoop:
        for (let childRecordType in newFirst) {
            if (!hasKeys(existingHistory[itemId].first, childRecordType)) {
                existingHistory[itemId].first[childRecordType] = Object.assign(
                    {}, newFirst[childRecordType]
                );
                numEdits += Object.keys(newFirst[childRecordType]).length;
                continue firstChildTypeLoop;
            }
            firstChildInternalIdLoop:
            for (let childInternalId in newFirst[childRecordType]) {
                if (!hasKeys(existingHistory[itemId].first[childRecordType], childInternalId)) {
                    existingHistory[itemId].first[childRecordType][childInternalId] 
                        = newFirst[childRecordType][childInternalId];
                    numEdits += newFirst[childRecordType][childInternalId].length;
                } // else no need to overwrite
                continue firstChildInternalIdLoop;
            }
        }
        let newSecond = childUpdateDict.second;
        secondChildTypeLoop:
        for (let childRecordType in newSecond) {
            if (!hasKeys(existingHistory[itemId].second, childRecordType)) {
                existingHistory[itemId].second[childRecordType] = Object.assign(
                    {}, newSecond[childRecordType]
                );
                numEdits += Object.keys(newSecond[childRecordType]).length;
                continue secondChildTypeLoop;
            }
            secondChildInternalIdLoop:
            for (let childInternalId in newSecond[childRecordType]) {
                if (!hasKeys(existingHistory[itemId].second[childRecordType], childInternalId)) {
                    existingHistory[itemId].second[childRecordType][childInternalId] 
                        = newSecond[childRecordType][childInternalId];
                    numEdits += newSecond[childRecordType][childInternalId].length;
                } // else no need to overwrite
                continue secondChildInternalIdLoop;
            }
        }
    }
    mlog.debug(`${source} (END) numEdits: ${numEdits}`)
    return existingHistory;
}

export function updateState(
    updateHistory: DependentUpdateHistory,
): ReconcilerState {
    const source = getSourceString(__filename, updateState.name)
    const state = getModuleState();
    let numEdits = 0;
    for (let itemId in updateHistory) {
        if (!state.firstUpdate[itemId]) {
            state.firstUpdate[itemId] = {};
        }
        if (!state.secondUpdate[itemId]) {
            state.secondUpdate[itemId] = {};
        }
        for (let childRecordType in updateHistory[itemId].first) {
            if (!state.firstUpdate[itemId][childRecordType]) {
                state.firstUpdate[itemId][childRecordType] = [];
            }
            for (let childInternalId in updateHistory[itemId].first[childRecordType]) {
                if (isNonEmptyArray(updateHistory[itemId].first[childRecordType][childInternalId])
                    && !state.firstUpdate[itemId][childRecordType].includes(childInternalId)) {
                    state.firstUpdate[itemId][childRecordType].push(childInternalId);
                    numEdits++;
                }
            }
        }
        for (let childRecordType in updateHistory[itemId].second) {
            if (!state.secondUpdate[itemId][childRecordType]) {
                state.secondUpdate[itemId][childRecordType] = [];
            }
            for (let childInternalId in updateHistory[itemId].second[childRecordType]) {
                if (isNonEmptyArray(updateHistory[itemId].second[childRecordType][childInternalId]) 
                    && !state.secondUpdate[itemId][childRecordType].includes(childInternalId)) {
                    state.secondUpdate[itemId][childRecordType].push(childInternalId);
                    numEdits++;
                }
            }
        }
    }
    slog.debug(` -- ${source} numEdits: ${numEdits}`);
    return state;
}

export function saveState(
    parentRecordType: RecordTypeEnum,
    addTimestampPrefix: boolean = false
): void {
    const source = getSourceString(__filename, saveState.name);
    const state = getModuleState();
    if (!wDir) {
        throw new Error(`${source} wDir is undefined`);
    }
    const statePath = path.join(
        wDir, 
        (addTimestampPrefix ? `${getFileNameTimestamp()}_` : '')
            +`${parentRecordType}_reconcile_state.json`
    );
    try { 
        write(state, statePath);
    } catch (error: any) {
        throw new Error([`${source} error saving history`,
            `attempted write @ filePath: '${statePath}'`,
        ].join(TAB));
    }
}

/**
 * @description writes `currentHistory` to 
 * - `'wDir/${parentRecordType}_update_history.json'`;
 * - `'wDir/${getFileNameTimestamp()}_${parentRecordType}_update_history.json'`
 * @param currentHistory 
 * @param parentRecordType 
 * @param addTimestampPrefix 
 */
function saveHistory(
    currentHistory: DependentUpdateHistory,
    parentRecordType: RecordTypeEnum,
    addTimestampPrefix: boolean = false
): void {
    const source = getSourceString(__filename, saveHistory.name);
    if (!isNonEmptyString(wDir)) {
        throw new Error([`${source} wDir (workspace directory) is undefined`,
        ].join(TAB));
    }
    let historyPath = path.join(
        wDir, 
        (addTimestampPrefix ? `${getFileNameTimestamp()}_` : '')
            +`${parentRecordType}_update_history.json`
    );
    try { 
        write(currentHistory, historyPath);
    } catch (error: any) {
        throw new Error([`${source} error saving history`,
            `attempted write @ filePath: '${historyPath}'`,
        ].join(TAB));
    }
}


/**
 * assumes elements of parentItems are keys in skuDictionary()
 * @param parentItems 
 * @param parentRecordType 
 * @param refDict 
 * @returns 
 */
async function generateDependentDictionary(
    parentItems: string[],
    parentRecordType: RecordTypeEnum,
    refDict: { [recordType: string]: SublistRecordReferenceOptions }
): Promise<DependentDictionary> {
    const source = getSourceString(__filename, generateDependentDictionary.name);
    const state = getModuleState();
    const dict: DependentDictionary = {};
    // let maxItemIdLength = Math.max(...parentItems.map(p=>p.length));
    itemLoop:
    for (let itemId of parentItems) {
        dict[itemId] = {};
        childTypeLoop:
        for (let childRecordType in refDict) {
            try {
                let getRes = await getRelatedRecord(Factory.RelatedRecordRequest(
                    parentRecordType, 
                    idPropertyEnum.INTERNAL_ID, 
                    getSkuDictionary()[itemId],
                    [Factory.ChildSearchOptions(
                        childRecordType as RecordTypeEnum,
                        refDict[childRecordType].referenceFieldId,
                        refDict[childRecordType].sublistId
                    )]
                ));
                await DELAY(700, null);
                if (isNonEmptyArray(getRes.results)) {
                    let children = getRes.results.map(r=>String(r.internalid));
                    dict[itemId][childRecordType] = children;
                    // slog.debug(
                    //     ` -- ${parentRecordType} ${itemId.padEnd(maxItemIdLength)}`,
                    //     `has ${String(children.length).padEnd(5)} ${childRecordType} record(s)`
                    // );
                } else {
                    // if (!state.itemsNotFound) state.itemsNotFound = {} as Record<string, Record<string, string[]>>;
                    // if (!state.itemsNotFound[parentRecordType]) state.itemsNotFound[parentRecordType] = [];
                    // state.itemsNotFound[parentRecordType].push(itemId);
                    continue itemLoop;
                }
            } catch (error: any) {
                mlog.error([
                    `${source} error getting child ${childRecordType} records for itemId ${itemId}`, 
                    error
                ].join(NL));
                state.errors.push({
                    source, itemId, childRecordType, 
                    message: `${source} error getting child ${childRecordType} records for itemId ${itemId}`,
                    error
                })
                continue childTypeLoop;
            }
        } // end childTypeLoop
    } // end itemLoop
    return dict;
}

async function performFinalValidation(
    dependentIdDict: DependentDictionary
): Promise<any> {
    const source = getSourceString(__filename, performFinalValidation.name);
}