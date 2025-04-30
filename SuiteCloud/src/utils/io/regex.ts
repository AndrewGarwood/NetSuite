/**
 * @file src/utils/io/regex.ts
 */


// TODO: use regex to check if date is in a valid format (e.g. YYYY-MM-DD, MM/DD/YYYY, etc.)

/** 
 * /(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc . . ./ 
 * */
export const COMPANY_KEYWORDS_PATTERN: RegExp = 
/(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc|group|consulting|consultants|packaging|print|associates|partners|practice|service(s)?|health|healthcare|medical| spa|spa |surgeons|aesthetic|America|USA|\.com)\s*$/i;



/** `/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/` */
export const BOOLEAN_FIELD_ID_REGEX = new RegExp(/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/)

/** = `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** 
 * Phone Number Regular Expression
 * `/^(1-)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}( ext \d{4})?$/`
 * @description Phone numbers can be entered in the following formats: 
 * 1. `999-999-9999`
 * 2. `1-999-999-9999`
 * 3. `(999) 999-9999`
 * 4. `1(999) 999-9999`
 * 5. `999-999-9999 ext 9999`
 * */
export const PHONE_REGEX: RegExp = /^(1-)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}( ext \d{4})?$/;


/**
 * @TODO if escape === true, escape all special characters in char (i.e. append \\ to them)
 * - could do something like: 
        `const escapedSuffixes = suffixes.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = `(${escapedSuffixes.join('|')})\\s*$`;`
 * @param {string} s `string`
 * @param {string} char `string`
 * @param {boolean} escape `boolean`
 * @returns `strippedString` {string}
 */
export function stripChar(s: string, char: string, escape: boolean=false): string {
    if (escape) {
        char = '\\' + char;
    }
    const regex = new RegExp(`^${char}+|${char}+$`, 'g');
    return s.replace(regex, '');
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