/**
 * @file src/maintenance/types/Reconcile.ts
 */

import { FieldValue, RecordResponseOptions } from "@api/types";
import { getSourceString } from "@typeshi/io";
import { isNonEmptyString } from "@typeshi/typeValidation";
import { RecordTypeEnum } from "@utils/ns";

export type ReconcilerState = {
    currentStage: ItemReconcilerStageEnum;
    /** map `itemId` to `childRecordType` to `childRecordInternalId[]` */
    firstUpdate: DependentDictionary;
    itemsDeleted: string[];
    newItems: Record<string, string>;
    /** map `itemId` to `childRecordType` to `childRecordInternalId[]` */
    secondUpdate:  DependentDictionary;
    errors: any[];
    [key: string]: any;
}

export type ReconcilerError = {
    readonly __isError: true;
    source: string;
    message?: string;
    error?: any;
    [key: string]: any;
}

export enum ItemReconcilerStageEnum {
    PRE_PROCESS = 'PRE_PROCESS',
    GENERATE_PLACEHOLDER_UPDATE = 'GENERATE_PLACEHOLDER_UPDATE',
    RUN_PLACEHOLDER_UPDATE = 'RUN_PLACEHOLDER_UPDATE',
    VALIDATE_FIRST_UPDATE = 'VALIDATE_FIRST_UPDATE',
    DELETE_OLD_ITEM = 'DELETE_OLD_ITEM',
    CREATE_NEW_ITEM = 'CREATE_NEW_ITEM',
    GENERATE_NEW_ITEM_UPDATE = 'GENERATE_NEW_ITEM_UPDATE',
    RUN_NEW_ITEM_UPDATE = 'RUN_NEW_ITEM_UPDATE',
    END = 'END',
    STATE_EVALUATION = 'STATE_EVALUATION'
}



export function ReconcilerError(
    source?: string,
    message?: string,
    error?: any,
    ...details: any[]
): ReconcilerError {
    return { 
        __isError: true, 
        source: (isNonEmptyString(source) 
            ? source 
            : getSourceString(__filename, ReconcilerError.name, 'UNKNOWN_STAGE')
        ), 
        message, 
        error, 
        details 
    } as ReconcilerError;
}
export type CacheOptions = Required<RecordResponseOptions>;

export type SublistRecordReferenceOptions = { 
    referenceFieldId: string; 
    sublistId: string;
    cacheOptions: CacheOptions;
    responseOptions: Required<RecordResponseOptions>;
}

/** 
 * `for` each `childRecordType` in `DependentDictionary[itemId]`
 * - `DependentDictionary[itemId][childRecordType].every(` record corresponding to
 * `childInternalId` has a field whose value is a `RecordReference` to `itemId )` is `true`
 * */
export type DependentDictionary = { 
    [itemId: string]: {
        /**map childRecordType to internalid array */
        [childRecordType: string]: string[],
    }
}

export type DependentUpdateHistory = {
    [itemId: string]: {
        [updateLabel: string]: ChildRecordUpdateDictionary,
    }
}

export type ChildRecordUpdateDictionary = {
    [childRecordType: string]: {
        [childInternalId: string]: ReferenceFieldUpdate[];
    } 
}

export type ReferenceFieldUpdate = {
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