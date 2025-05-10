/**
 * @file Reading.ts
 */
import { stripCharFromString, toTitleCase } from "../regex"
import { parseExcelForOneToMany } from "../reading"
/**
 * 
 * @typedefn {Object} `FileExtensionResult`
 * @property {boolean} isValid - `true` if the `filePath` has the expected extension, `false` otherwise
 * @property {string} validatedFilePath - the `filePath` with the expected extension if it was missing, otherwise the original `filePath`
 */
export type FileExtensionResult = {
    isValid: boolean,
    validatedFilePath: string
}

/**
 * @typedefn `ParseOneToManyOptions`
 * @property {StringStripOptions} [keyStripOptions] - options for stripping characters from the key
 * @property {StringStripOptions} [valueStripOptions] - options for stripping characters from the value
 * @property {StringCaseOptions} [keyCaseOptions] - options for changing the case of the key
 * @property {StringCaseOptions} [valueCaseOptions] - options for changing the case of the value
 * @property {StringPadOptions} [keyPadOptions] - options for padding values read from the `keyColumn`
 * @property {StringPadOptions} [valuePadOptions] - options for padding values read from the `valueColumn`
 * 
 * - {@link StringStripOptions} = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * - {@link StringCaseOptions}  = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * - {@link StringPadOptions} = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 * @see {@link parseExcelForOneToMany}
 */
export type ParseOneToManyOptions = {
    keyStripOptions?: StringStripOptions,
    valueStripOptions?: StringStripOptions,
    keyCaseOptions?: StringCaseOptions,
    valueCaseOptions?: StringCaseOptions,
    keyPadOptions?: StringPadOptions,
    valuePadOptions?: StringPadOptions
}

/**
 * @typedefn `StringCaseOptions`
 * @property {boolean} [toUpper] - `true` if the string should be converted to upper case
 * @property {boolean} [toLower] - `true` if the string should be converted to lower case
 * @property {boolean} [toTitle] - `true` if the string should be converted to title case, see {@link toTitleCase}
 */
export type StringCaseOptions = {
    toUpper?: boolean,
    toLower?: boolean,
    toTitle?: boolean,
}

/**
 * @typedefn `StringPadOptions`
 * @property {number} padLength - the length of the string after padding
 * @property {string} [padChar] - the character to use for padding, defaults to ' '
 * @property {boolean} [padLeft] - `true` if the padding should be added to the left side of the string
 * @property {boolean} [padRight] - `true` if the padding should be added to the right side of the string
 */
export type StringPadOptions = {
    padLength: number,
    padChar?: string,
    padLeft?: boolean,
    padRight?: boolean,
}

/**
 * @typedefn `StringStripOptions`
 * @property {string} char - the character to strip from the string with {@link stripCharFromString}
 * @property {boolean} [escape] - `true` if the character should be escaped
 * @property {function} [stripLeftCondition] - a function that takes a string and returns `true` if the character should be stripped from the left side of the string
 * @property {any[]} [leftArgs] - arguments to pass to the `stripLeftCondition` function
 * - if `stripLeftCondition(s, leftArgs)` is `true` or `stripLeftCondition` is `undefined` (i.e. no conditions need to be met to strip left), the left side of `s` is stripped of `char`
 * @property {function} [stripRightCondition] - a function that takes a string and returns `true` if the character should be stripped from the right side of the string
 * @property {any[]} [rightArgs] - arguments to pass to the `stripRightCondition` function
 * - if `stripRightCondition(s, rightArgs)` is `true` or `stripRightCondition` is `undefined` (i.e. no conditions need to be met to strip right), the right side of `s` is stripped of `char`
 */
export type StringStripOptions = {
    char: string,
    escape?: boolean,
    stripLeftCondition?: (s: string, ...args: any[]) => boolean,
    leftArgs?: any[],
    stripRightCondition?: (s: string, ...args: any[]) => boolean,
    rightArgs?: any[],
}