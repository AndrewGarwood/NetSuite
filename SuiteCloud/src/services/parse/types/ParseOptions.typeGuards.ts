/**
 * @file src/services/parse/types/ParseOptions.TypeGuards.ts
 */
import { hasKeys, isNonEmptyArray, isNonEmptyString, isStringArray, isObject } from "typeshi:utils/typeValidation";
import { FieldParseOptions, ParseResults, ValueMappingEntry } from "./ParseOptions";
import { isFieldValue, isRecordOptions, isRecordTypeEnum } from "../../../api/types";

/**
 * @description Checks if the given value is a {@link ValueMappingEntry} = `{ newValue`: {@link FieldValue}, `validColumns`: `string | string[] }`.
 * @param value `any`
 * @returns **`isValueMappingEntry`** `boolean`
 * - **`true`** if the `value` is an object with keys `newValue` and `validColumns`,
 * - **`false`** `otherwise`.
 */
export function isValueMappingEntry(value: any): value is ValueMappingEntry {
    const candidate = value as ValueMappingEntry;
    return (isObject(candidate)
        && isFieldValue(candidate.newValue)
        && (isNonEmptyString(candidate.validColumns) || isStringArray(candidate.validColumns))
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
    const candidate = value as FieldParseOptions;
    return (isObject(candidate)
        && hasKeys(candidate, ['defaultValue', 'colName', 'evaluator', 'args'], false)
    );
}

export function isParseResults(value: any): value is ParseResults {
    const candidate = value as ParseResults;
    return (isObject(candidate)
        && Object.keys(candidate).every(k => isRecordTypeEnum(k)
            && candidate[k].every(element=>isRecordOptions(element))
        )
    )
}