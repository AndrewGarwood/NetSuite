/**
 * @file src/api/types/InternalApi.TypeGuards.ts
 */

import { hasKeys, isNonEmptyString, isObject } from "@typeshi/typeValidation";
import { FindSublistLineWithValueOptions } from "./InternalApi";


export function isFindSublistLineWithValueOptions(value: any): value is FindSublistLineWithValueOptions {
    return (isObject(value)
        && hasKeys(value, ['sublistId', 'fieldId', 'value'], true, true)
        && isNonEmptyString(value.sublistId)
        && isNonEmptyString(value.fieldId)
    );
}