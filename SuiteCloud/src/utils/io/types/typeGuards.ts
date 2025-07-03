/**
 * @file src/utils/io/types/typeGuards.ts
 */

import { hasKeys } from "src/utils/typeValidation";
import { FieldParseOptions, ValueMappingEntry, CloneOptions, 
    ComposeOptions, } from ".";
import { RecordOptions } from "src/utils/api";
import { CleanStringOptions, NodeLeaves, NodeStructure, RowDictionary } from "..";

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
 * - **`true`** if the `value` is an object with the key `recordType` 
 * and at least key in `['fields', 'sublists']`,
 * - **`false`** `otherwise`.
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
 * - **`true`** if the `value` is an object with keys `donorType`, `recipientType`, and `idProp`,
 * and at least one key in `['fieldIds', 'sublistIds']`,
 * - **`false`** `otherwise`.
 */
export function isCloneOptions(value: any): value is CloneOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['donorType', 'recipientType', 'idProp'])
        && hasKeys(value, ['fieldIds', 'sublistIds'], false)
    );
}

export function isComposeOptions(val: any): val is ComposeOptions {
    return (val && typeof val === 'object' 
        && typeof val.recordType === 'string' 
        && (val.fields === undefined || typeof val.fields === 'object') 
        && (val.sublists === undefined || typeof val.sublists === 'object')
    );
}

/**
 * - {@link CleanStringOptions}
 * @param value `any`
 * @returns **`isCleanStringOptions`** `boolean`
 * - **`true`** if the `value` is an object with at least one key in `['strip', 'case', 'pad', 'replace']` and no other keys,
 * - **`false`** `otherwise`.
 */
export function isCleanStringOptions(val: any): val is CleanStringOptions {
    return (val && typeof val === 'object'
        && hasKeys(val, ['strip', 'case', 'pad', 'replace'], false, true)
    );
}

/**
 * - {@link RowDictionary} = `{ [rowIndex: number]: Record<string, any>; }`
 * @param val 
 * @returns 
 */
export function isRowDictionary(val: any): val is RowDictionary {
    return (val && typeof val === 'object'
        && !Array.isArray(val)
        && Object.keys(val).length > 0
        && Object.keys(val).every(key => 
            !isNaN(Number(key))
            && Boolean(val[key]) 
            // is Record<string, any>
            && typeof val[key] === 'object' && !Array.isArray(val[key])
        )
    )
}


export function isNodeStucture(val: any): val is NodeStructure {
    return (val && typeof val === 'object'
        && !Array.isArray(val)
        && Object.keys(val).length > 0
        && Object.entries(val).every(([key, value]) => 
            typeof key === 'string' 
            && (isNodeStucture(value) || isNodeLeaves(value))
        )
    );
}

export function isNodeLeaves(val: any): val is NodeLeaves | number[] | RowDictionary {
    return ((Array.isArray(val) && val.every(v => typeof v === 'number')) 
        || isRowDictionary(val)
    );
}