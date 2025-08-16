/**
 * @file src/services/post_process/types/PostProcessing.typeGuards.ts
 */

import { 
    CloneOptions, ComposeOptions, CompositeSublistComposer 
} from "./PostProcessing";
import { hasKeys } from "typeshi/dist/utils/typeValidation";

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


export function isCompositeSublistComposer(
    value: any
): value is CompositeSublistComposer {
    return (value && typeof value === 'object'
        && hasKeys(value, 'composer', true, true)
        && typeof value.composer === 'function'
    );
}
