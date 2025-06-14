/**
 * @file src/utils/typeValidation.ts
 */
import { FieldValue } from "src/utils/api/types";
import { mainLogger as log } from "src/config/setupLog";
import { BOOLEAN_FIELD_ID_REGEX, EMAIL_REGEX } from "./io/regex";

/**
 * Represents the `boolean` value `true` for a radio field in NetSuite.
 */
export const RADIO_FIELD_TRUE = 'T';
/**
 * Represents the `boolean` value `false` for a radio field in NetSuite.
 */
export const RADIO_FIELD_FALSE = 'F';
/**
 * Represents the state of a radio field in NetSuite. e.g. `"isperson"`
 * - `= typeof `{@link RADIO_FIELD_TRUE}` | typeof `{@link RADIO_FIELD_FALSE}`;` 
 * */
export type RadioFieldBoolean = typeof RADIO_FIELD_TRUE | typeof RADIO_FIELD_FALSE;   


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
 * @returns **`isNullLike`** `boolean` 
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
    if (typeof value === 'string' && (value.trim() === '' || value.toLowerCase() === 'undefined' || value.toLowerCase() === 'null') ) {
        return true;
    }
    return false;
}

/**
 * @param arr 
 * @returns {boolean} **`true`** if `arr` is an array and has at least one element, **`false`** otherwise.
 */
export function isNonEmptyArray(arr: any): boolean {
    return Array.isArray(arr) && arr.length > 0;
}
export function isEmptyArray(arr: any): boolean { return !isNonEmptyArray(arr); }
/**
 * @description Check if an object has any non-empty keys (not `undefined`, `null`, or empty string). 
 * - passing in an array will return `false`.
 * @param obj - The object to check.
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
            // log.warn(`hasKeys() key "${String(key)}" not found in the object`);
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
