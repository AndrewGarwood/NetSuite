/**
 * @file src/utils/io/regex/types/StringOptions.ts
 */
/**
 * @typedefn **`CleanStringOptions`**
 */
export type CleanStringOptions = {
    strip?: StringStripOptions,
    case?: StringCaseOptions,
    pad?: StringPadOptions,
    replace?: StringReplaceOptions
}

/**
 * @typedefn **`StringCaseOptions`**
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
 * @typedefn **`StringPadOptions`**
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
 * @typedefn **`StringStripOptions`**
 * @property {string} char - the character to strip from the string with {@link applyStripOptions}
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

// maybe just make StringReplaceOptions a { RegExp: string } dictionary?
/**
 * @typedefn **`StringReplaceOptions`**
 * @property {StringReplaceParams[]} replacements - an array of objects containing `searchValue` and `replaceValue` properties
 */
export type StringReplaceOptions = StringReplaceParams[];

/**
 * @typedefn **`StringReplaceParams`**
 * @property {string | RegExp} searchValue - the string or regular expression to search for in the string
 * @property {string} replaceValue - the string to replace the `searchValue` with
 */
export type StringReplaceParams = {
    searchValue: string | RegExp,
    replaceValue: string,
};