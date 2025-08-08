/**
 * @file src/utils/regex/types/typeGuards.ts
 */
import { CleanStringOptions } from ".";
import { hasKeys } from "../../typeValidation";

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
