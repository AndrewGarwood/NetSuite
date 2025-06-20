/**
 * @file src/utils/typeValidation.ts
 */
import { FieldValue, SubrecordValue } from "src/utils/api/types";
import { mainLogger as mlog } from "src/config/setupLog";
import { BOOLEAN_FIELD_ID_REGEX, EMAIL_REGEX, equivalentAlphanumericStrings as equivalentAlphanumeric } from "./io/regex";
import { FieldParseOptions, ValueMappingEntry } from "./io";

/**
 * @param value the value to check
 * @returns **`isNullLike`** `boolean` = `value is null | undefined | '' | [] | Record<string, never>`
 * - `true` if the value is null, undefined, empty object (no keys), empty array, or empty string
 * - `false` otherwise
 */
export function isNullLike(value: any): value is null | undefined | '' | [] | Record<string, never> {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return false;
    }
    // Check for empty object or array... !hasNonTrivialKeys(value)
    if (typeof value === 'object' && isEmptyArray(Object.keys(value))) {
        return true;
    }
    if (typeof value === 'string' && (value.trim() === '' || value.toLowerCase() === 'undefined' || value.toLowerCase() === 'null') ) {
        return true;
    }
    return false;
}

/**
 * @param arr 
 * @returns **`isNonEmptyArray`** `boolean` = `arr is Array<any> & { length: number }`
 * - `true` if `arr` is an array and has at least one element, 
 * - `false` otherwise.
 */
export function isNonEmptyArray(arr: any): arr is Array<any> & { length: number } {
    return Array.isArray(arr) && arr.length > 0;
}
/**
 * @param arr 
 * @returns **`isEmptyArray`** `boolean` = `arr is Array<any> & { length: 0 }`
 * - `true` if `arr` is an array and has no elements,
 * - `false` otherwise.
 */
export function isEmptyArray(arr: any): arr is Array<any> & { length: 0 } {
    return Array.isArray(arr) && arr.length === 0; 
}
/**
 * @TODO add param that indicates whether all values be nontrivial or not
 * @description Check if an object has at least 1 key with value that is non-empty (not `undefined`, `null`, or empty string). 
 * - passing in an array will return `false`.
 * @param obj - The object to check.
 * @returns **`true`** if the object has any non-empty keys, **`false`** otherwise.
 */
export function hasNonTrivialKeys(obj: any): obj is Record<string, any> | { [key: string]: any } |{ [key: string]: FieldValue } {
    if (typeof obj !== 'object' || !obj || Array.isArray(obj)) {
        return false;
    }
    const hasKeyWithNonTrivialValue = Object.values(obj).some(value => {
        return value !== undefined && value !== null &&
            (value !== '' || isNonEmptyArray(value) 
            || (isNonEmptyArray(Object.entries(value)))
        );
    });
    return hasKeyWithNonTrivialValue;
}

/**
 * @TODO add param that indicates whether all keys be in the object or not
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
    if (!keys || isEmptyArray(keys)) {
        throw new TypeError('hasKeys() param `keys` must be an array with at least one key');
    }
    if (keys.length === 0) {
        return false; // No keys to check
    }
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            // log.warn(`hasKeys() key "${String(key)}" not found in the object`);
            return false; // Key not found in the object
        }
    }
    return true; // All keys found in the object
}


/**
 * @param objA `Record<string, any>`
 * @param objB `Record<string, any>`
 * @returns **`areEquivalentObjects`** `boolean`
 * - `true` `if` `objA` and `objB` are equivalent objects (same keys and values, including nested objects and arrays),
 * - `false` `otherwise`.
 */
export function areEquivalentObjects(
    objA: Record<string, any>, 
    objB: Record<string, any>
): boolean {
    if (!objA || typeof objA !== 'object' || !objB || typeof objB !== 'object') {
        return false;
    }
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => {
        if (!objB.hasOwnProperty(key)) return false; // key not in both objects
        const valA = objA[key];
        const valB = objB[key];
        if (Array.isArray(valA) && Array.isArray(valB)) {
            return valA.length === valB.length 
                && valA.every((item) => valB.includes(item));
        } else if (typeof valA === "object" && valA && typeof valB === "object" && valB) {
            return areEquivalentObjects(valA, valB);
        }
        return equivalentAlphanumeric(valA, valB);
    });
}

/**
 * - {@link SubrecordValue}
 * - {@link SetFieldSubrecordOptions}
 * - {@link SetSublistSubrecordOptions}
 * - {@link SubrecordParseOptions}
 * @param value `any`
 * @returns **`isSubrecordValue`** `boolean`
 * - `true` `if` `value` `isSubrecordParseOptions` or `isSetSubrecordOptions`,
 * - `false` `otherwise`.
 */
export function isSubrecordValue(value: any): value is SubrecordValue {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const isSubrecordParseOptions = Boolean('fieldOptions' in value 
        && 'sublistOptions' in value
    );
    const isSetSubrecordOptions = Boolean('fieldId' in value
        && ('fields' in value || 'sublists' in value)
    );
    return (value && typeof value === 'object' 
        && 'subrecordType' in value 
        && (isSubrecordParseOptions || isSetSubrecordOptions)
    ); 
}

/**
 * @param value 
 * @returns **`isFieldValue`** `boolean`
 * - `true` if the `value` is a primitive value (string, number, boolean, null, undefined),
 * - `true` if the `value` is a Date object,
 * - `true` if the `value` is an array of primitive values,
 * - `false` otherwise.
 */
export function isFieldValue(value: any): value is FieldValue {
    if (isPrimitiveValue(value)) {
        return true;
    }
    if (value instanceof Date) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every(item => isPrimitiveValue(item));
    }
    return false;
}

/**
 * @param value 
 * @returns 
 */
export function isPrimitiveValue(
    value: any
): value is string | number | boolean | null | undefined {
    if (value === null || value === undefined) {
        return true; // null and undefined are considered primitive
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return true; // string, number, and boolean are primitive types
    }
    return false;
}

/**
 * @param value 
 * @returns 
 */
export function isFieldParseOptions(value: any): value is FieldParseOptions {
    if (!value || typeof value !== 'object') {
        return false;
    }
    if ('defaultValue' in value 
        || 'colName' in value 
        || 'evaluator' in value 
        || 'args' in value
    ) {
        return true; // at least one of the properties is present
    }
    return false;
}


/**
 * @description Checks if the given value is a {@link ValueMappingEntry} = `{ newValue`: {@link FieldValue}, `validColumns`: `string | string[] }`.
 * @param value - The value to check.
 */
export function isValueMappingEntry(value: any): value is ValueMappingEntry {
    return typeof value === 'object' && 'newValue' in value && 'validColumns' in value;
}

/**
 * Represents the `boolean` value `true` for a radio field in NetSuite.
 */
export const RADIO_FIELD_TRUE = 'T';
/**
 * Represents the `boolean` value `false` for a radio field in NetSuite.
 */
export const RADIO_FIELD_FALSE = 'F';
/**
 * - `= typeof `{@link RADIO_FIELD_TRUE}` | typeof `{@link RADIO_FIELD_FALSE}`;` 
 * @description
 * Value representing the state of a radio field in NetSuite. (i.e. is the button filled in or not)
 * - e.g. the Customer record's `'isperson'` field.
 * */
export type RadioFieldBoolean = typeof RADIO_FIELD_TRUE | typeof RADIO_FIELD_FALSE;   


export const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y'];
export const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n'];
export const BOOLEAN_FIELD_ID_LIST = [
    'isinactive', 'isprivate', 'giveaccess', 'emailtransactions', 'faxtransactions', 
    'is1099eligible', 'isdefaultbilling', 'isdefaultshipping', 'isprimary', 'isprimaryshipto', 
    'isprimarybilling', 'isprimaryshipping'
];

/**
 * @param fieldId `string`
 * @returns 
 */
export const isBooleanFieldId = (fieldId: string): boolean => {
    return BOOLEAN_FIELD_ID_LIST.includes(fieldId) || BOOLEAN_FIELD_ID_REGEX.test(fieldId);
}
