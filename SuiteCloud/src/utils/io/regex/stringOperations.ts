/**
 * @file src/utils/io/regex/stringOperations.ts
 */
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL} from "../../../config";
import { StringCaseOptions, StringReplaceOptions } from ".";
import { clean } from "./cleaning";
import { distance as levenshteinDistance } from "fastest-levenshtein";
import { RegExpFlagsEnum } from "./configureParameters";



/**
 * Checks if a string ends with any of the specified suffixes.
 * @param s The `string` to check.
 * @param suffixes An array of possible ending strings.
 * @param flags `Optional` regex flags to use when creating the {@link RegExp} object. see {@link RegExpFlagsEnum}
 * @returns **`true`** if the string ends with any of the suffixes, **`false`** otherwise.
 * @example
 * const myString = "hello world";
 * const possibleEndings = ["world", "universe", "planet"];
 * console.log(endsWithAny(myString, possibleEndings)); // Output: true
 * const anotherString = "goodbye moon";
 * console.log(endsWithAny(anotherString, possibleEndings)); // Output: false
 */
export function stringEndsWithAnyOf(
    s: string, 
    suffixes: string | string[] | RegExp, 
    ...flags: RegExpFlagsEnum[]
): boolean {
    if (!s || !suffixes) {
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
        mlog.warn('endsWithAnyOf() Invalid suffixes type. returning false.', 
            'Expected string, array of strings, or RegExpbut received:', typeof suffixes, suffixes);
        return false; // Invalid suffixes type
    }
    // log.debug(`stringEndsWithAnyOf()`,
    //     TAB + `regex: ${regex}`,
    //     TAB + `regex.test("${s}"): ${regex.test(s)}`
    // )
    return regex.test(s);
}

/**
 * @param str The `string` to check.
 * @param prefixes possible starting string(s).
 * @param flags `Optional` regex flags to use when creating the {@link RegExp} object. see {@link RegExpFlagsEnum}
 * @returns **`true`** if the string starts with any of the prefixes, **`false`** otherwise.
 */
export function stringStartsWithAnyOf(
    str: string, 
    prefixes: string | string[] | RegExp, 
    ...flags: RegExpFlagsEnum[]
): boolean {
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
        const pattern = `^\\s*(${escapedPrefixes.join('|')})`;
        regex = new RegExp(pattern, flags?.join('') || undefined);
    } else if (prefixes instanceof RegExp) {
        let source = prefixes.source.startsWith('^\\s*') 
            ? prefixes.source 
            : '^\\s*' + prefixes.source;
        regex = new RegExp(source, flags?.join('') || undefined); 
    }

    if (!regex) {
        mlog.warn(
            'startsWithAnyOf() Invalid prefixes type. returning false.', 
            TAB + 'Expected string, array of strings, or RegExp, but received:', typeof prefixes, 
            TAB + 'prefixes', prefixes
        );
        return false; // Invalid prefixes type
    }
    return regex.test(str);
}

/**
 * @param str The `string` to check.
 * @param substrings possible substring(s).
 * @param flags `Optional` regex flags to use when creating the {@link RegExp} object. see {@link RegExpFlagsEnum}
 * @returns **`true`** if the string contains any of the substrings, **`false`** otherwise.
 */
export function stringContainsAnyOf(
    str: string, 
    substrings: string | string[] | RegExp, 
    ...flags: RegExpFlagsEnum[]
): boolean {
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
        mlog.warn('containsAnyOf() Invalid substrings type. returning false.', 
        TAB + `Expected string, array of strings, or RegExp, but received: ${typeof substrings}, ${substrings}`);
        return false; // Invalid substrings type
    }
    return regex.test(str);
}

/**
 * @consideration add parameter to ignore case. currently: 
 * - converts `s1` & `s2` to lowercase and removes all non-alphanumeric characters from both strings,
 * - sorts the characters in both strings,
 * - then compares the two strings for equivalence.
 * @param s1 `string`
 * @param s2 `string`
 * @param tolerance `number` - a number between 0 and 1, default is `0.90`
 * @returns **`boolean`** 
 * - **`true`** `if` the two alphanumeric strings are equivalent, 
 * - **`false`** `otherwise`.
 */
export function equivalentAlphanumericStrings(
    s1: string, 
    s2: string, 
    tolerance: number = 0.90,
): boolean {
    if (!s1 || !s2) return false;
    let s1Alphabetical = clean(s1,
        undefined, 
        { toLower: true } as StringCaseOptions, 
        undefined, 
        [{searchValue: /[^A-Za-z0-9]/g, replaceValue: '' }] as StringReplaceOptions
    ).split('').sort().join('');
    let s2Alphabetical = clean(s2, 
        undefined, 
        { toLower: true } as StringCaseOptions, 
        undefined, 
        [{searchValue: /[^A-Za-z0-9]/g, replaceValue: '' }] as StringReplaceOptions
    ).split('').sort().join('');
    if (s1Alphabetical.length === 0 || s2Alphabetical.length === 0) {
        return false;
    }
    if (s1Alphabetical === s2Alphabetical) { // exact match
        return true;
    } 
    const maxLevenshteinDistance = Math.max(
        Math.floor(s1Alphabetical.length * (1 - tolerance)), 
        Math.floor(s2Alphabetical.length * (1 - tolerance)), 
    );
    // DEBUG.push(NL+`equivalentAlphanumericStrings() - maxLevenshteinDistance = ${maxLevenshteinDistance}`,
    //     TAB + `levenshteinDistance("${s1}", "${s2}") = ${levenshteinDistance(s1, s2)}`,
    //     TAB + `levenshteinDistance("${s1Alphabetical}", "${s2Alphabetical}") = ${levenshteinDistance(s1Alphabetical, s2Alphabetical)}`,
    // );
    if (levenshteinDistance(s1, s2) <= maxLevenshteinDistance
        || levenshteinDistance(s1Alphabetical, s2Alphabetical) <= maxLevenshteinDistance
    ) { 
        return true;
    }
    const s1IncludesTolerableS2 = (s2.length > 0 && s2Alphabetical.length > 0
        && s1Alphabetical.length >= s2Alphabetical.length
        && s2Alphabetical.length / s1Alphabetical.length >= tolerance 
        && s1Alphabetical.includes(s2Alphabetical)
    );
    const s2IncludesTolerableS1 = (s1.length > 0 && s1Alphabetical.length > 0
        && s2Alphabetical.length >= s1Alphabetical.length
        && s1Alphabetical.length / s2Alphabetical.length >= tolerance
        && s2Alphabetical.includes(s1Alphabetical)
    );
    // DEBUG.push(
    //     TAB + `s1IncludesTolerableS2 ? ${s1IncludesTolerableS2}`,
    //     TAB + `s2IncludesTolerableS1 ? ${s2IncludesTolerableS1}`,
    // );
    if (s1IncludesTolerableS2 || s2IncludesTolerableS1) { 
        // DEBUG.push(NL+` -> returning true`);
        return true;
    }
    // DEBUG.push(NL+` -> returning false`);
    return false;
}

