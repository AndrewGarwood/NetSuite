/**
 * @file src/utils/typeValidation.ts
 */
import { logger as log } from "src/config/logging";
import { FieldValue } from "src/types/api";
import { BOOLEAN_FIELD_ID_REGEX, EMAIL_REGEX } from "./io/regex";
import { BOOLEAN_FIELD_ID_LIST } from "src/config/constants";


/** @TODO do some tests of {@link pruneObject} */


/**
 * @note maybe redundant with the syntax `key in obj` ? but able to check more than one
 * @param obj the object to check
 * @param keys the list of keys that obj must have
 * @returns {boolean} `true` if the object has all the keys, `false` otherwise
 * @throws {TypeError} if keys is not an array
 */
export function hasKeys<T extends Object>(obj: T, keys: Array<keyof T>): boolean {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    if (typeof keys === 'string') {
        keys = [keys] as Array<keyof T>; // Convert string (assumed to be single key) to array of keys
    }
    if (!keys || !Array.isArray(keys)) {
        throw new TypeError('hasKeys() param `keys` must be an array');
    }
    if (keys.length === 0) {
        return false; // No keys to check
    }
    for (const key of keys) {
        if (!obj.hasOwnProperty(key)) {
            console.warn(`hasKeys() Key "${String(key)}" not found in the object`);
            return false; // Key not found in the object
        }
    }
    return true; // All keys found in the object
}

/**
 * 
 * @param value the value to check
 * @returns `isNullLike` `{boolean}` 
 * - `true` if the value is null, undefined, empty object, empty array, or empty string
 * - `false` otherwise
 */
export function isNullLike(value: any): boolean {
    if (value === null || value === undefined) {
        return true;
    }
    // Check for empty object or array
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return true;
    }
    if (typeof value === 'string' && value.trim() === '' || value === 'undefined' || value === 'null' ) {
        return true;
    }
    return false;
}

export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}


export const isBooleanFieldId = (fieldId: string): boolean => {
    return BOOLEAN_FIELD_ID_LIST.includes(fieldId) || BOOLEAN_FIELD_ID_REGEX.test(fieldId);
}

/** @TODO see if can merge functionality with {@link hasKeys}. also compare with hasNonTrivialKeys from the js post endpoints. 
 * @description Helper to check if an object has all required, non-null/undefined properties  */
function hasRequiredProps(obj: any, props: string[]): boolean {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return false; // Not a non-array object
    }
    // Check that every required property exists and is not null or undefined
    return props.every(prop => Object.prototype.hasOwnProperty.call(obj, prop) && obj[prop] !== undefined && obj[prop] !== null);
}

/**
 * Represents the rule structure for pruning. Can be:
 * - `string[]`: Requires the target object to have these properties non-null/undefined.
 * - `ArrayElementRule`: Specifies rules to apply to each element of a target array.
 * - `{ [key: string]: RequiredRule }`: Specifies nested rules for properties of a target object.
 */
export type RequiredRule = string[] | ArrayElementRule | { [key: string]: RequiredRule };

/**
 * Special structure to define rules for array elements.
 * The `__elements__` key holds the `RequiredRule` to apply to each element.
 */
export type ArrayElementRule = { __elements__: RequiredRule };

// Helper to check if a rule is an ArrayElementRule
function isArrayElementRule(rule: RequiredRule): rule is ArrayElementRule {
    // Check if it's an object, not null, not an array, and has the specific key '__elements__'
    return typeof rule === 'object'
        && rule !== null
        && !Array.isArray(rule)
        && Object.prototype.hasOwnProperty.call(rule, '__elements__');
}

/**
 * Recursively prunes properties or array elements from an object based on specified rules.
 * If a part of the object/array doesn't meet the criteria defined in the `rule`, it's removed (set to null during recursion, then filtered out or deleted).
 * Operates on a copy of the input structure and returns the pruned copy, or null if the entire input becomes invalid according to the rules.
 *
 * @template T The type of the `input` object or array.
 * @param {T} input - The object or array to be pruned.
 * @param {RequiredRule} rule - The rule structure defining pruning criteria.
 *   - `string[]`: If `input` is an object, it must have all properties in the array (non-null/undefined). Otherwise, `input` is pruned (returns null).
 *   - `{ __elements__: RequiredRule }`: If `input` is an array, the inner rule is applied to each element. Elements pruned by the inner rule are removed. If the array becomes empty, it's pruned (returns null).
 *   - `{ [key: string]: RequiredRule }`: If `input` is an object, for each `key` in the rule object, the corresponding `subRule` is applied recursively to `input[key]`. If `input[key]` existed but is pruned by the `subRule`, the `key` is deleted from the object copy. If the object becomes empty after pruning, it's pruned (returns null).
 * @returns {T | null} The pruned object/array, or null if the input itself is pruned according to the rules.
 */
export function pruneObject<T>(input: T, rule: RequiredRule): T | null {

    // Inner recursive function
    function pruneRecursive<U>(currentValue: U, currentRule: RequiredRule): U | null {
        // Base case: Null or undefined values cannot meet requirements.
        if (currentValue === null || currentValue === undefined) {
            return null;
        }

        // 1. Rule is string[] (Required Properties for an Object)
        if (Array.isArray(currentRule)) {
            // This rule only applies meaningfully to non-array objects.
            if (typeof currentValue === 'object' && !Array.isArray(currentValue) && currentValue !== null) {
                if (hasRequiredProps(currentValue, currentRule)) {
                    // The object has the required props, return it (as potentially further pruned by other rules if nested)
                    return currentValue;
                } else {
                    // Object is missing one or more required properties. Prune this object.
                    log.debug(`Pruning object ${JSON.stringify(currentValue)} missing props: ${currentRule.filter(prop => !(prop in currentValue) || currentValue[prop as keyof typeof currentValue] == null).join(', ')}`);
                    return null;
                }
            } else {
                // Rule is string[], but current value is not an object. This is a mismatch. Prune.
                log.debug(`Pruning value ${JSON.stringify(currentValue)}: Rule expected object with props ${currentRule.join(', ')}, got ${typeof currentValue}.`);
                return null;
            }
        }

        // 2. Rule is for Array Elements
        if (isArrayElementRule(currentRule)) {
            // This rule only applies meaningfully to arrays.
            if (Array.isArray(currentValue)) {
                const elementRule = currentRule.__elements__;
                const prunedArray = currentValue
                    // Apply the element rule recursively to each item
                    .map(item => pruneRecursive(item, elementRule))
                    // Filter out items that were pruned (returned null)
                    .filter(item => item !== null);

                // Return the pruned array, or null if the array becomes empty
                return prunedArray.length > 0 ? (prunedArray as U) : null;
            } else {
                // Rule is for array elements, but current value is not an array. Mismatch. Prune.
                log.debug(`Pruning value ${JSON.stringify(currentValue)}: Rule expected an array, got ${typeof currentValue}.`);
                return null;
            }
        }

        // 3. Rule is a Nested Object (Recursive Rules for Object Properties)
        // Check it's a plain object rule, not an array rule or null
        if (typeof currentRule === 'object' && !Array.isArray(currentRule) && currentRule !== null) {
            // This rule only applies meaningfully to non-array objects.
            if (typeof currentValue === 'object' && !Array.isArray(currentValue) && currentValue !== null) {
                // Work on a shallow copy for modification at this level
                const currentObject = { ...currentValue } as any;
                let objectModified = false;
                const keysToDelete: string[] = [];

                // Iterate over the keys specified in the rule for this level
                for (const key in currentRule) {
                    // Ensure it's a property of the rule object itself
                    if (!Object.prototype.hasOwnProperty.call(currentRule, key)) {
                        continue;
                    }

                    const subRule = currentRule[key];
                    // Get the original value from the object copy for the key specified in the rule
                    const targetValue = currentObject[key];

                    // Recursively prune the target value using the sub-rule
                    const prunedSubValue = pruneRecursive(targetValue, subRule);

                    // Check if the key actually exists in the current object before deciding action
                    if (Object.prototype.hasOwnProperty.call(currentObject, key)) {
                        if (prunedSubValue === null) {
                            // If the target existed but was pruned to null by the sub-rule, mark the key for deletion
                            keysToDelete.push(key);
                            objectModified = true;
                        } else if (prunedSubValue !== targetValue) {
                            // If the target was modified (but not fully pruned), update it in the copy
                            currentObject[key] = prunedSubValue;
                            objectModified = true;
                        }
                        // If prunedSubValue === targetValue, no change needed for this key's value.
                    }
                    // If the key from the rule doesn't exist in the object, we don't add/delete anything based on it.
                    // The pruning logic applies to the *content* of existing keys based on the rules provided.
                }

                // Delete the keys marked for deletion after the loop finishes
                keysToDelete.forEach(key => {
                    log.debug(`Pruning property '${key}' from parent object.`);
                    delete currentObject[key];
                });

                // If properties were deleted and the object is now empty, prune the object itself.
                if (objectModified && Object.keys(currentObject).length === 0) {
                    log.debug(`Pruning object ${JSON.stringify(currentValue)} as it became empty after pruning.`);
                    return null;
                }

                // Return the potentially modified object copy
                return currentObject as U;
            } else {
                // Rule is object, but current value is not an object. Mismatch. Prune.
                log.debug(`Pruning value ${JSON.stringify(currentValue)}: Rule expected an object, got ${typeof currentValue}.`);
                return null;
            }
        }

        // If the rule structure is unrecognized or doesn't apply to the value type,
        // return the value unchanged, assuming it's valid by default if no rule matches.
        log.warn(`Value ${JSON.stringify(currentValue)} did not match any applicable rule structure in ${JSON.stringify(currentRule)}. Returning value as is.`);
        return currentValue;
    }

    // Start recursion with the input value and the top-level rule
    return pruneRecursive(input, rule);
}
