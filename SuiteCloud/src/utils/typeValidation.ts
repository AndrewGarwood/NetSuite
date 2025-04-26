/**
 * @file src/utils/typeValidation.ts
 */

/**
 * 
 * @param obj the object to check
 * @param keys the list of keys that obj must have
 * @returns {boolean} `true` if the object has all the keys, `false` otherwise
 * @throws {TypeError} if keys is not an array
 */
export function hasKeys<T extends Object>(obj: T, keys: Array<keyof T>): boolean {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    if (!keys || !Array.isArray(keys)) {
        throw new TypeError('hasKeys() keys must be an array');
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