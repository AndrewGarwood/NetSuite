/**
 * @file src/maintenance/types/Reconcile.ts
 */

import { FieldValue, RecordResponseOptions } from "@api/types";
import { getSourceString } from "@typeshi/io";
import { isNonEmptyString } from "@typeshi/typeValidation";
import { RecordTypeEnum } from "@utils/ns";


export {
    ItemReconcilerStageEnum,
    ReconcilerState, 
    TransactionReconcilerState, TransactionReconcilerStageEnum,
    ReconcilerError, 
    ReconcilerStatusEnum, 
    DependentDictionary, 
    DependentUpdateHistory, 
    CacheOptions, 
    SublistRecordReferenceOptions, 
    ChildRecordUpdateDictionary, 
    ReferenceFieldUpdate
}


type ReconcilerState = {
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

type TransactionReconcilerState = {
    currentStage: TransactionReconcilerStageEnum;
    /** array externalid */
    deleted: string[];
    /** array externalid */
    created: string[];
    /**validated totals */
    validated: {[txnExternalId: string]: number};
    errors: any[];
}

type ReconcilerError = {
    readonly __isError: true;
    source: string;
    message?: string;
    error?: any;
    [key: string]: any;
}

enum ItemReconcilerStageEnum {
    VALIDATE_INITIAL_STATE = 'VALIDATE_INITIAL_STATE',
    GENERATE_DEPENDENT_DICTIONARY = 'GENERATE_DEPENDENT_DICTIONARY',
    GENERATE_PLACEHOLDER_UPDATE = 'GENERATE_PLACEHOLDER_UPDATE',
    RUN_PLACEHOLDER_UPDATE = 'RUN_PLACEHOLDER_UPDATE',
    VALIDATE_FIRST_UPDATE = 'VALIDATE_FIRST_UPDATE',
    DELETE_OLD_ITEM = 'DELETE_OLD_ITEM',
    CREATE_NEW_ITEM = 'CREATE_NEW_ITEM',
    GENERATE_NEW_ITEM_UPDATE = 'GENERATE_NEW_ITEM_UPDATE',
    RUN_NEW_ITEM_UPDATE = 'RUN_NEW_ITEM_UPDATE',
    END = 'END',
    EVALUATE_INITIAL_STATE = 'EVALUATE_INITIAL_STATE'
}

enum ReconcilerStatusEnum {
    SAVING_STATE = 'SAVING_STATE',
    SAVING_HISTORY = 'SAVING_HISTORY',
    PROCESSING = 'PROCESSING'
}

enum TransactionReconcilerStageEnum {
    PRE_PROCESS = 'PRE_PROCESS',
    CHECK_EXIST = 'CHECK_EXIST',
    DELETE_TRANSACTION = 'DELETE_TRANSACTION',
    CREATE_TRANSACTION = 'CREATE_TRANSACTION',
    VALIDATE_FINAL_STATE = 'VALIDATE_FINAL_STATE',
    END = 'END'
}


function ReconcilerError(
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
type CacheOptions = Required<RecordResponseOptions>;

type SublistRecordReferenceOptions = { 
    referenceFieldId: string; 
    sublistId: string;
    cacheOptions: CacheOptions;
    sublistFields: {[fieldId: string]: FieldValue};
    responseOptions: Required<RecordResponseOptions>;
}

/** 
 * `for` each `childRecordType` in `DependentDictionary[itemId]`
 * - `DependentDictionary[itemId][childRecordType].every(` record corresponding to
 * `childInternalId` has a field whose value is a `RecordReference` to `itemId )` is `true`
 * */
type DependentDictionary = { 
    [itemId: string]: {
        /**map childRecordType to internalid array */
        [childRecordType: string]: string[],
    }
}

type DependentUpdateHistory = {
    [itemId: string]: {
        [updateLabel: string]: ChildRecordUpdateDictionary,
    }
}

type ChildRecordUpdateDictionary = {
    [childRecordType: string]: {
        [childInternalId: string]: ReferenceFieldUpdate[];
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