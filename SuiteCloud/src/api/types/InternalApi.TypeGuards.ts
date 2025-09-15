/**
 * @file src/api/types/InternalApi.TypeGuards.ts
 */

import { isNonEmptyString, isObject } from "@typeshi/typeValidation";
import { FindSublistLineWithValueOptions } from "./InternalApi";
import { isFieldValue } from "./RecordEndpoint.TypeGuards";


export function isFindSublistLineWithValueOptions(value: any): value is FindSublistLineWithValueOptions {
    const candidate = value as FindSublistLineWithValueOptions;
    return (isObject(candidate)
        && isNonEmptyString(candidate.sublistId)
        && isNonEmptyString(candidate.fieldId)
        && isFieldValue(candidate.value)
    );
}