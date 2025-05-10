/**
 * @file src/utils/io/regex.ts
 */
import { mainLogger as log } from 'src/config/setupLog';
import { printConsoleGroup as print } from "./writing";
import { StringCaseOptions, StringPadOptions, StringStripOptions } from "./types/Reading";


// TODO: use regex to check if date is in a valid format (e.g. YYYY-MM-DD, MM/DD/YYYY, etc.)
/**
 * @description 
 * - Removes extra spaces and dots from a string (e.g. `'..'` becomes `'.'`)
 * - optionally applies 3 option params with: {@link stripCharFromString}, {@link handleCaseOptions}, and {@link handlePadOptions}.
 * @param s - the `string` to clean
 * @param stripOptions — {@link StringStripOptions}
 * - `optional` strip options to apply to the string
 * = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * @param caseOptions — {@link StringCaseOptions} 
 * - `optional` case options to apply to the string
 * = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * @param padOptions — {@link StringPadOptions} 
 * - `optional` padding options to apply to the string
 * = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 * @returns `s` - the cleaned `string`
 */
export function cleanString(
    s: string,
    stripOptions?: StringStripOptions, 
    caseOptions?: StringCaseOptions,
    padOptions?: StringPadOptions
): string {
    if (!s) return '';
    s = s.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.');
    if (stripOptions) {
        s = stripCharFromString(s, stripOptions);
    }
    if (caseOptions) {
        s = handleCaseOptions(s, caseOptions);
    }   
    if (padOptions && padOptions.padLength) {
        s = handlePadOptions(s, padOptions);
    }
    return s.trim();
}
/**
 * 
 * @param s `string` - the string to convert to title case
 * @returns `string` - the string in title case 
 * (i.e. first letter of each word, determined by the `\b` boundary metacharacter, is capitalized)
 */
export function toTitleCase(s: string): string {
    if (!s) return '';
    return s.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * 
 * @param s `string` - the string to handle case options for
 * @param caseOptions — {@link StringCaseOptions} - `optional` case options to apply to the string
 * = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * - applies the first case option that is `true` and ignores the rest
 * @returns `s` - the string with case options applied
 */
export function handleCaseOptions(
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
 * 
 * @param s `string` - the string to handle padding options for
 * @param padOptions — {@link StringPadOptions} - `optional` padding options to apply to the string
 * = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 * - applies the first padding option that is `true` and ignores the rest
 * @returns `s` - the string with padding options applied
 * @note if `s.length >= padLength`, no padding is applied
 */
export function handlePadOptions(
    s: string,
    padOptions: StringPadOptions = { padLength: 24, padChar: ' ', padLeft: false, padRight: false }
): string {
    if (!s) return '';
    const { padLength, padChar, padLeft, padRight } = padOptions;
    if (typeof padLength !== 'number' || padLength < 0) {
        console.warn('handlePadOptions() Invalid padLength. Expected a positive integer, but received:', padLength);
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
 * @param {string} s `string`
 * @param {StringStripOptions} stripOptions — {@link StringStripOptions} 
 * = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * - if `stripLeftCondition(s, leftArgs)` is `true` or `stripLeftCondition` is `undefined` (i.e. no conditions need to be met to strip left):
 * - - then the left side of the `s` is stripped of `char`
 * - if `stripRightCondition(s, rightArgs)` is `true` or `stripRightCondition` is `undefined` (i.e. no conditions need to be met to strip right):
 * - - then the right side of the `s` is stripped of `char`
 * @param {boolean} stripOptions.escape escape special regex characters in `char` with `char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
 * @returns `string` - the string with leading and trailing characters removed
 */
export function stripCharFromString(
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
    log.debug(
        `          s: "${s}"`,
        `\nleftSideUnconditionalOrMeetsCondition: ${leftSideUnconditionalOrMeetsCondition}`,
        `\nrightSideUnconditionalOrMeetsCondition: ${rightSideUnconditionalOrMeetsCondition}`,
        `\nregexSource: "${regexSource}"`
    ); 
    const regex = new RegExp(regexSource, 'g');
    return s.replace(regex, '');
}

/** 
 * could instead make a list then join with `|` and use `new RegExp()` to create a regex from the list
 * - `re` = `/(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc . . ./ `
 * */
export const COMPANY_KEYWORDS_PATTERN: RegExp = 
/(?:company|corp|inc|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|plc|group|consulting|consultants|packaging|print|associates|partners|practice|service(s)?|America|USA|\.com)\s*$/i;
/** - `re` =  `/(?:|corp|inc|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|p\.?c|plc)\s*$/i` */
export const COMPANY_ABBREVIATION_PATTERN: RegExp =
/(?:|corp|inc|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|p\.?c|plc)\s*$/i;

export function doesNotEndWithKnownAbbreviation(s: string): boolean {
    if (!s) return false;
    s = s.trim();
    log.debug(
        `\ns: "${s}"`,
        `\n!s.endsWith('Ph.D.'): ${!s.endsWith('Ph.D.')}`,
        `\n!stringEndsWithAnyOf(s, COMPANY_ABBREVIATION_PATTERN): ${!stringEndsWithAnyOf(s, COMPANY_ABBREVIATION_PATTERN)}`,
        )
    return !s.endsWith('Ph.D.') && !stringEndsWithAnyOf(s, COMPANY_ABBREVIATION_PATTERN as RegExp);
}

/** `stripRightCondition`: {@link doesNotEndWithKnownAbbreviation} */
export const conditionalStripDotOptions: StringStripOptions = {
    char: '.',
    escape: true,
    stripLeftCondition: undefined,
    leftArgs: undefined,
    stripRightCondition: doesNotEndWithKnownAbbreviation,
}

export const unconditionalStripDotOptions: StringStripOptions = {
    char: '.',
    escape: true,
    stripLeftCondition: undefined,
    leftArgs: undefined,
    stripRightCondition: undefined,
    rightArgs: undefined
}

/** `/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/` */
export const BOOLEAN_FIELD_ID_REGEX = new RegExp(/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/)

/** = `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function isValidEmail(email: string): boolean {
    if (!email) return false;
    email = email.trim();
    return EMAIL_REGEX.test(email);
}

/** @returns `email`: `string` - the first email that matches {@link EMAIL_REGEX} or an empty string `''`*/
export function extractEmail(email: string): string {
    if (!email) return '';
    email = email.trim();
    const match = email.match(EMAIL_REGEX);
    if (match) {
        return match[0];
    }
    return '';
}


/** 
 * @TODO see if the non digit non capturing part is needed
 * @description 
 * `re` = `/(?:^\D*(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})( ?ext ?(\d{3,4}))?(?:\D*$)/`
 * - There are 5 capturing groups in the regex and 2 non-capturing groups:
 * - `$1` - Country code (optional) - `(?:^\D*(\d{1,3})[-.\s]?)?`
 * - - `(?:...)` is a non-capturing group, `^\D*` matches any non-digit characters (0 or more times), `(\d{1,3})` captures 1 to 3 digits, and `[-.\s]?` matches an optional separator (dash, dot, or space).
 * - `$2` - Area code - `(\d{3})`
 * - `$3` - First three digits - `(\d{3})`
 * - `$4` - Last four digits - `(\d{4})`
 * - `$5` - Extension (optional) - `( ?ext ?(\d{3,4}))?`
 * - - `(?:...)` Non-capturing group for any non-digit characters - `(?:\D*$)`
 * */
export const PHONE_REGEX: RegExp = 
    /(?:^\D*(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})[-.\s]?(?:ext)?(?:[-:.\s]*)?(\d{1,4})?(?:\D*$)/; 

/**
 * 
 */
export const HONG_KONG_PHONE_REGEX: RegExp = /(852)[-.\s]?(\d{4})[-.\s]?(\d{4})/;

/**
 * 
 */
export const CHINA_PHONE_REGEX: RegExp = /(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})/;
/** 
 * @description 
 * `re` = `/(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})/` 
 * - There are 4 groups in the regex:
 * - `$1` - Country code - `(81)`
 * - `$2` - Area code - `(\d{1})`
 * - `$3` - First four digits - `(\d{4})`
 * - `$4` - Last four digits - `(\d{4})`
 */
export const JAPAN_PHONE_REGEX: RegExp = /(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})/

/**
 * @description
 * `re` = `/(82)[-.\s]?(\d{2})[-.\s]?(\d{3})[-.\s]?(\d{4})/`
 * - There are 4 groups in the regex:
 * - `$1` - Country code - `(82)`
 * - `$2` - Area code - `(\d{2})`
 * - `$3` - First three digits - `(\d{3})`
 * - `$4` - Last four digits - `(\d{4})`
 */
export const KOREA_PHONE_REGEX: RegExp = /(82)[-.\s]?(\d{2})[-.\s]?(\d{3})[-.\s]?(\d{4})/

// https://en.wikipedia.org/wiki/List_of_telephone_country_codes

/**
 * @param {string} phone - `string` - phone number to test
 * @param {string} label - `string` - `optional` label to print in the console
 * @returns {string} `phone` - formatted phone number or empty string if unable to format it
 * @description test phone on regex in this order:
 * 1. {@link JAPAN_PHONE_REGEX} = `/(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})/`
 * 2. {@link KOREA_PHONE_REGEX} = `/(82)[-.\s]?(\d{2})[-.\s]?(\d{3})[-.\s]?(\d{4})/`
 * 3. GENERIC_{@link PHONE_REGEX} = `/(?:^\D*(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})( ?ext ?(\d{3,4}))?(?:\D*$)/`
 * 4. `\d{10}` (i.e. is a string of 10 digits), `return` as `\d{3}-\d{3}-\d{4}`
 * 5. `\d{11}` and `startsWith('1')` (i.e. is a USA phone number), `return` as `1-\d{3}-\d{3}-\d{4}`
 * 6. `else` return as is * 
 * @note Valid formats for NetSuite Phone Number fields are: 
 * 1. `999-999-9999`
 * 2. `1-999-999-9999`
 * 3. `(999) 999-9999`
 * 4. `1(999) 999-9999`
 * 5. `999-999-9999 ext 9999`
 */
export function applyPhoneRegex(phone: string, label?: string): string {
    if (!phone) {
        return '';
    }
    const originalPhone = String(phone);
    phone = String(phone).trim();
    if (JAPAN_PHONE_REGEX.test(phone)) {
        // print({label:`Valid Phone Found!`, details: `JAPAN_PHONE_REGEX.test(${phone}) == true`, printToConsole: false});
        phone = extractPhone(phone,JAPAN_PHONE_REGEX).replace(JAPAN_PHONE_REGEX, '$1-$2-$3-$4');
    } else if (KOREA_PHONE_REGEX.test(phone)) {
        // print({label:`Valid Phone Found!`, details: `KOREA_PHONE_REGEX.test(${phone}) == true`, printToConsole: false});
        phone = extractPhone(phone, KOREA_PHONE_REGEX).replace(KOREA_PHONE_REGEX, '$1-$2-$3-$4');
    }  else if (HONG_KONG_PHONE_REGEX.test(phone)) {
        // print({label:`Valid Phone Found!`, details: `HONG_KONG_PHONE_REGEX.test(${phone}) == true`, printToConsole: false});
        phone = extractPhone(phone, HONG_KONG_PHONE_REGEX).replace(HONG_KONG_PHONE_REGEX, '$1-$2-$3');
    } else if (CHINA_PHONE_REGEX.test(phone)) {
        // print({label:`Valid Phone Found!`, details: `CHINA_PHONE_REGEX.test(${phone}) == true`, printToConsole: false});
        phone = extractPhone(phone, CHINA_PHONE_REGEX).replace(CHINA_PHONE_REGEX, '$1-$2-$3-$4');
    } else if (PHONE_REGEX.test(phone)) {
        // print({label:`Valid Phone Found!`, details: `PHONE_REGEX.test(${phone}) == true`, printToConsole: false});
        phone = extractPhone(phone, PHONE_REGEX).replace(PHONE_REGEX, '$1-$2-$3-$4 ext $5');
    } else if (phone.length === 10 && /^\d{10}$/.test(phone)) {
        // print({label:`Valid Phone Found!`, details: `PHONE_REGEX.test(${phone}) == false and phone.length == 10`, printToConsole: false});
        phone = extractPhone(phone, /(\d{3})(\d{3})(\d{4})/).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (phone.length === 11 && /^\d{11}$/.test(phone) && phone.startsWith('1')) {
        // print({label:`Valid Phone Found!`, details: `PHONE_REGEX.test(${phone}) == false and phone.length == 11`, printToConsole: false});
        phone = extractPhone(phone, /(\d{1})(\d{3})(\d{3})(\d{4})/).replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1-$2-$3-$4');
    } 
    phone = stripCharFromString(phone, {
        char: '-', 
        escape: false, 
        stripLeftCondition: undefined, 
        leftArgs: undefined, 
        stripRightCondition: undefined, 
        rightArgs: undefined
    } as StringStripOptions);
    phone = phone.replace(/\s{2,}/, ' ').replace(/ext(?=\D*$)/,'').trim();
    print({
        label: `applyPhoneRegex()` + (label ? ` ${label}` : ''), 
        details: [
            `originalPhone: "${originalPhone}"`, 
            `finalPhone:    "${phone}"`
        ], printToConsole: false
    });
    return phone;
}

export function extractPhone(phone: string, re: RegExp, groupFormat?: string): string {
    if (!phone) return '';
    const match = phone.match(PHONE_REGEX);
    if (match) {
        return match[0];
    }
    return '';
}

/**
 * @reference {@link https://javascript.info/regexp-introduction}
 * @enum {string} `RegExpFlagsEnum`
 * @property {string} IGNORE_CASE - `i` - case insensitive "the search is case-insensitive: no difference between `A` and `a`"
 * @property {string} MULTI_LINE - `m` - multi-line "Multiline mode" see {@link https://javascript.info/regexp-multiline-mode}
 * @property {string} GLOBAL - `g` - global search "With this flag the search looks for all matches, without it – only the first match is returned."
 * @property {string} DOT_MATCHES_NEWLINE - `s` - dot matches newline "By default, a dot doesn’t match the newline character `n`."
 * @property {string} UNICODE - `u` - unicode "Enables full Unicode support. The flag enables correct processing of surrogate pairs." see {@link https://javascript.info/regexp-unicode}
 * @property {string} STICKY - `y` - sticky search "searching at the exact position in the text." see {@link https://javascript.info/regexp-sticky}
 */
export enum RegExpFlagsEnum {
    IGNORE_CASE = 'i',
    MULTI_LINE = 'm',
    GLOBAL = 'g',
    DOT_MATCHES_NEWLINE = 's',
    UNICODE = 'u',
    STICKY = 'y'
}

/**
 * Checks if a string ends with any of the specified suffixes.
 * @param str The string to check.
 * @param suffixes An array of possible ending strings.
 * @param flags Optional regex flags to use when creating the RegExp object. see {@link RegExpFlagsEnum}
 * @returns `true` if the string ends with any of the suffixes, `false` otherwise.
 * @example
 * const myString = "hello world";
 * const possibleEndings = ["world", "universe", "planet"];
 * console.log(endsWithAny(myString, possibleEndings)); // Output: true
 * const anotherString = "goodbye moon";
 * console.log(endsWithAny(anotherString, possibleEndings)); // Output: false
 */
export function stringEndsWithAnyOf(str: string, suffixes: string | string[] | RegExp, flags?: string[]): boolean {
    if (!str || !suffixes) {
        return false;
    }
    let regex = undefined;
    if (typeof suffixes === 'string') {
        suffixes = [suffixes]; // Convert string to array of suffixes
    }
    if (Array.isArray(suffixes)) {   
        /** Escape special regex characters in suffixes and join them with '|' (OR) */
        const escapedSuffixes = suffixes.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = `(${escapedSuffixes.join('|')})\\s*$`;
        regex = new RegExp(pattern, flags?.join('') || undefined);
    } else if (suffixes instanceof RegExp) {
        let source = suffixes.source.endsWith('\\s*$') 
            ? suffixes.source 
            : suffixes.source + '\\s*$';
        regex = new RegExp(source, flags?.join('') || undefined);    
    }

    if (!regex) {
        console.warn('endsWithAnyOf() Invalid suffixes type. Expected string, array of strings, or RegExp. returning false, but received:', typeof suffixes, suffixes);
        return false; // Invalid suffixes type
    }
    return regex.test(str);
}


/**
 * 
 * @param str The string to check.
 * @param prefixes possible starting string(s).
 * @param flags Optional regex flags to use when creating the RegExp object. see {@link RegExpFlagsEnum}
 * @returns 
 */
export function stringStartsWithAnyOf(str: string, prefixes: string | string[] | RegExp, flags?: string[]): boolean {
    if (!str || !prefixes) {
        return false;
    }
    let regex = undefined;
    if (typeof prefixes === 'string') {
        prefixes = [prefixes]; // Convert string to array of prefixes
    }
    if (Array.isArray(prefixes)) {   
        /** Escape special regex characters in suffixes and join them with '|' (OR) */
        const escapedPrefixes = prefixes.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = `^\s*(${escapedPrefixes.join('|')})`;
        regex = new RegExp(pattern, flags?.join('') || undefined);
    } else if (prefixes instanceof RegExp) {
        regex = new RegExp('^' + prefixes.source, flags?.join('') || undefined); 
    }

    if (!regex) {
        console.warn('startsWithAnyOf() Invalid prefixes type. Expected string, array of strings, or RegExp. returning false, but received:', typeof prefixes, prefixes);
        return false; // Invalid prefixes type
    }
    return regex.test(str);
}

/**
 * 
 * @param str The string to check.
 * @param substrings possible substring(s).
 * @param flags Optional regex flags to use when creating the {@link RegExp} object. see {@link RegExpFlagsEnum}
 * @returns 
 */
export function stringContainsAnyOf(str: string, substrings: string | string[] | RegExp, flags?: string[]): boolean {
    if (!str || !substrings) {
        return false;
    }
    let regex = undefined;
    if (typeof substrings === 'string') {
        substrings = [substrings]; // Convert string to array of substrings
    }
    if (Array.isArray(substrings)) {   
        /** Escape special regex characters in suffixes and join them with '|' (OR) */
        const escapedSubstrings = substrings.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = `(${escapedSubstrings.join('|')})`;
        regex = new RegExp(pattern, flags?.join('') || undefined);
    } else if (substrings instanceof RegExp) {
        regex = new RegExp(substrings.source, flags?.join('') || undefined); 
    }

    if (!regex) {
        console.warn('containsAnyOf() Invalid substrings type. Expected string, array of strings, or RegExp. returning false, but received:', typeof substrings, substrings);
        return false; // Invalid substrings type
    }
    return regex.test(str);
}