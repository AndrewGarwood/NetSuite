/**
 * @file src/utils/argumentValidation.ts
 * @description moved the content of parameter type checks at the start of 
 * functions to here. use these when you want your function to throw a fit when
 * it receives bad input.
 */
import { 
    isNonEmptyString, isNonEmptyArray, isNullLike, hasKeys, isEmptyArray, 
    TypeOfEnum 
} from "./typeValidation";
import { 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL 
} from "../config/setupLog";
import { existsSync } from "fs";

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
        mlog.error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty string`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB))
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
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

export function existingPathArgument(
    source: string,
    arg2: string | { [label: string]: any },
    value?: any
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
    if (!isNonEmptyString(value) || !existsSync(value)) {
        mlog.error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: existing file path`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: existing file path`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * @param source `string` indicating what called `validateNumberArgument()`
 * @param arg2 `string | { [label: string]: any }` the argument/parameter name
 * @param value `any` the value passed into the `source` 
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
    value?: any,
    requireInteger: boolean = false
): void {
    let label: string = '';
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.numberArgument()] Invalid argument: '${JSON.stringify(arg2)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    }
    if (typeof value !== TypeOfEnum.NUMBER || isNaN(value)) {
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: number`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
    if (requireInteger && !Number.isInteger(value)) {
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: integer`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
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
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
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
        const message = [`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: array`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
    
    if (isEmptyArray(value) && !allowEmpty) {
        const message = [`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty array`,
            `Received ${label} value: empty array`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
    
    if (elementType && Object.values(TypeOfEnum).includes(elementType as TypeOfEnum)) {
        if (!value.every((v: any) => typeof v === elementType)) {
            const message = [`[${source}()] Invalid argument: '${label}'`,
                `Expected ${label} to be: array of ${elementType}`,
                `Received ${label} value: ${JSON.stringify(value)}`
            ].join(TAB);
            mlog.error(message);
            throw new Error(message);
        }
    }
    
    if (elementTypeGuard && typeof elementTypeGuard === 'function') {
        if (!value.every((v: any) => elementTypeGuard(v))) {
            const message = [`[${source}()] Invalid argument: '${label}'`,
                `Expected ${label} to be: array of ${elementType || 'ELEMENT_TYPE_NOT_FOUND'}`,
                `Received ${label} value: ${JSON.stringify(value)}`,
                `Element typeGuard function: ${elementTypeGuard.name}(value: any): value is ${elementType || 'ELEMENT_TYPE_NOT_FOUND'}`
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
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
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
    /** value (any) | objectTypeName (string) */
    arg3?: string | any,
    /** objectTypeName (string) | objectTypeGuard (function) */
    arg4?: string | ((value: any) => boolean),
    /** objectTypeGuard | allowEmpty (boolean) */
    arg5?: ((value: any) => boolean) | boolean,
    allowEmpty: boolean | undefined = false
): void {
    let label: string = '';
    let value: any = undefined;
    if (typeof arg2 === 'object') {
        const keys = Object.keys(arg2);
        if (keys.length !== 1) {
            throw new Error(`[argumentValidation.objectArgument()] Invalid argument: '${JSON.stringify(label)}' - expected a single key`);
        }
        label = keys[0];
        value = arg2[label];
    } else if (typeof arg2 === 'string') {
        label = arg2;
        value = arg3;
    } else {
        throw new Error(`[argumentValidation.objectArgument()] Invalid parameters: expected either a single object with a single key ({label: value}) or two separate arguments (label, value)`);
    }
    let objectTypeName = (typeof arg3 === 'string'
        ? arg3
        : `object (Record<string, any>)`
    ) as string;
    let objectTypeGuard = (typeof arg4 === 'function'
        ? arg4
        : (typeof arg5 === 'function'
            ? arg5
            : undefined
        )
    ) as ((value: any) => boolean) | undefined;
    if (typeof value !== 'object' || (isNullLike(value) && !allowEmpty)) {
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: non-empty object`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
    if (objectTypeGuard 
        && typeof objectTypeGuard === 'function' 
        && !objectTypeGuard(value)) {
        throw new Error([`[${source}()] Invalid argument: '${label}'`,
            `Expected ${label} to be: object of type '${objectTypeName}'`,
            `Received ${label} value: ${JSON.stringify(value)}`,
            `Element typeGuard function: ${objectTypeGuard.name}(value: any): value is ${objectTypeName}`
        ].join(TAB));
    }
}