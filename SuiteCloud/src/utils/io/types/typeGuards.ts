/**
 * @file src/utils/io/types/typeGuards.ts
 */

import { hasKeys, isIntegerArray, isNonEmptyString } from "src/utils/typeValidation";
import { FieldParseOptions, ValueMappingEntry, CloneOptions, 
    ComposeOptions, WriteJsonOptions, RowSourceMetaData, 
    FileData} from ".";
import { RecordOptions } from "src/api";
import { NodeLeaves, NodeStructure, RowDictionary } from "..";

/**
 * @consideration `FILE_NAME_WITH_EXTENSION_PATTERN = /^[^/\\:*?"<>|]+(\.[^/\\:*?"<>|]+)$/`
 * @param value `any`
 * @returns **`isFileData`** `boolean`
 * - **`true`** if the `value` is a {@link FileData} object with keys `fileName` and `fileContent`,
 * where `fileName` is a string and `fileContent` is a base64 encoded string,
 * - && fileNamePattern.test(value.fileName)
 * - **`false`** `otherwise`.
 */
export function isFileData(value: any): value is FileData {
    return (value && typeof value === 'object'
        && hasKeys(value, ['fileName', 'fileContent'])
        && isNonEmptyString(value.fileName)
        // && fileNamePattern.test(value.fileName)
        && isNonEmptyString(value.fileContent)
    );
}

/**
 * 
 * @param value `any`
 * @returns **`isRowSourceMetaData`** `boolean`
 * - **`true`** `if` `value` is an object such that 
 * each of its keys is a string that maps to an integer array
 * - **`false`** `otherwise`
 */
export function isRowSourceMetaData(value: any): value is RowSourceMetaData {
    return (value && typeof value === 'object'
        && Object.keys(value).every(key => 
            isNonEmptyString(key) && isIntegerArray(value[key])
        )
    );
}

/**
 * @param value `any`
 * @returns **`isFieldParseOptions`** `boolean`
 * - **`true`** if the `value` is an object and has any of the following keys: 
 * `['defaultValue', 'colName', 'evaluator', 'args']`,
 * - **`false`** `otherwise`
 */
export function isFieldParseOptions(value: any): value is FieldParseOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['defaultValue', 'colName', 'evaluator', 'args'], false)
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
            ['fields', 'sublists', 'recordType', 'isDynamic', 'idOptions', 'meta'], 
            false, 
            false
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
        && hasKeys(value, ['recordType', 'fields', 'sublists', 'idOptions'], false) 
        && typeof value.recordType === 'string' 
        && (value.fields === undefined || typeof value.fields === 'object') 
        && (value.sublists === undefined || typeof value.sublists === 'object')
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