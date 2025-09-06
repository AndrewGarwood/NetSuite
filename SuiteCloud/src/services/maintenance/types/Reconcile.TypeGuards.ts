/**
 * @file src/maintenance/types/Reconcile.TypeGuards.ts
 */
import { isEmptyArray, isNonEmptyString, isNumeric, isObject, isStringArray } from "@typeshi/typeValidation";
import { ReconcilerError, DependentUpdateHistory, ReferenceFieldUpdate, ChildRecordUpdateDictionary, ReconcilerState } from "./Reconcile";
import { isRecordTypeEnum } from "@api/types";


export function isReconcilerError(value: any): value is ReconcilerError {
    const candidate = value as ReconcilerError;
    return (isObject(candidate) 
        && isNonEmptyString(candidate.source)
        && (candidate.__isError === true)
    );
}

export function isReconcilerState(value: any): value is ReconcilerState {
    const candidate = value as ReconcilerState;
    return (isObject(candidate)
        && isObject(candidate.firstUpdate, false)
        && (isEmptyArray(candidate.itemsDeleted) || isStringArray(candidate.itemsDeleted))
        && isObject(candidate.newItems, false)
        && isObject(candidate.secondUpdate, false)
    );
}

export function isDependentUpdateHistory(value: any): value is DependentUpdateHistory {
    const candidate = value as DependentUpdateHistory;
    return (isObject(candidate, false)
        && Object.keys(candidate).every(itemId=> 
            isNonEmptyString(itemId)
            && isObject(candidate[itemId], false)
            && Object.keys(candidate[itemId]).every(updateLabel=>
                isNonEmptyString(updateLabel)
                && isChildRecordUpdateDictionary(candidate[itemId][updateLabel])
            )
        )
    )
}

export function isChildRecordUpdateDictionary(value: any): value is ChildRecordUpdateDictionary {
    const candidate = value as ChildRecordUpdateDictionary;
    return (isObject(candidate, false)
        && Object.keys(candidate).every(childRecordType=>
            isRecordTypeEnum(childRecordType)
            && isObject(candidate[childRecordType], false)
            && Object.keys(candidate[childRecordType]).every(childInternalId=>
                isNumeric(childInternalId, true)
                && Array.isArray(candidate[childRecordType][childInternalId])
                && candidate[childRecordType][childInternalId].every(
                    el=>isReferenceFieldUpdate(el)
                )
            )
        )
    )
}


export function isReferenceFieldUpdate(value: any): value is ReferenceFieldUpdate {
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
