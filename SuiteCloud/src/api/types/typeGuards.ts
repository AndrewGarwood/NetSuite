/**
 * @file src/api/types/typeGuards.ts
 */

import { hasKeys, isPrimitiveValue, isObject, isNonEmptyString, isStringArray, isNonEmptyArray } from "typeshi/dist/utils/typeValidation";
import { SubrecordValue, FieldValue } from "./InternalApi";
import { RecordResponseOptions, ChildSearchOptions, RelatedRecordRequest, idSearchOptions } from "./RecordEndpoint";
import { RecordOptions, RecordResponse } from "./RecordEndpoint";
import { RecordTypeEnum } from "../../utils/ns/Enums";

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

/**
 * @param value `any`
 * @returns **`isRecordOptions`** `boolean`
 * - **`true`** if the `value` is an object with the key `recordType` 
 * and at least key in `['fields', 'sublists']`,
 * - **`false`** `otherwise`.
 */
export function isRecordOptions(value: any): value is RecordOptions {
    return (isObject(value)
        && hasKeys(value, 'recordType') 
        && hasKeys(value, 
            ['fields', 'sublists', 'recordType', 'isDynamic', 'idOptions', 'meta'], 
            false, false
        )
        && isRecordTypeEnum(value.recordType)
    );
}

/**
 * - {@link RecordResponseOptions}
 * @param value `any`
 * @returns **`isRecordResponseOptions`** `boolean`
 */
export function isRecordResponseOptions(value: any): value is RecordResponseOptions {
    return (isObject(value) 
    && hasKeys(value, ['fields', 'sublists'], false, true))
    && (!value.fields 
        || (isNonEmptyString(value.fields) 
            || isStringArray(value.fields)
        )
    )
    && (!value.sublists 
        || (isObject(value.sublists)
            && Object.keys(value.sublists).every(
                k=>isNonEmptyString(value.sublists[k]) 
                    || isStringArray(value.sublists[k])
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
    return (isObject(value)
        && hasKeys(value, 
            ['status', 'message', 'results', 'rejects', 'error', 'logs'], 
            false, true
        )
    );
}

/**
 * @param value `any`
 * @returns **`isChildSearchOptions`** `boolean`
 */
export function isChildSearchOptions(value: any): value is ChildSearchOptions {
    return (isObject(value)
        && isRecordTypeEnum(value.childRecordType)
        && isNonEmptyString(value.fieldId)
        && (!value.sublistId || isNonEmptyString(value.sublistId))
        && (!value.responseOptions || isRecordResponseOptions(value.responseOptions))
    );
}

export function isRelatedRecordRequest(value: any): value is RelatedRecordRequest {
    return (isObject(value)
        && hasKeys(value, ['parentRecordType', 'idOptions', 'childOptions'], true, true)
        && isRecordTypeEnum(value.parentRecordType)
        && isNonEmptyArray(value.idOptions) 
        && value.idOptions.every((el: any)=>isIdSearchOptions(el))
        && isNonEmptyArray(value.childOptions)
        && value.childOptions.every((el: any)=>isChildSearchOptions(el))
    );
}


export function isIdSearchOptions(value: any): value is idSearchOptions {
    return (isObject(value) 
        && hasKeys(value, ['idProp', 'idValue', 'searchOperator'], true, true) 
        && isNonEmptyString(value.idProp)
        && isNonEmptyString(value.searchOperator)
    )
}