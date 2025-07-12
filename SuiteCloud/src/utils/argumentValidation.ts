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
 * @param label `string` the argument/parameter name
 * @param value `string` the value passed into the `source` 
 * for the argument corresponding to `label`
 * @throws {Error} if `value` is not a non-empty string
 * 
 * **`message`**: `[source()] Invalid parameter: '${label}'`
 * -  `Expected ${label} to be: non-empty string`
 * -  `Received ${label} value: ${typeof value}`
 */
export function stringArgument(
    source: string,
    label: string,
    value: string | any,
): void {
    if (!isNonEmptyString(value)) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: non-empty string`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

export function multipleStringArguments(
    source: string,
    args: Record<string, any>
): void {
    for (const [label, value] of Object.entries(args)) {
        stringArgument(source, label, value);
    }
}

export function existingFileArgument(
    source: string,
    label: string,
    value: any
): void {
    if (!isNonEmptyString(value) || !existsSync(value)) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: existing file path`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * @param source `string` indicating what called `validateNumberArgument()`
 * @param label `string` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * @param requireInteger `boolean` optional, if `true`, validates that `value` is an integer
 * - `default` is `false`, meaning `value` can be a float
 * @throws {Error} if `value` is not a number or is not an integer (if `requireInteger` is `true`)
 * 
 * **`message`**: `[source()] Invalid parameter: '${label}'`
 * -  `Expected ${label} to be: number|integer`
 * -  `Received ${label} value: ${typeof value}`
 */
export function numberArgument(
    source: string,
    label: string,
    value: any,
    requireInteger: boolean = false
): void {
    if (typeof value !== TypeOfEnum.NUMBER || isNaN(value)) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: number`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
    if (requireInteger && !Number.isInteger(value)) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: integer`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * @param source `string` indicating what called `validateBooleanArgument()`
 * @param label `string` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * 
 * @throws {Error} `if` `value` is not a `boolean`
 * 
 * **`message`**: `[source()] Invalid parameter: '${label}'`
 * -  `Expected ${label} to be: boolean`
 * -  `Received ${label} value: ${typeof value}`
 */
export function booleanArgument(
    source: string,
    label: string,
    value: any
): void {
    if (typeof value !== TypeOfEnum.BOOLEAN) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: ${TypeOfEnum.BOOLEAN}`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
}

/**
 * - {@link isNonEmptyArray}`(value: any): value is any[] & { length: number; }`
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
 * * @param allowEmpty `boolean` optional, if `true`, allows `value` to be an empty array
 * - `default` is `false`, meaning an empty array will throw an error
 * @throws {Error} `if` `value` is not a non-empty array or does not pass the type checks
 * 
 * **`message`**: `[source()] Invalid parameter: '${label}'`
 * -  `Expected ${label} to be: non-empty array`
 * -  `Received ${label} value: ${typeof value}`
 */
export function arrayArgument(
    source: string,
    label: string,
    value: any,
    elementType?: TypeOfEnum | string,
    elementTypeGuard?: (value: any) => boolean,
    allowEmpty: boolean = false,
): void {
    if (!isNonEmptyArray(value) && !allowEmpty) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: non-empty array`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
    if (elementType && Object.values(TypeOfEnum).includes(elementType as TypeOfEnum)) {
        if (!value.every((v: any) => typeof v === elementType)) {
            throw new Error([`[${source}()] Invalid parameter: '${label}'`,
                `Expected ${label} to be: non-empty array of ${elementType}`,
                `Received ${label} value: ${JSON.stringify(value)}`
            ].join(TAB));
        }
    }
    if (elementTypeGuard && typeof elementTypeGuard === TypeOfEnum.FUNCTION) {
        if (!value.every((v: any) => elementTypeGuard(v))) {
            throw new Error([`[${source}()] Invalid parameter: '${label}'`,
                `Expected ${label} to be: non-empty array of ${elementType}`,
                `Received ${label} value: ${JSON.stringify(value)}`,
                `Element typeGuard function: ${elementTypeGuard.name}(value: any): value is ${elementType}`
            ].join(TAB));
        }
    }
}


/**
 * @param source `string` indicating what called `validateFunctionArgument`
 * @param label `string` the argument/parameter name
 * @param value `any` the value passed into the `source` 
 * for the argument corresponding to `label`
 * 
 * @throws {Error} `if` `value` is not a function
 * 
 * **`message`**: `[source()] Invalid parameter: '${label}'`
 * -  `Expected ${label} to be: function`
 * -  `Received ${label} value: ${typeof value}`
 */
export function functionArgument(
    source: string,
    label: string,
    value: any
): void {
    if (typeof value !== TypeOfEnum.FUNCTION) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
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
 * 
 * @throws {Error} `if` `value` is not a non-empty object 
 * or does not pass the type guard (if one was provided)
 * 
 * **`message`**: `[source()] Invalid parameter: '${label}'`
 * -  `Expected ${label} to be: non-empty '${TypeOfEnum.OBJECT}'`
 * -  `Received ${label} value: ${typeof value}`
 * 
 * `if` `objectTypeGuard` is provided:
 * -  `Expected ${label} to be: object of type '${objectTypeName}'`
 * -  `Received ${label} value: ${JSON.stringify(value)}`
 * -  `Element typeGuard function: ${objectTypeGuard.name}(value: any): value is ${objectTypeName}`
 */
export function objectArgument(
    source: string,
    label: string,
    value: any,
    objectTypeName: string = `${TypeOfEnum.OBJECT} (Record<string, any>)`,
    objectTypeGuard?: (value: any) => boolean,
    allowEmpty: boolean = false
): void {
    if (typeof value !== TypeOfEnum.OBJECT || (isNullLike(value) && !allowEmpty)) {
        throw new Error([`[${source}()] Invalid parameter: '${label}'`,
            `Expected ${label} to be: non-empty ${TypeOfEnum.OBJECT}`,
            `Received ${label} value: ${typeof value}`
        ].join(TAB));
    }
    if (objectTypeGuard && typeof objectTypeGuard === TypeOfEnum.FUNCTION) {
        if (!objectTypeGuard(value)) {
            throw new Error([`[${source}()] Invalid parameter: '${label}'`,
                `Expected ${label} to be: object of type '${objectTypeName}'`,
                `Received ${label} value: ${JSON.stringify(value)}`,
                `Element typeGuard function: ${objectTypeGuard.name}(value: any): value is ${objectTypeName}`
            ].join(TAB));
        }
    }
}