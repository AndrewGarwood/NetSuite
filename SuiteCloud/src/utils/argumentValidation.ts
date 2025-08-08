/**
 * @file src/utils/argumentValidation.ts
 * @description moved the content of parameter type checks at the start of 
 * functions to here. use these when you want your function to throw a fit when
 * it receives bad input.
 */
import { 
    isNonEmptyString, isNonEmptyArray, isNullLike, hasKeys, isEmptyArray, 
    TypeOfEnum, 
    isNumericString
} from "./typeValidation";
import { 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL 
} from "../config/setupLog";
import { RegExpFlagsEnum, stringEndsWithAnyOf } from "./regex";
import * as fs from "fs";

/**
 * - {@link isNonEmptyString}`(value: any): value is string & { length: number; }`
 * @param source `string` indicating what called `validateStringArgument()`
 * @param arg2 `string | { [label: string]: any }` the argument/parameter name
 * @param value `string` the value passed into the `source` 
 * for the argument corresponding to `label`
 * @throws {Error} if `value` is not a non-empty string
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: non-empty string`
 * -  `Received ${label} value: ${typeof value}`
 */
export function stringArgument(
    source: string,
    arg2: string | { [label: string]: any },
    value?: any,
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            mlog.error(`[argumentValidation.stringArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
            throw new Error(`[argumentValidation.stringArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (!isNonEmptyString(value)) {
        mlog.error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty string`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB))
        throw new Error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty string`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * @param source `string`
 * @param labeledStrings `Record<string, any>` - map name of string param to value passed in for it
 */
export function multipleStringArguments(
    source: string,
    labeledStrings: Record<string, any>
): void {
    for (const [label, value] of Object.entries(labeledStrings)) {
        stringArgument(source, label, value);
    }
}

export function multipleExistingFileArguments(
    source: string,
    extension: string | string[],
    labeledFilePaths: Record<string, string>
): void {
    for (const [label, value] of Object.entries(labeledFilePaths)) {
        existingFileArgument(source, extension, label, value);
    }
}

export function existingFileArgument(
    source: string,
    extension: string | string[],
    arg3: string | { [label: string]: any },
    value?: any,
): void {
    let label: string = '';
    if (typeof arg3 === 'object') {
        const keys = Object.keys(arg3);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.existingFileArgument()] Invalid argument: '${JSON.stringify(arg3)}' - expected a single key`);
        }
        label = keys[0];
        value = arg3[label];
    }
    if (!isNonEmptyString(value) 
        || !stringEndsWithAnyOf(value, extension, RegExpFlagsEnum.IGNORE_CASE)
        || !isFile(value)) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: existing file with extension '${extension}'`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
}

export function existingDirectoryArgument(
    source: string,
    arg2: string | { [label: string]: any },
    value?: any,
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.existingDirectoryArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (!isNonEmptyString(value) || !isDirectory(value)) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: existing directory`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
}

export function isDirectory(pathString: string): boolean {
    return fs.existsSync(pathString) && fs.statSync(pathString).isDirectory();
}

export function isFile(pathString: string): boolean {
    return fs.existsSync(pathString) && fs.statSync(pathString).isFile();
}

export function numericStringArgument(
    source: string,
    arg2: string | { [label: string]: any },
    value?: any
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.numericStringArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (typeof value !== TypeOfEnum.NUMBER 
        && (typeof value !== TypeOfEnum.STRING || !isNumericString(value))) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: number or string (numeric string)`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
}

export function numberArgument(
    source: string,
    labeledNumber: { [label: string]: any },
    requireInteger?: boolean
): void

export function numberArgument(
    source: string,
    label: string,
    value: any,
    requireInteger?: boolean
): void

/**
 * @param source `string` indicating what called `validateNumberArgument()`
 * @param arg2 `string | { [label: string]: any }` the argument/parameter name
 * @param arg3 `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * @param requireInteger `boolean` optional, if `true`, validates that `value` is an integer
 * - `default` is `false`, meaning `value` can be a float
 * @throws {Error} if `value` is not a number or is not an integer (if `requireInteger` is `true`)
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: number|integer`
 * -  `Received ${label} value: ${typeof value}`
 */
export function numberArgument(
    source: string,
    arg2: string | { [label: string]: any },
    arg3?: number | boolean | any,
    requireInteger: boolean = false
): void {
    let label: string = '';
    let value: any = arg3;
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.numberArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
        if (typeof arg3 === 'boolean') {
            requireInteger = arg3;
        }
    }
    if (typeof value !== TypeOfEnum.NUMBER || isNaN(value)) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: number`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
    if (requireInteger && !Number.isInteger(value)) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: integer`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
}

/**
 * @param source `string` indicating what called `validateBooleanArgument()`
 * @param arg2 `string | { [label: string]: any }` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * 
 * @throws {Error} `if` `value` is not a `boolean`
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: boolean`
 * -  `Received ${label} value: ${typeof value}`
 */
export function booleanArgument(
    source: string,
    arg2: string | { [label: string]: any },
    value?: any
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.booleanArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (typeof value !== TypeOfEnum.BOOLEAN) {
        throw new Error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: ${TypeOfEnum.BOOLEAN}`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * @param source `string` indicating what called `validateArrayArgument`
 * @param label `string` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * @param elementType `TypeOfEnum | string` optional, the expected type of each element in the array
 * - `if` provided, must be one of the values in {@link TypeOfEnum} or a string representing the type
 * @param elementTypeGuard `(value: any) => boolean` optional, a type guard function that checks if each element in the array is of a specific type
 * - `if` provided, must be a function that takes a value and returns a boolean indicating if the value is of the expected type
 * - `if` both `elementType` and `elementTypeGuard` are provided, both must be satisfied
 * - `if` neither is provided, `validateArrayArgument` will only check if `value` is a non-empty array
 * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty array
 * - `default` is `false`, meaning an empty array will throw an error
 * @throws {Error} `if` `value` is not a non-empty array or does not pass the type checks
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: non-empty array`
 * -  `Received ${label} value: ${typeof value}`
 */
export function arrayArgument(
    source: string,
    label: string,
    value?: any,
    elementType?: TypeOfEnum | string,
    elementTypeGuard?: (value: any) => boolean,
    allowEmpty?: boolean
): void

/**
 * @param source `string` indicating what called `validateArrayArgument`
 * @param labeledArray `{ [label: string]: any }` a single object dict mapping label to value
 * @param elementType `TypeOfEnum | string` optional, the expected type of each element in the array
 * @param elementTypeGuard `(value: any) => boolean` optional, a type guard function
 * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty array
 * - `default` is `false`, meaning an empty array will throw an error
 * @throws {Error} `if` `value` is not a non-empty array or does not pass the type checks
 */
export function arrayArgument(
    source: string,
    labeledArray: { [label: string]: any },
    elementType?: TypeOfEnum | string,
    elementTypeGuard?: (value: any) => boolean,
    allowEmpty?: boolean
): void

/**
 * - {@link isNonEmptyArray}`(value: any): value is any[] & { length: number; }`
 * @param source `string` indicating what called `validateArrayArgument`
 * @param arg2 `string | { [label: string]: any }` the argument/parameter name or a single object dict mapping label to value
 * @param arg3 `any | TypeOfEnum | string` the value passed into the `source` or the element type
 * @param arg4 `TypeOfEnum | string | (value: any) => boolean` optional, element type or type guard function
 * @param arg5 `(value: any) => boolean | boolean` optional, type guard function or allowEmpty boolean
 * @param arg6 `boolean` optional, if `true`, allows `value` to be an empty array
 * - `default` is `false`, meaning an empty array will throw an error
 * @throws {Error} `if` `value` is not a non-empty array or does not pass the type checks
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: non-empty array`
 * -  `Received ${label} value: ${typeof value}`
 * 
 * `if` `elementTypeGuard` is provided:
 * -  `Expected ${label} to be: non-empty array of ${elementType}`
 * -  `Received ${label} value: ${JSON.stringify(value)}`
 * -  `Element typeGuard function: ${elementTypeGuard.name}(value: any): value is ${elementType}`
 */
export function arrayArgument(
    source: string,
    /** label or single object dict mapping label to value */
    arg2: string | { [label: string]: any },
    /** value (any) | elementType (TypeOfEnum | string) */
    arg3?: any | TypeOfEnum | string,
    /** elementType (TypeOfEnum | string) | elementTypeGuard (function) */
    arg4?: TypeOfEnum | string | ((value: any) => boolean),
    /** elementTypeGuard | allowEmpty (boolean) */
    arg5?: ((value: any) => boolean) | boolean,
    arg6: boolean = false
): void {
    let label: string = '';
    let value: any = undefined;
    
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            const message = `[argumentValidation.arrayArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`;
            mlog.error(message);
            throw new Error(message);
        }
        label = keys[0];
        value = arg2[label];
    } else if (typeof arg2 === 'string') {
        label = arg2;
        value = arg3;
    } else {
        throw new Error(`[argumentValidation.arrayArgument()] Invalid parameters: expected either a single object with a single key ({label: value}) or two separate arguments (label, value)`);
    }
    
    // Parse the parameters based on the overload signature used
    let elementType: TypeOfEnum | string | undefined;
    let elementTypeGuard: ((value: any) => boolean) | undefined;
    let allowEmpty: boolean = arg6;
    
    if (typeof arg2 === 'object') {
        // Called with {label: value}, elementType?, elementTypeGuard?, allowEmpty?
        elementType = arg3 as TypeOfEnum | string;
        elementTypeGuard = arg4 as ((value: any) => boolean) | undefined;
        allowEmpty = (arg5 as boolean) || arg6;
    } else {
        // Called with label, value, elementType?, elementTypeGuard?, allowEmpty?
        elementType = arg4 as TypeOfEnum | string;
        elementTypeGuard = arg5 as ((value: any) => boolean) | undefined;
        allowEmpty = arg6;
    }
    
    if (!Array.isArray(value)) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: array`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
    
    if (isEmptyArray(value) && !allowEmpty) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty array`,
            `Received ${label} value: empty array`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
    
    if (elementType && Object.values(TypeOfEnum).includes(elementType as TypeOfEnum)) {
        if (!value.every((v: any) => typeof v === elementType)) {
            const message = [`${bracketed(source)} Invalid argument: '${label}'`,
                `Expected ${label} to be: array of ${elementType}`,
                `Received ${label} value: ${JSON.stringify(value)}`
            ].join(TAB);
            mlog.error(message);
            throw new Error(message);
        }
    }
    
    if (elementTypeGuard && typeof elementTypeGuard === 'function') {
        if (!value.every((v: any) => elementTypeGuard(v))) {
            const message = [`${bracketed(source)} Invalid argument: '${label}'`,
                `Expected ${label} to be: Array` + isNonEmptyString(elementType) ? `<${elementType}>` : ``,
                `Received ${label} value: ${JSON.stringify(value)}`,
                `Element typeGuard function: ${elementTypeGuard.name}`
            ].join(TAB);
            mlog.error(message);
            throw new Error(message);
        }
    }
}


/**
 * @param source `string` indicating what called `validateFunctionArgument`
 * @param arg2 `string` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * 
 * @throws {Error} `if` `value` is not a function
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: function`
 * -  `Received ${label} value: ${typeof value}`
 */
export function functionArgument(
    source: string,
    arg2: string | { [label: string]: any},
    value?: any
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.functionArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (typeof value !== 'function') {
        throw new Error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: function`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * @param source `string` indicating what called `validateObjectArgument`
 * @param label `string` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * @param objectTypeName `string` the expected object type name `default` is `object (Record<string, any>)`
 * @param objectTypeGuard `(value: any) => boolean` optional, a type guard 
 * function that checks if the value is of the expected object type
 * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty object `{} or undefined`
 */
export function objectArgument(
    source: string,
    label: string,
    value?: any,
    objectTypeName?: string,
    objectTypeGuard?: (value: any) => boolean,
    allowEmpty?: boolean
): void

/**
 * @param source `string` indicating what called `validateObjectArgument`
 * @param labeledObject `{ [label: string]: any }` a single object dict mapping label to value
 * @param objectTypeName `string` the expected object type name
 * @param objectTypeGuard `(value: any) => boolean` optional, a type guard function
 * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty object `{} or undefined`
 */
export function objectArgument(
    source: string,
    labeledObject: { [label: string]: any },
    objectTypeName?: string,
    objectTypeGuard?: (value: any) => boolean,
    allowEmpty?: boolean
): void

/**
 * @param source `string` indicating what called `validateObjectArgument`
 * @param labeledValue `{ [label: string]: any }` a single object dict mapping label to value
 * @param labeledTypeGuard `{ [functionName: string]: (value: any) => boolean }` a single object dict mapping type guard function name to the function
 * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty object `{} or undefined`
 * @description This overload automatically derives the object type name from the type guard function name using regex.
 * For example, if the type guard function is named `isRecordOptions`, the object type name will be extracted as `RecordOptions`.
 */
export function objectArgument(
    source: string,
    labeledValue: { [label: string]: any },
    labeledTypeGuard: { [functionName: string]: (value: any) => boolean },
    allowEmpty?: boolean
): void

/**
 * @note does not allow for arrays
 * @param source `string` indicating what called `validateObjectArgument`
 * @param arg2 `string | { [label: string]: any }` the argument/parameter name or a single object dict mapping label to value
 * @param arg3 `any | string` the value passed into the `source` or the object type name
 * @param arg4 `string | (value: any) => boolean` optional, a type guard function or the object type name if arg3 was the object value
 * @param arg5 `boolean | (value: any) => boolean | undefined` optional, a type guard function if arg4 was the object type name or `boolean` for the allowEmpty param
 * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty object `{} or undefined` (if arg5 was the type guard function)
 * @throws {Error} `if` `value` is not a non-empty object 
 * or does not pass the type guard (if one was provided)
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: non-empty 'object'`
 * -  `Received ${label} value: ${typeof value}`
 * 
 * `if` `objectTypeGuard` is provided:
 * -  `Expected ${label} to be: object of type '${objectTypeName}'`
 * -  `Received ${label} value: ${JSON.stringify(value)}`
 * -  `Element typeGuard function: ${objectTypeGuard.name}(value: any): value is ${objectTypeName}`
 */
export function objectArgument(
    source: string,
    /** label or single object dict mapping label to value */
    arg2: string | { [label: string]: any },
    /** value (any) | objectTypeName (string) | labeledTypeGuard ({ [functionName: string]: function }) */
    arg3?: string | any | { [functionName: string]: (value: any) => boolean },
    /** objectTypeName (string) | objectTypeGuard (function) | allowEmpty (boolean) */
    arg4?: string | ((value: any) => boolean) | boolean,
    /** objectTypeGuard | allowEmpty (boolean) */
    arg5?: ((value: any) => boolean) | boolean,
    allowEmpty: boolean | undefined = false
): void {
    let label: string = '';
    let value: any = undefined;
    let objectTypeName: string | undefined = undefined;
    let objectTypeGuard: ((value: any) => boolean) | undefined = undefined;
    let isNewOverload = false;

    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.objectArgument()] Invalid argument: '${JSON.stringify(label)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
        // Check if this is the overload: objectArgument(source, {value}, {typeGuard}, allowEmpty?)
        if (arg3 && typeof arg3 === 'object' && !Array.isArray(arg3)) {
            const typeGuardKeys = Object.keys(arg3);
            
            // Validate that there's exactly one type guard
            if (typeGuardKeys.length !== 1) {
                throw new Error(`[argumentValidation.objectArgument()] Invalid labeledTypeGuard: expected exactly one type guard function, got ${typeGuardKeys.length}`);
            }
            
            const functionName = typeGuardKeys[0];
            const typeGuardFunction = arg3[functionName];
            
            // Validate that the value is a function
            if (typeof typeGuardFunction !== 'function') {
                throw new Error(`[argumentValidation.objectArgument()] Invalid labeledTypeGuard: expected function for '${functionName}', got ${typeof typeGuardFunction}`);
            }
            
            isNewOverload = true;
            objectTypeGuard = typeGuardFunction;
            const typeGuardFunctionNamePattern = /(?<=^is).*$/i;
            // Extract object type name from function name using regex
            // e.g., "isRecordOptions" -> "RecordOptions"
            const match = typeGuardFunctionNamePattern.exec(functionName);
            objectTypeName = isNonEmptyArray(match) ? match[0] : functionName;
            
            allowEmpty = (typeof arg4 === 'boolean') ? arg4 : false;
        }
    } else if (typeof arg2 === 'string') {
        label = arg2;
        value = arg3;
    } else {
        throw new Error(`[argumentValidation.objectArgument()] Invalid parameters: expected either a single object with a single key ({label: value}) or two separate arguments (label, value)`);
    }

    if (objectTypeName === undefined && isNonEmptyString(arg3)) {
        objectTypeName = arg3
    } else if (objectTypeName === undefined) {
        objectTypeName = `object Record<string, any>`
    }
    if (objectTypeGuard === undefined) {
        objectTypeGuard = (typeof arg4 === 'function'
            ? arg4
            : (typeof arg5 === 'function'
                ? arg5
                : undefined
            )
        ) as ((value: any) => boolean) | undefined;
    }
    // Check for valid object (allow empty object if allowEmpty is true)
    if (typeof value !== 'object' || Array.isArray(value) || isNullLike(value)) {
        if (isNullLike(value) && allowEmpty) {
            return; // Allow undefined/null when allowEmpty is true
        }
        throw new Error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: non-array, non-empty object`+(
                objectTypeName ? ` of type: ${objectTypeName}` : ''
            ),
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
    
    // Check for empty object (skip type guard if allowEmpty is true and object is empty)
    const isEmptyObject = Object.keys(value).length === 0;
    if (!allowEmpty && isEmptyObject) {
        throw new Error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty object`,
            `Received ${label} value: ${JSON.stringify(value)}`
        ].join(TAB));
    }
    
    // Skip type guard validation if allowEmpty is true and object is empty
    if (allowEmpty && isEmptyObject) {
        return;
    }
    if (objectTypeGuard 
        && typeof objectTypeGuard === 'function' 
        && !objectTypeGuard(value)) {
        throw new Error([`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: object of type '${objectTypeName}'`,
            `Received ${label} value: ${JSON.stringify(value)}`,
            `Element typeGuard function: ${objectTypeGuard.name}`
        ].join(TAB));
    }
}


export function enumArgument(
    source: string,
    enumLabel: string,
    enumObject: Record<string, string> | Record<string, number>,
    label: string,
    value: any
): string | number

export function enumArgument(
    source: string,
    /** 
     * @key the name of the enumObject
     * @value the enumObject itself 
     * */
    labeledEnumObject: { [enumLabel: string]: Record<string, string> | Record<string, number> },
    /** 
     * @key the name/lagel of the argument whose value should be typeof enumObject, 
     * @value the value to check 
     * */
    labeledValue: { [label: string]: any}
): string | number

/**
 * @param source `string` indicating what called `enumArgument()`
 * @param arg2 `string | { [enumLabel: string]: Record<string, string> | Record<string, number> }` 
 * the enum label or labeled enum object
 * @param arg3 `Record<string, string> | Record<string, number> | { [label: string]: any }` 
 * the enum object or labeled value object
 * @param arg4 `string | undefined` the argument label (if using first overload)
 * @param value `any` the value to validate (if using first overload)
 * @returns {string | number} the validated enum value
 * @throws {Error} if `value` is not a valid enum value
 * 
 * **String Enums**: Flexible case-insensitive matching for both keys and values
 * - Input can be a string that matches any enum key or value (case-insensitive)
 * - Non-string inputs must exactly match an enum value
 * 
 * **Number Enums**: Key or exact value matching
 * - String input must exactly match an enum key (case-sensitive)
 * - Number input must exactly match an enum value
 * 
 * **`message`**: `[source()] Invalid argument: '${label}'`
 * -  `Expected ${label} to be: valid ${enumLabel} enum key or value`
 * -  `Received ${label} value: ${value} (${typeof value})`
 * -  `Valid ${enumLabel} options: [key1, value1, key2, value2, ...]`
 */
export function enumArgument(
    source: string,
    arg2: string | { [enumLabel: string]: Record<string, string> | Record<string, number> },
    arg3?: Record<string, string> | Record<string, number> | { [label: string]: any },
    arg4?: string,
    value?: any
): string | number {
    let enumLabel: string = '';
    let enumObject: Record<string, string> | Record<string, number>;
    let label: string = '';
    let valueToCheck: any;

    if (typeof arg2 === 'string') {
        // First overload: (source, enumLabel, enumObject, label, value)
        enumLabel = arg2;
        enumObject = arg3 as Record<string, string> | Record<string, number>;
        label = arg4 as string;
        valueToCheck = value;
    } else if (typeof arg2 === 'object') {
        // Second overload: (source, labeledEnumObject, labeledValue)
        const enumKeys = Object.keys(arg2);
        if (enumKeys.length !== 1) {
            throw new Error(`[argumentValidation.enumArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key for enum object`);
        }
        enumLabel = enumKeys[0];
        enumObject = arg2[enumLabel];

        const valueKeys = Object.keys(arg3 as { [label: string]: any });
        if (valueKeys.length !== 1) {
            throw new Error(`[argumentValidation.enumArgument()] Invalid argument: '${JSON.stringify(arg3)}' - expected a single key for value object`);
        }
        label = valueKeys[0];
        valueToCheck = (arg3 as { [label: string]: any })[label];
    } else {
        throw new Error(`[argumentValidation.enumArgument()] Invalid parameters: expected either (enumLabel, enumObject, label, value) or ({enumLabel: enumObject}, {label: value})`);
    }

    // Validate that enumObject is provided and is an object
    if (!enumObject || typeof enumObject !== 'object') {
        throw new Error(`[argumentValidation.enumArgument()] Invalid enum object for '${enumLabel}': expected non-empty object`);
    }

    const enumKeys = Object.keys(enumObject);
    const enumValues = Object.values(enumObject);
    
    // Determine if this is a string or number enum
    const isStringEnum = enumValues.every(val => typeof val === 'string');
    const isNumberEnum = enumValues.every(val => typeof val === 'number');
    
    if (!isStringEnum && !isNumberEnum) {
        throw new Error(`[argumentValidation.enumArgument()] Invalid enum object for '${enumLabel}': enum values must be all strings or all numbers`);
    }

    let matchedValue: string | number | undefined;

    if (isStringEnum) {
        // For string enums, check both keys and values with case-insensitive matching
        if (typeof valueToCheck === 'string') {
            const lowerValueToCheck = valueToCheck.toLowerCase();
            
            // Check if it matches a key (case-insensitive)
            const matchingKey = enumKeys.find(key => key.toLowerCase() === lowerValueToCheck);
            if (matchingKey) {
                matchedValue = enumObject[matchingKey] as string;
            } else {
                // Check if it matches a value (case-insensitive)
                const matchingValue = enumValues.find(val => 
                    typeof val === 'string' && val.toLowerCase() === lowerValueToCheck
                );
                if (matchingValue) {
                    matchedValue = matchingValue as string;
                }
            }
        } else {
            // For non-string input, only check exact value match
            if (enumValues.includes(valueToCheck)) {
                matchedValue = valueToCheck as string;
            }
        }
    } else if (isNumberEnum) {
        // For number enums, check if value is a number or string key
        if (typeof valueToCheck === 'number' && enumValues.includes(valueToCheck)) {
            matchedValue = valueToCheck;
        } else if (typeof valueToCheck === 'string') {
            // Check if string matches a key (case-sensitive for number enums)
            if (enumKeys.includes(valueToCheck)) {
                matchedValue = enumObject[valueToCheck] as number;
            }
        }
    }

    if (matchedValue === undefined) {
        const validOptions = isStringEnum 
            ? [...enumKeys, ...enumValues].map(v => `'${v}'`).join(', ')
            : [...enumKeys, ...enumValues].join(', ');
            
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: valid ${enumLabel} enum ${isStringEnum ? 'key or value' : 'key (string) or value (number)'}`,
            `Received ${label} value: ${valueToCheck} (${typeof valueToCheck})`,
            `Valid ${enumLabel} options: [${validOptions}]`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }

    return matchedValue;
}

/**
 * @description surrounds `s` with brackets if it doesn't already have them
 * @param s `string`
 * @returns **`bracketedString`** `string`
 */
export const bracketed = (s: string): string => {
    if (!isNonEmptyString(s)) s = 'argumentValidation'
    s = s.trim();
    if (!/^\[.*\]$/.test(s)) {
        s = `[${s}()]`
    }
    return s;
}


/** use existingFileArgument() or existingDirectoryArgument() */
export function existingPathArgument(
    source: string,
    arg2: string | { [label: string]: any },
    value?: any,
    extension?: string
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.existingPathArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (!isNonEmptyString(value) || !fs.existsSync(value) 
        && (isNonEmptyString(extension) 
            ? value.toLowerCase().endsWith(extension.toLowerCase()) 
            : true)) {
        const message = [`${bracketed(source)} Invalid argument: '${label}'`,
            `Expected ${label} to be: existing path` 
            + (isNonEmptyString(extension) ? ` with extension '${extension}'` : ``),
            `Received ${label} value: ${typeof value} = '${value}'`
        ].join(TAB)
        mlog.error(message);
        throw new Error(message);
    }
}