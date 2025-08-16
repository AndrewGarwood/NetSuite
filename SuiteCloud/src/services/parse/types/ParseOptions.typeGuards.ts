
import { hasKeys, isNonEmptyArray, isNonEmptyString } from "typeshi/dist/utils/typeValidation";
import { FieldParseOptions, ParseResults, ValueMappingEntry } from "./ParseOptions";
import { isRecordOptions } from "../../../api/types";

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

export function isParseResults(value: any): value is ParseResults {
    return (value && typeof value =='object'
        && Object.keys(value).every(k => isNonEmptyString(k)
            && isNonEmptyArray(value[k])
            && value[k].every(element=>isRecordOptions(element))
        )
    )
}