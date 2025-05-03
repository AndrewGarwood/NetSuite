/**
 * @file src/utils/typeValidation.ts
 */
import { FieldValue } from "src/utils/api/types";
import { BOOLEAN_FIELD_ID_REGEX, EMAIL_REGEX } from "./io/regex";


export const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y'];
export const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n'];

export const BOOLEAN_FIELD_ID_LIST = [
    'isinactive', 'isprivate', 'giveaccess', 'emailtransactions', 'faxtransactions', 
    'is1099eligible', 'isdefaultbilling', 'isdefaultshipping', 'isprimary', 'isprimaryshipto', 
    'isprimarybilling', 'isprimaryshipping'
];

export const isBooleanFieldId = (fieldId: string): boolean => {
    return BOOLEAN_FIELD_ID_LIST.includes(fieldId) || BOOLEAN_FIELD_ID_REGEX.test(fieldId);
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
    if (typeof value === 'boolean' || typeof value === 'number') {
        return false;
    }
    // Check for empty object or array
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return true;
    }
    if (typeof value === 'string' && value.trim() === '' || value.toLowerCase() === 'undefined' || value.toLowerCase() === 'null' ) {
        return true;
    }
    return false;
}

/** test input string on `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` */
export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}

/**
 * @param {any} arr 
 * @returns {boolean} `true` if arr is an array and has at least one element, `false` otherwise.
 */
export function isNonEmptyArray(arr: any): boolean {
    return Array.isArray(arr) && arr.length > 0;
}
/**
 * @description Check if an object has any non-empty keys (not `undefined`, `null`, or empty string). 
 * - passing in an array will return `false`.
 * @param {Object} obj - The object to check.
 * @returns {boolean} `true` if the object has any non-empty keys, `false` otherwise.
 */
export function hasNonTrivialKeys(obj: any): boolean {
    if (typeof obj !== 'object' || !obj || Array.isArray(obj)) {
        return false;
    }
    for (const key in obj) { // return true if any key is non-empty
        let value = obj[key];
        let valueIsNonTrivial = (obj.hasOwnProperty(key) 
            && value !== undefined 
            && value !== null 
            && (value !== '' 
                || isNonEmptyArray(value) 
                || (typeof value === 'object' && isNonEmptyArray(Object.entries(value)))
            )
        );
        if (valueIsNonTrivial) {
            return true;
        }
    }
    return false;
}

/**
 * @note maybe redundant with the syntax `key in obj` ? but able to check more than one
 * @param obj the object to check
 * @param keys the list of keys that obj must have
 * @returns {boolean} `true` if the object has all the keys, `false` otherwise
 * @throws {TypeError} if `keys` is not an array
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

/** Helper to check if an object has all required, non-null/undefined properties */
function hasRequiredProps(obj: any, props: string[]): boolean {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return false; // Not a non-array object
    }
    // Check that every required property exists and is not null or undefined
    return props.every(prop => Object.prototype.hasOwnProperty.call(obj, prop) && obj[prop] !== undefined && obj[prop] !== null);
}

/**
 * Enum defining specific rule types (see {@link PruningRule}) for pruning in {@link pruneObject}.
 * @enum {string}
 * @property {string} EXISTS - Requires the property to exist (anything other than undefined).
 * @property {string} HAS_NON_TRIVIAL_KEYS - Requires the object to have at least one non-trivial key/value pair.
 */
export enum BasicPruningRuleEnum {
    /** Requires the property to exist (anything other than undefined). */
    EXISTS = 'EXISTS',
    /** Requires the object to have at least one non-trivial key/value pair. */
    HAS_NON_TRIVIAL_KEYS = 'HAS_NON_TRIVIAL_KEYS',
}

/**
 * Represents the rule structure for pruning. Can be:
 * -  {@link BasicPruningRuleEnum}: A specific enum-based rule (EXISTS, HAS_NON_TRIVIAL_KEYS).
 * - `string[]`: Requires the target object to have these properties non-null/undefined.
 * -  {@link ArrayElementRule}: Specifies rules to apply to each element of a target array.
 * - `{ [key: string]: PruningRule }`: Specifies nested rules for properties of a target object.
 */
export type PruningRule = BasicPruningRuleEnum | string[] | ArrayElementRule | { [key: string]: PruningRule };

/**
 * Special structure to define rules for array elements.
 * The `__elements__` key holds the `PruningRule` to apply to each element.
 */
export type ArrayElementRule = { __elements__: PruningRule };

/** Helper to check if a rule is an ArrayElementRule */
function isArrayElementRule(rule: PruningRule): rule is ArrayElementRule {
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
 * @param {PruningRule} rule - The rule structure defining pruning criteria.
 *   - `string[]`: If `input` is an object, it must have all properties in the array (non-null/undefined). Otherwise, `input` is pruned (returns null).
 *   - `{ __elements__: PruningRule }`: If `input` is an array, the inner rule is applied to each element. Elements pruned by the inner rule are removed. If the array becomes empty, it's pruned (returns null).
 *   - `{ [key: string]: PruningRule }`: If `input` is an object, for each `key` in the rule object, the corresponding `subRule` is applied recursively to `input[key]`. If `input[key]` existed but is pruned by the `subRule`, the `key` is deleted from the object copy. If the object becomes empty after pruning, it's pruned (returns null).
 * @returns {T | null} The pruned object/array, or null if the input itself is pruned according to the rules.
 */
export function pruneObject<T>(input: T, rule: PruningRule): T | null {

    // Inner recursive function
    function pruneRecursive<U>(currentValue: U, currentRule: PruningRule): U | null {
        // --- Handle specific enum rules first ---
        if (typeof currentRule === 'string' 
            && Object.values(BasicPruningRuleEnum).includes(currentRule as BasicPruningRuleEnum)
        ) {
            switch (currentRule) {
                case BasicPruningRuleEnum.EXISTS:
                    // console.log(`Rule is EXISTS. Value: ${JSON.stringify(currentValue, null, 4)}. \n\tResult: ${currentValue !== undefined ? 'Keep' : 'Prune'}`);
                    return !isNullLike(currentValue) ? currentValue : null;
                case BasicPruningRuleEnum.HAS_NON_TRIVIAL_KEYS:
                    // console.log(`Rule is HAS_NON_TRIVIAL_KEYS. Value: ${JSON.stringify(currentValue, null, 4)}. \n\tResult: ${hasKeysResult ? 'Keep' : 'Prune'}`);
                    return hasNonTrivialKeys(currentValue) ? currentValue : null;
                default:
                    console.log(`Unhandled PruningRuleEnum member: ${currentRule}`);
                    break; // Fall through to other rule checks just in case
            }
        }
        // Base case: Null or undefined values cannot meet requirements.
        if (currentValue === null) {
            console.log(`Pruning null value.`);
            return null;
        }
        // Null is pruned if rule requires specific props (string[]).
        // For other rules (object, array element), null is passed down.
        if (currentValue === null && Array.isArray(currentRule)) {
            console.log(`Pruning null value because rule requires specific props.`);
            return null; // Null object cannot have required props.    
        }
        // Otherwise, let specific handlers below decide (e.g., nested object rule might apply to null)
        // Note: HAS_NON_TRIVIAL_KEYS already handled null above (returns false).

        // 1. Rule is string[] (Required Properties for an Object)
        if (Array.isArray(currentRule)) {
            // This rule only applies meaningfully to non-array objects.
            if (typeof currentValue === 'object' && !Array.isArray(currentValue)) {
                if (hasRequiredProps(currentValue, currentRule)) {
                    // The object has the required props, return it (as potentially further pruned by other rules if nested)
                    return currentValue;
                } else {
                    // Object is missing one or more required properties. Prune this object.
                    console.log(`Pruning object ${JSON.stringify(currentValue, null, 4)} missing props: ${currentRule.filter(prop => !(prop in currentValue) || currentValue[prop as keyof typeof currentValue] == null).join(', ')}`);
                    return null;
                }
            } else { // Rule is string[], but current value is not an object. This is a mismatch. Prune.
                console.log(`Pruning value ${JSON.stringify(currentValue, null, 4)}: Rule expected object with props ${currentRule.join(', ')}, got ${typeof currentValue}.`);
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
                console.log(`Pruning value ${JSON.stringify(currentValue, null, 4)}: Rule expected an array, got ${typeof currentValue}.`);
                return null;
            }
        }

        // 3. Rule is a Nested Object (Recursive Rules for Object Properties)
        // If it wasn't an enum, string[], or ArrayElementRule, it must be a plain object rule.
        // We only need to check typeof 'object' again to satisfy TS for the 'for...in' loop.
        if (typeof currentRule === 'object' /* Implicitly non-null, not array, not ArrayElementRule */) {
            // This rule only applies meaningfully to non-array objects.
            let currentValueIsObject = typeof currentValue === 'object' && !Array.isArray(currentValue) && currentValue !== null;
            if (currentValueIsObject) {
                // Work on a shallow copy for modification at this level
                const currentObject = { ...currentValue } as any;
                let objectModified = false;
                const keysToDelete: string[] = [];
                // Iterate over the keys specified in the rule for this level
                for (const key in currentRule) {
                    if (!Object.prototype.hasOwnProperty.call(currentRule, key)) {
                        continue;
                    }
                    const subRule = currentRule[key];
                    /** 
                     * Get the original value from the object copy for the key specified in the rule.
                     * - Use hasOwnProperty check on the *object* to get the actual value, handling cases where key exists in rule but not object
                     */
                    const targetValue = Object.prototype.hasOwnProperty.call(currentObject, key) ? currentObject[key] : undefined;
                    const prunedSubValue = pruneRecursive(targetValue, subRule); // Recursively prune the target value using the sub-rule
                    // Decide action based on pruning result *and* whether key originally existed
                    if (Object.prototype.hasOwnProperty.call(currentObject, key)) {
                        // Key exists in the object
                        if (prunedSubValue === null) {
                            // If the target existed but was pruned to null by the sub-rule, mark the key for deletion
                            console.log(`Marking key '${key}' for deletion because its value pruned to null.`);
                            keysToDelete.push(key);
                            objectModified = true;
                        } else if (prunedSubValue !== targetValue) {
                            // If the target was modified (but not fully pruned), update it in the copy
                            console.log(`Updating key '${key}' with pruned value ${JSON.stringify(prunedSubValue)}.`);
                            currentObject[key] = prunedSubValue;
                            objectModified = true;
                        } // else: prunedSubValue === targetValue, no change needed for this key's value.
                    } else if (prunedSubValue === null && subRule !== BasicPruningRuleEnum.EXISTS && typeof subRule !== 'object') { 
                        // (missing key) Key exists in the rule, but not in the object
                        // If a missing key was required by a rule other than EXISTS or {}
                        // (e.g., string[], HAS_NON_TRIVIAL_KEYS), this indicates the parent object might be invalid according to this rule's constraints.
                        console.log(`Rule for key '${key}' requires value, but key is not in object. Requirement not met, but not modifying object structure here.`);
                    } // else: prunedSubValue is not null (e.g., rule was EXISTS and value was undefined -> null, or rule was {}), do nothing.
                }

                // Delete the keys marked for deletion after the loop finishes
                keysToDelete.forEach(key => {
                    console.log(`Pruning property '${key}' from parent object.`);
                    delete currentObject[key];
                });
                // If properties were deleted and the object is now empty, prune the object itself.
                if (objectModified && Object.keys(currentObject).length === 0) {
                    console.log(`Pruning object ${JSON.stringify(currentValue, null, 4)} as it became empty after pruning.`);
                    return null;
                }
                // Return the potentially modified object copy
                return currentObject as U;
            } else {
                // Rule is object, but current value is not an object (primitive, array, etc.).
                // currentRule is known to be an object here.
                if (Object.keys(currentRule).length === 0) { // Safe: currentRule is an object
                    // console.log(`Value ${JSON.stringify(currentValue, null, 4)} encountered empty object rule '{}'. Keeping value.`);
                    return currentValue; // Keep non-object value if rule is just {}
                } else {
                    // Rule expected an object with specific keys, but got a non-object. Prune.
                    console.log(`Pruning value ${JSON.stringify(currentValue, null, 4)}: Rule expected an object with specific keys (${Object.keys(currentRule).join(', ')}), got ${typeof currentValue}.`, currentValue);
                    return null;
                }
            }
        }
        // If the rule structure is unrecognized or doesn't apply to the value type,
        // return the value unchanged, assuming it's valid by default if no rule matches.
        console.log(`Value ${JSON.stringify(currentValue, null, 4)} did not match any applicable rule structure in ${JSON.stringify(currentRule)}. Returning value as is.`);
        return currentValue;
    }

    // Start recursion with the input value and the top-level rule
    return pruneRecursive(input, rule);
}
