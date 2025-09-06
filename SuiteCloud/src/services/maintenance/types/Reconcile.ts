import { FieldValue, RecordResponseOptions } from "@api/types";
import { getSourceString } from "@typeshi/io";
import { extractFileName } from "@typeshi/regex";
import { isNonEmptyString } from "@typeshi/typeValidation";
import { RecordTypeEnum } from "@utils/ns";


const F = extractFileName(__filename);

export type ReconcilerState = {
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
    END = 'END'
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
            : getSourceString(F, ReconcilerError.name, 'UNKNOWN_STAGE')
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