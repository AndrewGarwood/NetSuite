/**
 * @file src/utils/io/regex.ts
 */
import { printConsoleGroup as print } from "./writing";


// TODO: use regex to check if date is in a valid format (e.g. YYYY-MM-DD, MM/DD/YYYY, etc.)

/** 
 * could instead make a list then join with `|` and use `new RegExp()` to create a regex from the list
 * /(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc . . ./ 
 * */
export const COMPANY_KEYWORDS_PATTERN: RegExp = 
/(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc|group|consulting|consultants|packaging|print|associates|partners|practice|service(s)?|America|USA|\.com)\s*$/i;



/** `/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/` */
export const BOOLEAN_FIELD_ID_REGEX = new RegExp(/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/)

/** = `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
 * @param {string} s `string`
 * @param {string} char `string`
 * @param {boolean} escape `boolean`
 * @returns `strippedString` {string}
 */
export function stripChar(s: string, char: string, escape: boolean=false): string {
    if (escape) {
        char = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    const regex = new RegExp(`^${char}+|${char}+$`, 'g');
    return s.replace(regex, '');
}

/**
 * @param {string} phone - `string` - phone number to test
 * @param {string} label - `string` - `optional` label to print in the console
 * @returns {string} `phone` - formatted phone number
 * @description test phone on regex in this order:
 * 1. {@link JAPAN_PHONE_REGEX}
 * 2. {@link KOREA_PHONE_REGEX}
 * 3. GENERIC_{@link PHONE_REGEX}
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
    const originalPhone = String(phone);
    phone = String(phone).trim();
    if (JAPAN_PHONE_REGEX.test(phone)) {
        console.log(`JAPAN_PHONE_REGEX.test(${phone}) == true`);
        phone = phone.replace(JAPAN_PHONE_REGEX, '$1-$2-$3-$4');
    } else if (KOREA_PHONE_REGEX.test(phone)) {
        console.log(`KOREA_PHONE_REGEX.test(${phone}) == true`);
        phone = phone.replace(KOREA_PHONE_REGEX, '$1-$2-$3-$4');
    } else if (PHONE_REGEX.test(phone)) {
        console.log(`PHONE_REGEX.test(${phone}) == true`);
        phone = phone.replace(PHONE_REGEX, '$1-$2-$3-$4 ext $5');
    } else if (phone.length === 10 && /^\d{10}$/.test(phone)) {
        console.log(`PHONE_REGEX.test(${phone}) == false and phone.length == 10`);
        phone = phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (phone.length === 11 && /^\d{11}$/.test(phone) && phone.startsWith('1')) {
        console.log(`PHONE_REGEX.test(${phone}) == false and phone.length == 11 and phone.startsWith('1')`);
        phone = phone.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1-$2-$3-$4');
    } 
    phone = stripChar(phone, '-', false).replace(/\s{2,}/, ' ').replace(/ext(?=\D*$)/,'').trim();
    print({
        label: `testPhoneRegex()` + (label ? ` ${label}` : ''), 
        details: [`originalPhone: "${originalPhone}"`, `finalPhone:    "${phone}"`], 
        printToConsole: false, 
        enableOverwrite: false
    });
    return phone;
}

/**
 * @reference {@link https://javascript.info/regexp-introduction}
 * @enum {string} RegExpFlagsEnum
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
 * @param flags Optional regex flags to use when creating the RegExp object. see {@link RegExpFlagsEnum}
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