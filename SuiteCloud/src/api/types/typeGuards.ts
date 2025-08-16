/**
 * @file src/api/types/typeGuards.ts
 */

import { hasKeys, isPrimitiveValue } from "typeshi/dist/utils/typeValidation";
import { SubrecordValue, FieldValue } from "./InternalApi";
import { RecordResponseOptions } from "../requests/types/Requests";
import { RecordOptions, RecordResponse } from "./RecordEndpoint";
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
    return (value && typeof value === 'object' 
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


/**
 * @param value `any`
 * @returns **`isRecordOptions`** `boolean`
 * - **`true`** if the `value` is an object with the key `recordType` 
 * and at least key in `['fields', 'sublists']`,
 * - **`false`** `otherwise`.
 */
export function isRecordOptions(value: any): value is RecordOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, 'recordType') 
        && hasKeys(value, 
            ['fields', 'sublists', 'recordType', 'isDynamic', 'idOptions', 'meta'], 
            false, 
            false
        )
    );
}

/**
 * - {@link RecordResponseOptions}
 * @param value `any`
 * @returns **`isRecordResponseOptions`** `boolean`
 */
export function isRecordResponseOptions(value: any): value is RecordResponseOptions {
    return (value && typeof value === 'object'
        && hasKeys(value, ['responseFields', 'responseSublists'], false, true)
    )
}

/**
 * - {@link RecordResponse}
 * @param value `any`
 * @returns **`isRecordResponse`** `boolean`
 */
export function isRecordResponse(value: any): value is RecordResponse {
    return (value && typeof value === 'object'
        && hasKeys(value, 
            ['status', 'message', 'results', 'rejects', 'error', 'logArray'], 
            false, true
        )
        && Array.isArray(value.logArray)
    );
}