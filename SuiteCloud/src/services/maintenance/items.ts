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
import { 
    writeObjectToJsonSync as write, 
    readJsonFileAsObject as read,
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

/** when defined:
 * = `path.join(getProjectFolders().dataDir, 'workspace', 
 * 'reconciler', parentRecordType)` 
 * */
let reconcilerDir: string | null = null;
// let wDir: string | null = null;
let moduleState: ReconcilerState | null = null;
let createOptionsDict: { [itemId: string]: Required<RecordOptions> } | null = null;

/**
 * @TODO refactor
 */
export async function reconcileItems(
    oldItemType: RecordTypeEnum,
    targetItemIds: string[],
    placeholderIds: string[] | number[],
    newItems: Required<RecordOptions>[],
    refDict: { [recordType: string]: SublistRecordReferenceOptions },
    updateHistory: DependentUpdateHistory,
    stopAfter: ItemReconcilerStageEnum = ItemReconcilerStageEnum.END,
): Promise<DependentUpdateHistory> {
    const source = getSourceString(__filename, reconcileItems.name);
    mlog.info(`${source} (START), pre-processing...`);
    reconcilerDir = path.join(getProjectFolders().dataDir, 'workspace', 'reconciler', oldItemType);
    validate.existingDirectoryArgument(source, {reconcilerDir});
    let statePath = path.join(reconcilerDir, `${oldItemType}_state.json`);
    validate.existingFileArgument(source, '.json', {statePath});

    moduleState = read(statePath) as ReconcilerState;
    let state = getReconcilerState();
    state = updateState(updateHistory);
    await rectifyState(updateHistory);
    slog.debug( `${source} -> ${generateRecordDictionary.name}( Array<RecordOptions>(${newItems.length}) )`);
    createOptionsDict = generateRecordDictionary(newItems, idPropertyEnum.ITEM_ID);

    slog.debug( `${source} -> ${generateDependentDictionary.name}( Array<string>(${targetItemIds.length}),... )`);
    let targetItemDict: DependentDictionary = await generateDependentDictionary(
        targetItemIds, oldItemType, refDict
    );
    slog.debug([`${source} calling ${processDependentDictionary.name}(...)`,
        ` -- param itemIds.length: ${targetItemIds.length}`,
        ` -- dict itemKeys.length: ${Object.keys(targetItemDict).length}`
    ].join(NL));
    let newHistory = await processDependentDictionary(
        targetItemDict,
        placeholderIds,
        oldItemType,
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
    let state = getReconcilerState();
    let itemKeys = Object.keys(dependentIdDict);
    slog.info([`${source} (START) parentRecordType: '${parentRecordType}'`,
        ` -- itemKeys.length: ${itemKeys.length}`,
    ].join(NL));
    itemLoop:
    for (let i = 0; i < itemKeys.length; i++) {
        let itemId = itemKeys[i]; 
        const itemStartTime = Date.now();
        if (!updateHistory[itemId]) {
            updateHistory[itemId] = { first: {}, second: {} }
        }
        const itemInternalId = getSkuDictionary()[itemId];
        let madeChangesForItem = false;
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
                let update = await generatePlaceholderUpdate(
                    itemId, 
                    itemInternalId, 
                    parentRecordType,
                    childRecordType as RecordTypeEnum,
                    childInternalId, 
                    referenceDict[childRecordType],
                    placeholderIds
                );
                if (isReconcilerError(update)) {
                    mlog.error([`${source} ${generatePlaceholderUpdate.name} returned error:`,
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
                    referenceDict[childRecordType],
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
                madeChangesForItem = true;
                if (!updateHistory[itemId].first[childRecordType][childInternalId]) {
                    updateHistory[itemId].first[childRecordType][childInternalId] = [];
                }
                updateHistory[itemId].first[childRecordType][childInternalId].push(update);
                if (j > 1 && (j + 1) % saveInterval === 0) {
                    slog.debug([
                        ` -- [1] saveHistory(${itemId} -> ${childRecordType}) @ index ( ${j+1} / ${children.length} )`
                    ].join(TAB));
                    saveHistory(updateHistory, parentRecordType);
                }
            }
            if (madeChangesForItem) {
                slog.debug([
                    `  end firstChildLoop for item: '${itemId}', childRecordType: ${childRecordType}`,
                    `Elapsed time: ${((Date.now() - itemStartTime)/(60 * 1000)).toFixed(3)} minute(s)`,
                    ` -- saving history...`
                ].join(NL))
                saveHistory(updateHistory, parentRecordType);
            }
        } // end firstUpdateLoop        
        if (stopAfter === ItemReconcilerStageEnum.RUN_PLACEHOLDER_UPDATE) {
            continue itemLoop;
        }
        state.currentStage = ItemReconcilerStageEnum.VALIDATE_FIRST_UPDATE;
        // slog.debug( `seeing if need to delete old reference...`);
        let deleteResult = await handleDelete(itemId, parentRecordType, dependentIdDict, referenceDict);
        if (isReconcilerError(deleteResult)) {
            state.errors.push({timestamp: getCurrentPacificTime(), itemId, error: deleteResult});
            mlog.error([`${source} Error when calling ${handleDelete.name}('${itemId}'), error:`, 
                indentedStringify(deleteResult), ` -- exiting itemLoop...`
            ].join(NL));
            break itemLoop;
        }
        
        // slog.debug( `seeing if need to create new reference...`);
        const newItemInternalId: string | ReconcilerError = (itemId in state.newItems
            ? state.newItems[itemId] 
            : await handleCreate(itemId)
        );
        if (isReconcilerError(newItemInternalId)) {
            mlog.error([
                `${source} Error obtaining newItemInternalId from ${handleCreate.name}('${itemId}')`,
                indentedStringify(newItemInternalId)
            ].join(NL));
            state.errors.push({itemId, 
                stage: state.currentStage,
                error: newItemInternalId
            });
            break itemLoop;
        }
        madeChangesForItem = false;
        secondUpdateLoop:
        for (let childRecordType in updateHistory[itemId].first) {
            if (!updateHistory[itemId].second[childRecordType]) {
                updateHistory[itemId].second[childRecordType] = {};
            }
            const prevUpdates = updateHistory[itemId].first[childRecordType];
            const children = Object.keys(prevUpdates);
            state.currentStage = ItemReconcilerStageEnum.GENERATE_NEW_ITEM_UPDATE;
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
                        referenceDict[childRecordType],
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
                    madeChangesForItem = true;
                    updateHistory[itemId].second[childRecordType][childInternalId] = secondUpdates;
                }
                if (j > 1 && (j + 1) % saveInterval === 0) {
                    slog.debug([
                        ` -- [2] saveHistory(${itemId} -> ${childRecordType}) @ index ( ${j+1} / ${children.length} )`
                    ].join(TAB));
                    saveHistory(updateHistory, parentRecordType);
                }
            }
        } // end secondUpdateLoop
        slog.debug([`  end secondUpdateLoop for item '${itemId}'`,
        ].join(', '));
        if (madeChangesForItem) {
            slog.debug([
                `Elapsed time: ${
                    ((Date.now() - itemStartTime)/(60 * 1000)).toFixed(3)
                } minute(s)`,
                ` -- saving history...`
            ].join(NL));
            saveHistory(updateHistory, parentRecordType);
        }
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
    childRefDict: SublistRecordReferenceOptions,
    isSecondUpdate: boolean = false,
): Promise<undefined | ReconcilerError> {
    const source = getSourceString(__filename, processReferenceUpdate.name, parentItemId);
    const { responseOptions, sublistFields } = childRefDict;
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
        mlog.error(`${source} targetReferences.length !== targetLines.length`,
            `isSecondUpdate ? ${isSecondUpdate}`
        );
        return ReconcilerError(source, 
            `targetReferences.length !== targetLines.length`,
            `targetReferences = Object.keys(lineCache) and targetReferences.length should equal targetLines.length`,
            `targetReferences.length: ${targetReferences.length}`, 
            `targetLines.length: ${targetLines.length}`, 
            {oldReference, childRecordType, childInternalId, isSecondUpdate, sublistId, lineCacheKeys: Object.keys(lineCache), validationDictionary}
        );
    }
    const findLineWithOldReference: FindSublistLineWithValueOptions = {
        sublistId, fieldId: referenceFieldId, value: oldReference
    }
    let allUpdatesProcessed = false;
    for (let i = 0; i < targetReferences.length; i++) {
        let newReferenceId = targetReferences[i];
        let cachedLine = lineCache[newReferenceId];
        const recordOptions = Factory.RecordOptions(
            childRecordType,
            Factory.idSearchOptions(idPropertyEnum.INTERNAL_ID, childInternalId)
        );
        const sublistUpdateDict: SublistUpdateDictionary = {};
        sublistUpdateDict[referenceFieldId] = { // actually overwrite the reference
            newValue: newReferenceId,
            lineIdOptions: findLineWithOldReference
        };
        for (let sublistFieldId in sublistFields) {
            sublistUpdateDict[sublistFieldId] = {
                newValue: sublistFields[sublistFieldId],
                lineIdOptions: findLineWithOldReference
            };
        }
        Object.assign(sublistUpdateDict, Object.keys(cachedLine).reduce((acc, sublistFieldId)=>{
            acc[sublistFieldId] = {
                newValue: cachedLine[sublistFieldId],
                lineIdOptions: findLineWithOldReference
            }
            return acc
        }, {} as SublistUpdateDictionary));
        recordOptions.sublists[sublistId] = sublistUpdateDict;
        try {
            let putResponse = await putSingleRecord(recordOptions, responseOptions);
            if (putResponse.results[0] && i === targetReferences.length - 1) {
                allUpdatesProcessed = true;
            }
        } catch (error: any) {
            return ReconcilerError(source, 
                `encountered error during ${putSingleRecord.name}() or ${compareCacheData.name}()`,
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
    if (allUpdatesProcessed && isSecondUpdate) {
        let validationResult = await compareCacheData(parentItemId, childRecordType, childInternalId, update, responseOptions);
        if (isReconcilerError(validationResult)) {
            return validationResult;
        }
    }
    return;
}


/**
 * @param parentItemId 
 * @param childRecordType 
 * @param childInternalId 
 * @param fieldCache 
 * @returns `Promise<undefined | ReconcilerError>` 
 * - ReconcilerError `if` some `result.fields[fieldId] !== fieldCache[fieldId]`
 */
const compareCacheData = async (
    parentItemId: string,
    childRecordType: RecordTypeEnum,
    childInternalId: string | number,
    update: ReferenceFieldUpdate,
    responseOptions: RecordResponseOptions
): Promise<undefined | ReconcilerError> => {
    const source = getSourceString(__filename, compareCacheData.name,
        `${parentItemId} -> ${childInternalId}<${childRecordType}>`
    );
    const { 
        sublistId, referenceFieldId, oldReference,  
        validationDictionary: fieldCache, lineCache,
    } = update
    const response = await getRecordById(Factory.SingleRecordRequest(
        childRecordType, idPropertyEnum.INTERNAL_ID, childInternalId, responseOptions
    ))
    const result = response.results[0] as Required<RecordResult>;
    if (!result) {
        return ReconcilerError(source,
            `getRecordById() failed`,
            `result (RecordResult) is undefined, unable to compare cache data`,
            `get response: ${indentedStringify(response)}`
        )
    }
    result.fields = isObject(result.fields) ? result.fields : {};
    for (let fieldId in fieldCache) {
        if (String(result.fields[fieldId]) !== String(fieldCache[fieldId])) {
            return ReconcilerError(source, `encountered invalid update result`,
                `Invalid Update Result upon comparing cached values`,
                ...[
                `String(result.fields[fieldId]) !== String(fieldCache[fieldId])`,
                `result.fields[ '${fieldId}' ]: '${String(result.fields[fieldId])}'`,
                `   fieldCache[ '${fieldId}' ]: '${String(fieldCache[fieldId])}'`,
                `   parentItemId: '${parentItemId}'`,
                `childRecordType: '${childRecordType}'`,
                `childInternalId: '${childInternalId}'`,
                `fieldCache: ${Object.entries(fieldCache).join(', ')}`
            ])
        }
    }
    let newReferenceIds = Object.keys(lineCache);
    let sublistLines = result.sublists[sublistId] ?? [];
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
}

async function handleCreate(
    itemId: string
): Promise<string | ReconcilerError> {
    const source = getSourceString(__filename, handleCreate.name);
    let newItemInternalId: string = '';
    let state = getReconcilerState();
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

/**
 * assumes `state.itemsDeleted` contains truthful data
 * @param itemId 
 * @param parentRecordType 
 * @param dependentIdDict 
 * @param referenceDict 
 * @returns 
 */
async function handleDelete(
    itemId: string,
    parentRecordType: RecordTypeEnum,
    dependentIdDict: DependentDictionary,
    referenceDict: {
        [recordType: string]: SublistRecordReferenceOptions
    },
): Promise<undefined | ReconcilerError> {
    const source = getSourceString(__filename, handleDelete.name, itemId);
    let state = getReconcilerState();        
    if (state.itemsDeleted.includes(itemId)) return;
    const childOptions = Object.keys(dependentIdDict[itemId]).reduce((acc, childRecordType)=> {
        if (isNonEmptyArray(dependentIdDict[itemId][childRecordType])) { // if has childInternalId array non-empty
            acc.push(Factory.ChildSearchOptions(
                childRecordType as RecordTypeEnum, 
                referenceDict[childRecordType].referenceFieldId, 
                referenceDict[childRecordType].sublistId
            ));
        }
        return acc;
    }, [] as ChildSearchOptions[])
    let stillHasDependents = (childOptions.length > 0 
        ? await hasDependentRecords(
            itemId, 
            parentRecordType, 
            childOptions
        ) 
        : false
    );
    if (isReconcilerError(stillHasDependents)) {
        return ReconcilerError(source, `${source} hasDependentRecords returned error`, stillHasDependents)
    }
    if (stillHasDependents) {
        return ReconcilerError(source, ` -- safeToDelete === false, aborting...`, {
            timestamp: getCurrentPacificTime(), itemId, stage: state.currentStage, stillHasDependents
        })
    }

    if (!state.itemsDeleted.includes(itemId)) {
        slog.debug(` -- itemId not in state.itemsDeleted, trying to delete item...`)
        state.currentStage = ItemReconcilerStageEnum.DELETE_OLD_ITEM;
        let deleteRes = await deleteItem(itemId, parentRecordType);
        if (!deleteRes || !deleteRes.results[0]) {
            return ReconcilerError(source, `${source} deleteItem response is null`, {
                timestamp: getCurrentPacificTime(), itemId, stage: state.currentStage, message: `${source} deleteItem response is null`
            });
        }
        slog.debug(` -- successfully deleted item!`)
        state.itemsDeleted.push(itemId);
    }
    return;
}

/**
 * @parent is the record such that `childRecord.sublists[sublistId][referenceFieldId] = parentInternalId`
 * @returns **`dictionary`** `{ [childRecordId: string]: SublistLineRecordReferenceFieldUpdate }`
 */
async function generatePlaceholderUpdate(
    parentItemId: string,
    oldReferenceId: string,
    parentRecordType: RecordTypeEnum,
    childRecordType: RecordTypeEnum,
    childInternalId: string | number,
    referenceOptions: SublistRecordReferenceOptions,
    placeholderIds: string[] | number[]
): Promise<ReferenceFieldUpdate | ReconcilerError> {
    const source = getSourceString(__filename, generatePlaceholderUpdate.name, 
        `${parentItemId}<${parentRecordType}> -> ${childInternalId}<${childRecordType}>`
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
        validate.arrayArgument(source, {newReferenceIds: placeholderIds, isNumeric});
    } catch (error: any) {
        return ReconcilerError(source, `Invalid parameters`, indentedStringify(error));
    }

    childInternalId = String(childInternalId);
    placeholderIds = (isIntegerArray(placeholderIds) 
        ? placeholderIds.map(id=>String(id)) 
        : placeholderIds
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
                ...[
                    `${source} Invalid FieldValue in get child.fields`,
                    `when setting update.parentValidationDictionary['${cacheFieldId}']`,
                    `from <${childRecordType}>RecordResult.fields['${cacheFieldId}']`,
                    `-- <${childRecordType}>RecordResult.fields['${cacheFieldId}'] = ${cacheValue}`
                ]
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
    // do not use placeholderIds that are already have been used in this particular child record
    let existingReferences: string[] = sublistLines.map(line=>
        String(line[referenceFieldId])
    );
    placeholderIds = (placeholderIds
        .filter(p=>!existingReferences.includes(p))
        .slice(0, targetLines.length)
    );
    if (targetLines.length > placeholderIds.length && placeholderIds.length !== 1) {
        return ReconcilerError(source,
            `Unable to associate new reference id's to each occurrence of oldReferenceId`,
            `targetLines.length > newReferenceIds.length && newReferenceIds.length !== 1`
        );
    }
    let sublistCacheFields = (isStringArray(cacheOptions.sublists[sublistId]) 
        ? cacheOptions.sublists[sublistId]
        : [cacheOptions.sublists[sublistId]]
    );
    if (targetLines.some(line=>
        sublistCacheFields.every(sublistFieldId=>
        !Object.keys(line).includes(sublistFieldId)))) {
        
    }
    for (let j = 0; j < targetLines.length; j++) {
        const line = targetLines[j];
        let lineCache = sublistCacheFields.reduce((acc, sublistFieldId)=>{
            if (isFieldValue(line[sublistFieldId])) {
                acc[sublistFieldId] = line[sublistFieldId];
            }
            return acc;
        }, {} as { [sublistFieldId: string]: FieldValue });
        let newReferenceValue = (placeholderIds.length === 1 
            ? placeholderIds[0] 
            : placeholderIds[j]
        );
        if (isEmpty(newReferenceValue)) {
            return ReconcilerError(source, `Invalid newReferenceId value`,
                `isEmpty(newReferenceValue) === true`,
                `index out of bounds or something?`
            );
        }
        update.lineCache[newReferenceValue] = lineCache;
    }
    return update;
}



async function rectifyState(
    updateHistory: DependentUpdateHistory
): Promise<void> {    
    const source = getSourceString(__filename, rectifyState.name);
    const state = getReconcilerState();
    state.currentStage = ItemReconcilerStageEnum.VALIDATE_INITIAL_STATE;
    const count = {
        missingDelete: 0,
        missingCreate: 0,
        badDeleteStateCount: 0
    }
    slog.debug(`${source} checking if need to modify itemsDeleted or newItems...`);
    for (let itemId in updateHistory) {
        let getRes = await getRecordById(Factory.SingleRecordRequest(
            RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM, 
            idPropertyEnum.ITEM_ID,
            itemId, 
            { fields: ['externalid', 'itemid'] }
        ));
        const [result] = getRes.results;
        if (!result) { continue }
        if (result.fields && isNonEmptyString(result.fields.externalid)) {
            if (result.fields.externalid.includes(RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM)
                && !(itemId in state.newItems) && isNumeric(getSkuDictionary()[itemId])) {
                // then has been recreated already, need to make sure state knows that;
                slog.debug(` -- already recreated item as '${result.fields.externalid}'`)
                state.newItems[itemId] = getSkuDictionary()[itemId];
                count.missingCreate++;   
                if (!state.itemsDeleted.includes(itemId)) {
                    state.itemsDeleted.push(itemId);
                    count.missingDelete++;
                }
            } else if (state.itemsDeleted.includes(itemId) 
                && !result.fields.externalid.includes(RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM)) {
                state.itemsDeleted = state.itemsDeleted.filter(item=>item !== itemId);
                count.missingDelete++;
            }
        } else {
            throw new Error(`${source} cannot check if already recreated item (no externalid in response), ${indentedStringify(getRes)}`)
        }

    }
    if (Object.values(count).some(v=> v > 0)) {
        slog.debug([`${source} state rectified: ${indentedStringify(count)}`,
            `saving state...`
        ].join(NL));
        saveState(RecordTypeEnum.INVENTORY_ITEM);
    } else {
        slog.debug( `${source} no corrections necessary`);
    }
}

function updateState(
    updateHistory: DependentUpdateHistory,
): ReconcilerState {
    const source = getSourceString(__filename, updateState.name)
    const state = getReconcilerState();
    state.currentStage = ItemReconcilerStageEnum.EVALUATE_INITIAL_STATE;
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

function saveState(
    parentRecordType: RecordTypeEnum,
    addTimestampPrefix: boolean = false
): void {
    const source = getSourceString(__filename, saveState.name);
    const state = getReconcilerState();
    if (!isNonEmptyString(reconcilerDir)) {
        throw new Error(`${source} reconcilerDir (workspace directory) is undefined`);
    }
    const statePath = path.join(
        reconcilerDir, 
        (addTimestampPrefix ? `${getFileNameTimestamp()}_` : '')
            +`${parentRecordType}_state.json`
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
    if (!isNonEmptyString(reconcilerDir)) {
        throw new Error([`${source} reconcilerDir (workspace directory) is undefined`,
        ].join(TAB));
    }
    let historyPath = path.join(
        reconcilerDir, 
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
    const state = getReconcilerState();
    state.currentStage = ItemReconcilerStageEnum.GENERATE_DEPENDENT_DICTIONARY;
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
                // await DELAY(500, null);
                if (isNonEmptyArray(getRes.results)) {
                    let children = getRes.results.map(r=>String(r.internalid));
                    dict[itemId][childRecordType] = children;
                    slog.debug(
                        ` -- ${itemId}<${parentRecordType}> has ${children.length} ${childRecordType} record(s)`
                    );
                } else {
                    slog.warn(` -- found 0 ${childRecordType} record(s) for ${itemId}<${parentRecordType}>`)
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



function getReconcilerState(): ReconcilerState {
    const source = getSourceString(__filename, getReconcilerState.name);
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

function getCreateOptions(itemId: string): Required<RecordOptions> {
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
 * @notimplemented
 * @param parentItemId 
 * @param parentInternalId 
 * @param parentRecordType 
 * @param childRecordType 
 * @param childInternalIds 
 * @returns 
 */
async function performFinalValidation(
    parentItemId: string,
    parentInternalId: string | number,
    parentRecordType: RecordTypeEnum,
    childRecordType: RecordTypeEnum,
    childInternalIds: string[],
    transactions: Required<RecordOptions>[]
): Promise<any> {
    const source = getSourceString(__filename, performFinalValidation.name, 
        `${parentItemId}: <${childRecordType}>(${childInternalIds.length})`
    );
    throw new Error(`${source} Not implemented`)
}