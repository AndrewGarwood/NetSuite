/**
 * @file src/api/types/typeGuards.ts
 */

import { hasKeys, isPrimitiveValue } from "../../utils/typeValidation";
import { SubrecordValue, FieldValue } from "./InternalApi";
import { RecordResponseOptions } from "../requests/types/Requests";

/**
 * - {@link SubrecordValue}
 * - {@link SetFieldSubrecordOptions}
 * - {@link SetSublistSubrecordOptions}
 * - {@link SubrecordParseOptions}
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
    return (value && typeof value === 'object' 
        && 'subrecordType' in value 
        && (isSubrecordParseOptions || isSetSubrecordOptions)
    ); 
}

/**
 * @param value 
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

export function isRecordResponseOptions(value: any): value is RecordResponseOptions {
    return (value && typeof value === 'object'
        && hasKeys(value, ['responseFields', 'responseSublists'], false, true)
    )
}