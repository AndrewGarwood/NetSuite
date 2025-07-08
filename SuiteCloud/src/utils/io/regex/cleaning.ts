/**
 * @file src/utils/io/regex/cleaning.ts
 */
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../../config";
import { isNonEmptyArray } from "../../typeValidation";
import { RegExpFlagsEnum } from "./configureParameters";
import { CleanStringOptions, isCleanStringOptions, StringCaseOptions, StringPadOptions, StringReplaceOptions, StringStripOptions } from "../";

export function clean(s: string, options?: CleanStringOptions): string
/**
 * @description
 * - converts to string and trims, then: 
 * - applies options in this order: `StringReplaceOptions`, `StringStripOptions`, `StringCaseOptions`, `StringPadOptions`
 * - Removes leading+trailing spaces, extra spaces, commas, and dots from a string (e.g. `'..'` becomes `'.'`)
 * - optionally applies 4 option params with: {@link String.replace}, {@link applyStripOptions}, {@link applyCaseOptions}, and {@link applyPadOptions}.
 * @param s - the `string` to clean
 * @param stripOptions — {@link StringStripOptions}
 * - `optional` strip options to apply to the string
 * - = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * @param caseOptions — {@link StringCaseOptions} 
 * - `optional` case options to apply to the string
 * - = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * @param padOptions — {@link StringPadOptions} 
 * - `optional` padding options to apply to the string
 * - = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 * @param replaceOptions — {@link StringReplaceOptions}
 * - `optional` replace options to apply to the string
 * - = `Array<`{@link StringReplaceParams}`>` = `{ searchValue: string | RegExp, replaceValue: string }[]`
 * @returns **`s`** - the cleaned `string`
 */
export function clean(
    s: string,
    stripOptions?: StringStripOptions, 
    caseOptions?: StringCaseOptions,
    padOptions?: StringPadOptions,
    replaceOptions?: StringReplaceOptions
): string

export function clean(
    s: string,
    arg2?: CleanStringOptions | StringStripOptions, 
    arg3?: StringCaseOptions,
    arg4?: StringPadOptions,
    arg5?: StringReplaceOptions
): string {
    if (!s) return '';
    const {
        strip: stripOptions, 
        case: caseOptions,
        pad: padOptions, 
        replace: replaceOptions
    } = (isCleanStringOptions(arg2)
        ? arg2 as CleanStringOptions
        : {
            strip: arg2 as StringStripOptions,
            case: arg3,
            pad: arg4,
            replace: arg5
        } as CleanStringOptions
    );
    s = String(s).trim() || '';
    s = s.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').replace(/,{2,}/g, ',');
    // @consideration could put this in its own function for consistency
    if (replaceOptions && isNonEmptyArray(replaceOptions)) {
        for (const params of replaceOptions) {
            let initialValue = s;
            // Reset regex state if it's a global regex to avoid stateful issues
            if (params.searchValue instanceof RegExp && params.searchValue.global) {
                // mlog.debug(`--------FOUND GLOBAL THINGY--------`)
                params.searchValue.lastIndex = 0;
            }
            s = initialValue.replace(params.searchValue, params.replaceValue)
            // mlog.debug(`[clean()]`,
            //     TAB+`params: ${JSON.stringify(params)}`,
            //     TAB+`initialValue: '${initialValue}'`,
            //     TAB+`cleanedValue: '${s}'`
            // );
        }
    }
    if (stripOptions) {
        s = applyStripOptions(s, stripOptions);
    }
    if (caseOptions) {
        s = applyCaseOptions(s, caseOptions);
    }   
    if (padOptions && padOptions.padLength) {
        s = applyPadOptions(s, padOptions);
    }
    return s.trim().replace(/,$/g, '');
}


/**
 * @param s `string` - the string to convert to title case
 * @returns **`s`** `string` - the string in title case 
 * (i.e. first letter of each word, determined by the `\b` boundary metacharacter, is capitalized)
 */
export function toTitleCase(s: string): string {
    if (!s) return '';
    return s
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/(?<=\b[A-Z]{1})\w*\b/g, char => char.toLowerCase());
}

/**
 * @param s `string` - the string to handle case options for
 * @param caseOptions — {@link StringCaseOptions} - `optional` case options to apply to the string
 * = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * - applies the first case option that is `true` and ignores the rest
 * @returns **`s`** - the string with case options applied
 */
export function applyCaseOptions(
    s: string, 
    caseOptions: StringCaseOptions = { toUpper: false, toLower: false, toTitle: false }
): string {
    if (!s) return '';
    const { toUpper, toLower, toTitle } = caseOptions;
    if (toUpper) {
        s = s.toUpperCase();
    } else if (toLower) {
        s = s.toLowerCase();
    } else if (toTitle) {
        s = toTitleCase(s);   
    }
    return s;
}

/**
 * @param s `string` - the string to handle padding options for
 * @param padOptions — {@link StringPadOptions} - `optional` padding options to apply to the string
 * = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 * - applies the first padding option that is `true` and ignores the rest
 * @returns **`s`** - the string with padding options applied
 * @note `if` `s.length >= padLength`, no padding is applied
 */
export function applyPadOptions(
    s: string,
    padOptions: StringPadOptions = { padLength: 24, padChar: ' ', padLeft: false, padRight: false }
): string {
    if (!s) return '';
    const { padLength, padChar, padLeft, padRight } = padOptions;
    if (typeof padLength !== 'number' || padLength < 0) {
        mlog.warn('handlePadOptions() Invalid padLength. Expected a positive integer, but received:', padLength);
        return s;
    }
    if (s.length >= padLength) {
        return s; // No padding needed
    }
    if (padLeft) {
        s = s.padStart(padLength, padChar);
    } else if (padRight) {
        s = s.padEnd(padLength, padChar);
    }
    return s;
}

/**
 * @param s `string`
 * @param stripOptions — {@link StringStripOptions} 
 * = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * - if `stripLeftCondition(s, leftArgs)` is `true` or `stripLeftCondition` is `undefined` (i.e. no conditions need to be met to strip left):
 * - - then the left side of the `s` is stripped of `char`
 * - if `stripRightCondition(s, rightArgs)` is `true` or `stripRightCondition` is `undefined` (i.e. no conditions need to be met to strip right):
 * - - then the right side of the `s` is stripped of `char`
 * @param stripOptions.escape escape special regex characters in `char` with `char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
 * @returns `string` - the string with leading and trailing characters removed
 */
export function applyStripOptions(
    s: string, 
    stripOptions: StringStripOptions
): string {
    if (!s) return '';
    let { char, escape = false, stripLeftCondition = false, leftArgs, stripRightCondition = false, rightArgs } = stripOptions;
    if (escape) {
        char = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    let regexSource = '';
    const leftSideUnconditionalOrMeetsCondition = !stripLeftCondition || (stripLeftCondition && stripLeftCondition(s, leftArgs));
    const rightSideUnconditionalOrMeetsCondition = !stripRightCondition || (stripRightCondition && stripRightCondition(s, rightArgs));
    if (leftSideUnconditionalOrMeetsCondition) {
        regexSource = regexSource + `^${char}+`;
    }
    if (regexSource.length > 0) {
        regexSource = regexSource + '|';
    }
    if (rightSideUnconditionalOrMeetsCondition) {
        regexSource = regexSource + `${char}+$`;
    }
    if (!stripLeftCondition && !stripRightCondition) { // assume strip both sides
        regexSource = `^${char}+|${char}+$`;
    }

    const regex = new RegExp(regexSource, 'g');
    return s.replace(regex, '');
}