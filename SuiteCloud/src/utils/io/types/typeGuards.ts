/**
 * @file src/utils/io/types/typeGuards.ts
 */

import { hasKeys } from "src/utils/typeValidation";
import { FieldParseOptions, ValueMappingEntry, CloneOptions, ComposeOptions } from ".";
import { RecordOptions } from "src/utils/api";

/**
 * @param value `any`
 * @returns **`isFieldParseOptions`** `boolean`
 * - **`true`** if the `value` is an object and has any of the following keys: 
 * `['defaultValue', 'colName', 'evaluator', 'args']`,
 * - **`false`** `otherwise`.
 */
export function isFieldParseOptions(value: any): value is FieldParseOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['defaultValue', 'colName', 'evaluator', 'args'], false)
    );
}

/**
 * @description Checks if the given value is a {@link ValueMappingEntry} = `{ newValue`: {@link FieldValue}, `validColumns`: `string | string[] }`.
 * @param value `any`
 * @returns **`isValueMappingEntry`** `boolean`
 * - **`true`** if the `value` is an object with keys `newValue` and `validColumns`,
 * - **`false`** `otherwise`.
 */
export function isValueMappingEntry(value: any): value is ValueMappingEntry {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['newValue', 'validColumns'])
    );
}

/**
 * @param value `any`
 * @returns **`isRecordOptions`** `boolean`
 * - `true` if the `value` is an object with the key `recordType` 
 * and at least key in `['fields', 'sublists']`,
 * - `false` `otherwise`.
 */
export function isRecordOptions(value: any): value is RecordOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, 'recordType') 
        && hasKeys(value, ['fields', 'sublists'], false)
    );
}

/**
 * @param value `any`
 * @returns **`isCloneOptions`** `boolean`
 * - `true` if the `value` is an object with keys `donorType`, `recipientType`, and `idProp`,
 * and at least one key in `['fieldIds', 'sublistIds']`,
 * - `false` `otherwise`.
 */
export function isCloneOptions(value: any): value is CloneOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['donorType', 'recipientType', 'idProp'])
        && hasKeys(value, ['fieldIds', 'sublistIds'], false)
    );
}

export function isComposeOptions(obj: any): obj is ComposeOptions {
    return (obj && typeof obj === 'object' 
        && typeof obj.recordType === 'string' 
        && (obj.fields === undefined || typeof obj.fields === 'object') 
        && (obj.sublists === undefined || typeof obj.sublists === 'object')
    );
}