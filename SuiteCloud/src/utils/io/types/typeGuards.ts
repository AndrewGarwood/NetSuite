/**
 * @file src/utils/io/types/typeGuards.ts
 */

import { hasKeys, isNonEmptyString } from "src/utils/typeValidation";
import { FieldParseOptions, ValueMappingEntry, CloneOptions, 
    ComposeOptions, WriteJsonOptions} from ".";
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
        && hasKeys(value, 
            ['fields', 'sublists', 'recordType', 'isDynamic', 'idOptions'], 
            false, 
            true
        )
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

export function isComposeOptions(value: any): value is ComposeOptions {
    return (value && typeof value === 'object' 
        && typeof value.recordType === 'string' 
        && (value.fields === undefined || typeof value.fields === 'object') 
        && (value.sublists === undefined || typeof value.sublists === 'object')
    );
}

/**
 * - {@link CleanStringOptions}
 * @param value `any`
 * @returns **`isCleanStringOptions`** `boolean`
 * - **`true`** if the `value` is an object with at least one key in `['strip', 'case', 'pad', 'replace']` and no other keys,
 * - **`false`** `otherwise`.
 */
export function isCleanStringOptions(value: any): value is CleanStringOptions {
    return (value && typeof value === 'object'
        && hasKeys(value, ['strip', 'case', 'pad', 'replace'], false, true)
    );
}

/**
 * - {@link RowDictionary} = `{ [rowIndex: number]: Record<string, any>; }`
 * @param value 
 * @returns 
 */
export function isRowDictionary(value: any): value is RowDictionary {
    return (value && typeof value === 'object'
        && !Array.isArray(value)
        && Object.keys(value).length > 0
        && Object.keys(value).every(key => 
            !isNaN(Number(key))
            && Boolean(value[key]) 
            // is Record<string, any>
            && typeof value[key] === 'object' && !Array.isArray(value[key])
        )
    )
}


export function isNodeStucture(value: any): value is NodeStructure {
    return (value && typeof value === 'object'
        && !Array.isArray(value)
        && Object.keys(value).length > 0
        && Object.entries(value).every(([key, value]) => 
            typeof key === 'string' 
            && (isNodeStucture(value) || isNodeLeaves(value))
        )
    );
}

export function isNodeLeaves(value: any): value is NodeLeaves | number[] | RowDictionary {
    return ((Array.isArray(value) && value.every(v => typeof v === 'number')) 
        || isRowDictionary(value)
    );
}

export function isWriteJsonOptions(value: any): value is WriteJsonOptions {
    return (value && typeof value === 'object'
        && !Array.isArray(value)
        && value.data !== undefined
        && (typeof value.data === 'object' || typeof value.data === 'string')
        && isNonEmptyString(value.filePath)
        && (value.indent === undefined 
            || (typeof value.indent === 'number' && value.indent >= 0)
        )
        && (value.enableOverwrite === undefined 
            || typeof value.enableOverwrite === 'boolean'
        )
    );
}