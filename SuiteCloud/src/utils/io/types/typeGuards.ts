/**
 * @file src/utils/io/types/typeGuards.ts
 */

import { hasKeys } from "src/utils/typeValidation";
import { FieldParseOptions, ValueMappingEntry, CloneOptions } from ".";
import { RecordOptions } from "src/utils/api";

/**
 * @param value `any`
 * @returns 
 */
export function isFieldParseOptions(value: any): value is FieldParseOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['defaultValue', 'colName', 'evaluator', 'args'], false)
    );
}

/**
 * @description Checks if the given value is a {@link ValueMappingEntry} = `{ newValue`: {@link FieldValue}, `validColumns`: `string | string[] }`.
 * @param value `any`
 */
export function isValueMappingEntry(value: any): value is ValueMappingEntry {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['newValue', 'validColumns'])
    );
}

/**
 * @param value `any`
 * @returns **`isPostRecordOptions`** `boolean`
 * - `true` if the `value` is a valid {@link RecordOptions} object,
 * - `false` `otherwise`.
 */
export function isPostRecordOptions(value: any): value is RecordOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, 'recordType') 
        && hasKeys(value, ['fields', 'sublists'], false)
    );
}

/**
 * @param value `any`
 * @returns 
 */
export function isCloneOptions(value: any): value is CloneOptions {
    return (value && typeof value === 'object' 
        && hasKeys(value, ['donorType', 'recipientType', 'idProp'])
        && hasKeys(value, ['fieldIds', 'sublistIds'], false)
    );
}
