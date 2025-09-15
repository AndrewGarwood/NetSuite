/**
 * @file src/api/types/RecordEndpoint.TypeGuards.ts
 */

import { 
    hasKeys, isPrimitiveValue, isObject, isNonEmptyString, isStringArray, isNonEmptyArray, 
    isEmptyArray,
    isInteger,
    isEmpty
} from "typeshi:utils/typeValidation";
import { SubrecordValue, FieldValue } from "./InternalApi";
import { isFindSublistLineWithValueOptions } from "./InternalApi.TypeGuards";
import { RecordResponseOptions, ChildSearchOptions, RelatedRecordRequest, idSearchOptions, 
    RecordOptions, RecordResponse, SingleRecordRequest, SublistUpdateDictionary,
    SetFieldSubrecordOptions,
    SetSublistSubrecordOptions, RecordResult,
    RecordRequest
} from "./RecordEndpoint";
import { RecordTypeEnum } from "../../utils/ns/Enums";


export function isSublistUpdateDictionary(value: any, requireNonEmpty: boolean = true): value is SublistUpdateDictionary {
    const candidate = value as SublistUpdateDictionary;
    return (isObject(candidate, requireNonEmpty)
        && Object.keys(candidate).every(k=>isNonEmptyString(k)
            && isObject(candidate[k])
            && candidate[k].newValue !== undefined
            && isFindSublistLineWithValueOptions(candidate[k].lineIdOptions)
        )
    );
}

export function isRecordResult(value: any): value is RecordResult {
    const candidate = value as RecordResult;
    return (isObject(candidate)
        && isInteger(candidate.internalid)
        && isRecordTypeEnum(candidate.recordType)
        && (!candidate.fields || isObject(candidate.fields, false))
        && (!candidate.sublists || isObject(candidate.sublists, false))
    );
}

/**
 * - {@link FieldValue}
 * @param value `any`
 * @returns **`isFieldValue`** `boolean`
 * - `true` if the `value` is a primitive value (string, number, boolean, null, undefined),
 * - `true` if the `value` is a Date object,
 * - `true` if the `value` is an array of primitive values,
 * - `false` otherwise.
 */
export function isFieldValue(value: any): value is FieldValue {
    if (isPrimitiveValue(value)) {
        return true;
    }
    if (value instanceof Date) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every(item => isPrimitiveValue(item));
    }
    return false;
}

export function isRecordTypeEnum(value: any): value is RecordTypeEnum {
    return (isNonEmptyString(value)
        && Object.values(RecordTypeEnum).includes(value as RecordTypeEnum)
    );
}

export function isRecordRequest(value: any): value is RecordRequest {
    const candidate = value as RecordRequest;
    return (isObject(candidate) 
        && ((isNonEmptyArray(candidate.recordOptions) 
                && candidate.recordOptions.every(el=>isRecordOptions(el))
            ) 
            || isRecordOptions(candidate.recordOptions)
        )
        && (!candidate.responseOptions || isRecordResponseOptions(candidate.responseOptions))
    )
} 

/**
 * @param value `any`
 * @returns **`isRecordOptions`** `boolean`
 * - **`true`** if the `value` is an object with the key `recordType` 
 * and at least key in `['fields', 'sublists']`,
 * - **`false`** `otherwise`.
 */
export function isRecordOptions(value: any): value is RecordOptions {
    const candidate = value as RecordOptions;
    return (isObject(candidate)
        && isRecordTypeEnum(candidate.recordType)
        && (!candidate.fields || isObject(candidate.fields, false))
        && (!candidate.sublists || isObject(candidate.sublists, false))
        && (!candidate.idOptions || isIdOptions(candidate.idOptions, false)) 
        && isRecordTypeEnum(value.recordType)
    );
}

/**
 * - {@link RecordResponseOptions}
 * @param value `any`
 * @returns **`isRecordResponseOptions`** `boolean`
 */
export function isRecordResponseOptions(value: any): value is RecordResponseOptions {
    const candidate = value as RecordResponseOptions;
    return (isObject(candidate) 
        && (!candidate.fields 
            || isNonEmptyString(candidate.fields) 
            || isEmptyArray(candidate.fields) 
            || isStringArray(candidate.fields)
            
        )
        && (!candidate.sublists 
            || (isObject(candidate.sublists, false)
                && Object.keys(candidate.sublists).every(k=>
                    isNonEmptyString(k) 
                    && (!candidate.sublists 
                        || isNonEmptyString(candidate.sublists[k])
                        || isEmptyArray(candidate.sublists[k]) 
                        || isStringArray(candidate.sublists[k])
                    )
                )
            )
        )
    )
}

/**
 * - {@link RecordResponse}
 * @param value `any`
 * @returns **`isRecordResponse`** `boolean`
 */
export function isRecordResponse(value: any): value is RecordResponse {
    const candidate = value as RecordResponse;
    return (isObject(candidate)
        && isInteger(candidate.status)
        && isNonEmptyString(candidate.message)
        && (!candidate.error || isNonEmptyString(candidate.error))
        && Array.isArray(candidate.results)
        && Array.isArray(candidate.rejects)
        && Array.isArray(candidate.logs)
    );
}

/**
 * @param value `any`
 * @returns **`isChildSearchOptions`** `boolean`
 */
export function isChildSearchOptions(value: any): value is ChildSearchOptions {
    const candidate = value as ChildSearchOptions;
    return (isObject(candidate)
        && isRecordTypeEnum(candidate.childRecordType)
        && isNonEmptyString(candidate.fieldId)
        && (!candidate.sublistId || isNonEmptyString(candidate.sublistId))
        && (!candidate.responseOptions || isRecordResponseOptions(candidate.responseOptions))
    );
}

export function isChildOptions(value: any): value is ChildSearchOptions[] {
    return (isNonEmptyArray(value) && value.every(el=>isChildSearchOptions(el)));
}

export function isRelatedRecordRequest(value: any): value is RelatedRecordRequest {
    const candidate = value as RelatedRecordRequest;
    return (isObject(candidate)
        && isRecordTypeEnum(candidate.parentRecordType)
        && isIdOptions(candidate.idOptions, true)
        && isNonEmptyArray(candidate.childOptions)
        && candidate.childOptions.every((el)=>isChildSearchOptions(el))
    );
}

export function isSingleRecordRequest(value: any): value is SingleRecordRequest {
    const candidate = value as SingleRecordRequest;
    return (isObject(candidate)
        && isRecordTypeEnum(candidate.recordType)
        && isIdOptions(candidate.idOptions, true)
        && (!candidate.responseOptions || isRecordResponseOptions(candidate.responseOptions))
    );
}


export function isIdSearchOptions(value: any): value is idSearchOptions {
    const candidate = value as idSearchOptions;
    return (isObject(candidate) 
        && (!isEmpty(candidate.idValue))
        && isNonEmptyString(candidate.idProp)
        && isNonEmptyString(candidate.searchOperator)
    );
}

export function isIdOptions(value: any, requireNonEmpty: boolean = false): value is idSearchOptions[] {
    return ((!requireNonEmpty && isEmptyArray(value)) 
        || (isNonEmptyArray(value) && value.every((el: any)=>isIdSearchOptions(el)))
    );
}

// export function isSublistFieldValueUpdate(value: any): value is SublistFieldValueUpdate {
//     return (isObject(value)
//         && hasKeys(value, ['newValue', 'lineIdOptions'], true, true)
//         && isFindSublistLineWithValueOptions(value.lineIdOptions)
//     );
// }


/**
 * - {@link SubrecordValue}
 * @param value `any`
 * @returns **`isSubrecordValue`** `boolean`
 * - `true` `if` `value` `isSubrecordParseOptions` or `isSetSubrecordOptions`,
 * - `false` `otherwise`.
 */
export function isSubrecordValue(value: any): value is SubrecordValue {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const isSubrecordParseOptions = hasKeys(
        value, ['fieldOptions', 'sublistOptions'], false
    );
    const isSetSubrecordOptions = (hasKeys(value, 'fieldId') 
        && hasKeys(value, ['fields', 'sublists'], false)
    );
    return (isObject(value)
        && 'subrecordType' in value 
        && (isSubrecordParseOptions || isSetSubrecordOptions)
    ); 
}

// @ consideration merge SetSublistSubrecordOptions and SetFieldSubrecordOptions


export function isSetSublistSubrecordOptions(value: any): value is SetSublistSubrecordOptions {
    const candidate = value as SetSublistSubrecordOptions;
    return (isSetFieldSubrecordOptions(value)
        && isNonEmptyString(candidate.sublistId)
    )
}

export function isSetFieldSubrecordOptions(value: any): value is SetFieldSubrecordOptions {
    const candidate = value as SetFieldSubrecordOptions;
    return (isObject(candidate)
        && isNonEmptyString(candidate.fieldId)
        && isNonEmptyString(candidate.subrecordType)
        && (isObject(candidate.fields) || isObject(candidate.sublists))
    )
}