/**
 * @file src/utils/io/regex.ts
 */
import { parseLogger as log, mainLogger as mlog, INDENT_LOG_LINE as TAB } from 'src/config/setupLog';
import { StateAbbreviationEnum } from '../NS';
import { StringCaseOptions, StringPadOptions, StringStripOptions } from "./types/Reading";


/**
 * @TODO implement a StringReplaceOptions
 * @description 
 * - Removes leading+trailing spaces, extra spaces, commas, and dots from a string (e.g. `'..'` becomes `'.'`)
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
 * @returns **`s`** - the cleaned `string`
 */
export function cleanString(
    s: string,
    stripOptions?: StringStripOptions, 
    caseOptions?: StringCaseOptions,
    padOptions?: StringPadOptions
): string {
    if (!s) return '';
    s = String(s).trim();
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
    return s.trim().replace(/,$/g, '');
}
/**
 * 
 * @param s `string` - the string to convert to title case
 * @returns `string` - the string in title case 
 * (i.e. first letter of each word, determined by the `\b` boundary metacharacter, is capitalized)
 */
export function toTitleCase(s: string): string {
    if (!s) return '';
    return s
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/(?<=\b[A-Z]{1})\w*\b/g, char => char.toLowerCase());
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

    const regex = new RegExp(regexSource, 'g');
    return s.replace(regex, '');
}

/**
 * @reference {@link https://javascript.info/regexp-introduction}
 * @enum {string} **`RegExpFlagsEnum`**
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

const COMPANY_KEYWORD_LIST: string[] = [
    'company',
];

/** 
 * @TODO divide COMPANY_KEYWORDS_PATTERN into multiple regexes then compose
 * could instead make a {@link COMPANY_KEYWORD_LIST} then join with `|` and use `new RegExp()` to create a regex from the list
 * - `re` = `/\b(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc . . .)\b/ `
 * */
export const COMPANY_KEYWORDS_PATTERN: RegExp = 
/\b(?:compan(y|ies)|[+@&]+|corporation|corporate|(drop)?box|corp|inc|co\.|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|plc|llp|(un)?limited|nys|oc|mc|pr|local|group|consulting|consultant(s)?|vcc|bcp|center|(in)?pack(aging|age)?|electric|chemical|Exhibit(s)?|business|Factory|employee|print(s|ing)?|Pharmaceutical(s)?|vistaprint|associates|association|account(s)?|art(s)?|AMZ|independent|beauty|beautiful(ly)?|meditech|medaesthetic|partners|Acupuncture|Affiliate(s)?|telecom|maps|cosmetic(s)?|connections|practice|computer|service(s)?|skincare|skin|face|facial|body|artisan(s)?|Alchemy|advanced|surgical|surgery|surgeons|administrators|laser|practice|scientific|science|health|healthcare|medical|med|med( |i)?spa|spa|perfect|surgeons|(med)?(a)?esthetic(s|a)?|salon|lounge|studio|wellness|courier|capital|financ(e|ing)|collector|dept(\.)?|HVAC|insurance|ins|surety|freight|fine art|solution(s)?|trad(e|ing)|renewal|department|inst\.|institute|instant|university|college|America(n)?|US(A)?|global|digital|virtual|orange|coast(al)?|tree|franchise|orthopedic(s)?|academy|advertising|travel|technologies|flash|international|tech|clinic(s|al)?|Exterminator|Nightclub|management|foundation|aid|product(ions|ion|s)?|industr(y|ies|ial)|biomed|bio|bio-chem|lubian|technology|technical|special(ist(s)?|ities)?|support|innovat(e|ive|ion(s)?)|county|united|state(s)?|the|one|of|for|by|and|on|or|at|it|the|about|plan|legal|valley|republic|recruit(ing)?|media|southern|office|post office|clean(er|ers)|transport|law|contract|high|food|meal|therapy|dental|laboratory|instrument|southwest|ingredient(s)?|commerce|city|Laboratories|lab|logistics|newport|radio|video|photo(graphy)?|korea|communication(s)|derm(atology|atologist(s)?)|new|express|goods|mission|depot|treasur(e|er|y)|revenue|biolab|Orders|staff(ing|ed)?|investors|envelope|refresh|Anti|AgingMajestic|motors|museum|event|Kaiser|pacific|visa|platinum|level|Rejuvenation|bespoke|Cardio|speed|pro|tax|firm|DC|square|store|weight|group|Buy|balance(d)?|buckhead|market(s)?|Bulk|perks|GPT|Boutique|supplement(s)?|vitamin(s)?|plus|sales|salesforce|precision|fitness|image|premier|Fulfillment|final|elite|elase|sculpt(ing)?|botox|south|Hills|symposium|wifi|online|worldwide|tv|derm([a-z]+)|wine|rent(al(s)?)?|mail|plumber(s)?|Sociedade|card|\.com)\b/i;
/** - `re` =  `/\b(?:corp|inc|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|p\.?c|plc)\.?\s*$/i` */
export const COMPANY_ABBREVIATION_PATTERN: RegExp =
/\b(?:corp|inc|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|p\.?c|plc|llp)\.?\s*$/i;

/** 
 * @param {string} s - `string` - the string to check
 * @returns `!s.endsWith('Ph.D.') && !`{@link stringEndsWithAnyOf}`(s`, {@link COMPANY_ABBREVIATION_PATTERN} as RegExp, `[`{@link RegExpFlagsEnum.IGNORE_CASE}`]) && !stringEndsWithAnyOf(s, /\b[A-Z]\.?\b/, [RegExpFlagsEnum.IGNORE_CASE]);` */
export function doesNotEndWithKnownAbbreviation(s: string): boolean {
    if (!s) return false;
    s = s.trim();
    const singleInitialPattern = /\b[A-Z]\.?\b/;
    return !s.endsWith('Ph.D.') 
        && !stringEndsWithAnyOf(s, /\b[A-Z]{2}\.?\b/) 
        && !stringEndsWithAnyOf(s, JOB_TITLE_SUFFIX_PATTERN, RegExpFlagsEnum.IGNORE_CASE) 
        && !stringEndsWithAnyOf(s, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE) 
        && !stringEndsWithAnyOf(s, singleInitialPattern, RegExpFlagsEnum.IGNORE_CASE);
}

/** strip leading `.` and trailing `.` if satisfy stripRightCondition: {@link doesNotEndWithKnownAbbreviation} */
export const STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION: StringStripOptions = {
    char: '.',
    escape: true,
    stripLeftCondition: undefined,
    leftArgs: undefined,
    stripRightCondition: doesNotEndWithKnownAbbreviation,
}

/** always strip leading and trailing `.` from a `string` */
export const UNCONDITIONAL_STRIP_DOT_OPTIONS: StringStripOptions = {
    char: '.',
    escape: true,
    stripLeftCondition: undefined,
    leftArgs: undefined,
    stripRightCondition: undefined,
    rightArgs: undefined
}

/** `re` = `/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/` */
export const BOOLEAN_FIELD_ID_REGEX = new RegExp(/(^(is|give|send|fax|email)[a-z0-9]{2,}$)/)

/** `re` = `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` */
export const EMAIL_REGEX = new RegExp(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, 
    RegExpFlagsEnum.GLOBAL
);

export function isValidEmail(email: string): boolean {
    if (!email) return false;
    email = email.trim();
    return EMAIL_REGEX.test(email);
}

/** @returns `email`: `string` - the first email that matches {@link EMAIL_REGEX} or an empty string `''`*/
export function extractEmail(email: string): RegExpMatchArray | null {
    if (!email) return null;
    email = email.trim();
    const debugLogs: any[] = [];
    const match = email.match(EMAIL_REGEX);
    debugLogs.push(
        `extractEmail() EMAIL_REGEX.test("${email}") = ${EMAIL_REGEX.test(email)}`, 
        TAB + `match=${JSON.stringify(match)}`
    );
    if (match) {
        debugLogs.push(`-> match not null -> returning ${JSON.stringify(match)}`);
        log.debug(...debugLogs);
        return match;
    }
    debugLogs.push(`-> match is null -> returning null`);
    log.debug(...debugLogs);
    return null;
}
/** `re` = /`^(a(t{1,2})n:)?\s*((Mr|Ms|Mrs|Dr|Prof)\.?)*\s*`/i */
export const ATTN_SALUTATION_PREFIX_PATTERN = new RegExp(
    /^((attention|attn|atn):)?\s*((Mr|Ms|Mrs|Dr|Prof)\.?)*\s*/, 
    RegExpFlagsEnum.IGNORE_CASE
);
/** `re` = /`^(Mr\.|Ms\.|Mrs\.|Dr\.|Mx\.)`/i */
export const SALUTATION_REGEX = new RegExp(
    /^(Mr\.|Ms\.|Mrs\.|Dr\.|Mx\.)/, 
    RegExpFlagsEnum.IGNORE_CASE
);
/** `re` = /`^[A-Z]{1}\.?$`/i */
export const MIDDLE_INITIAL_REGEX = new RegExp(
    /^[A-Z]{1}\.?$/, 
    RegExpFlagsEnum.IGNORE_CASE
);
/** `re` = `/\b(,? ?(MSPA|BSN|FNP-C|LME|DDS|DOO|Ph\.?D\.|PA-C|MSN-RN|RN|NP|CRNA|FAAD|FNP|PA|NMD|MD|M\.D|DO|LE|CMA|OM|Frcs|FRCS|FACS|FAC)\.?,?)*\b/g`  */
export const JOB_TITLE_SUFFIX_PATTERN = new RegExp(
    /\b(,? ?(MSPA|BSN|FNP-C|LME|DDS|DOO|Ph\.?D\.|PA-C|MSN-RN|RN|NP|CRNA|FAAD|FNP|PA|NMD|MD|M\.D|DO|LE|CMA|OM|Frcs|FRCS|FACS|FAC)\.?,?)*\b/, 
    RegExpFlagsEnum.GLOBAL
); 
/**
 * **if** `name` starts with a number or contains any of {@link COMPANY_KEYWORDS_PATTERN}, do not attempt to extract name and return empty strings
 * @param name `string` - the full name from which to extract 3 parts: the first, middle, and last names
 * @returns `{first: string, middle?: string, last?: string}` - the first, middle, and last names
 * @example
 * let name = 'John Doe';
 * console.log(extractName(name)); // { first: 'John', middle: '', last: 'Doe' }
 * let name = 'John A. Doe';
 * console.log(extractName(name)); // { first: 'John', middle: 'A.', last: 'Doe' }
 */
export function extractName(name: string): {
    first: string, 
    middle?: string, 
    last?: string
} {
    if (!name || typeof name !== 'string') return { first: '', middle: '', last: '' };
    name = name
        .replace(/\s+/g, ' ')
        .replace(ATTN_SALUTATION_PREFIX_PATTERN,'')
        .replace(JOB_TITLE_SUFFIX_PATTERN,'')
        .trim();
    const debugLogs: any[] = [];
    if ( // invalid name
        stringContainsAnyOf(name, /[0-9!#&@]/) 
        || stringContainsAnyOf(name, COMPANY_KEYWORDS_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
    ) {
        debugLogs.push(`extractName()`,
            TAB + `stringContainsAnyOf("${name}", /[0-9!#&@]/) = ${stringContainsAnyOf(name, /[0-9!#&@]/)}`, 
            TAB + `or stringContainsAnyOf("${name}", COMPANY_KEYWORDS_PATTERN) = ${stringContainsAnyOf(name, COMPANY_KEYWORDS_PATTERN, RegExpFlagsEnum.IGNORE_CASE)}`
        );
        return { first: '', middle: '', last: '' };
    }
    const nameSplit = name.split(/\s+/);
    nameSplit.map((namePart) => cleanString(
        namePart, 
        STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION
    ).replace(/(^[-+])*/g, ''));
    debugLogs.push(`nameSplit.length == ${nameSplit.length}, nameSplit: [${nameSplit}]`);
    if (nameSplit.length == 1) {
        return { first: nameSplit[0].replace(/,$/g, ''), middle: '', last: '' };
    } else if (nameSplit.length == 2) {
        return { first: nameSplit[0].replace(/,$/g, ''), middle: '', last: nameSplit[1].replace(/,$/g, '') };
    } else if (nameSplit.length > 2) {
        return { first: nameSplit[0].replace(/,$/g, ''), middle: nameSplit[1].replace(/,$/g, ''), last: nameSplit.slice(2).join(' ').replace(/,$/g, '') };
    }
    debugLogs.push(`extractName() - no valid name parts found, returning empty strings`);
    log.debug(...debugLogs);
    return { first: '', middle: '', last: '' }; 
}

// https://en.wikipedia.org/wiki/List_of_telephone_country_codes

/** 
 * @description 
 * `re` = `/(?:^|\D)(\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})[-.\s]?(?:ext|x|ex)?(?:[-:.\s]*)?(\d{1,4})?(?:\D|$)/i`
 * - There are 5 capturing groups in the regex:
 * - **`$1`** - Country code (optional) - `(\d{1,3})`
 * - **`$2`** - Area code - `(\d{3})`
 * - **`$3`** - First three digits - `(\d{3})`
 * - **`$4`** - Last four digits - `(\d{4})`
 * - **`$5`** - Extension (optional) - `( ?ext ?(\d{3,4}))?`
 * */
export const PHONE_REGEX = new RegExp(
    /(?:^|\D)(\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})[-.\s]?(?:ext|x|ex)?(?:[-:.\s]*)?(\d{1,4})?(?:\D|$)/,
    RegExpFlagsEnum.IGNORE_CASE + RegExpFlagsEnum.GLOBAL
);
    // /(?:^\D*(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})[-.\s]?(?:ext|x|ex)?(?:[-:.\s]*)?(\d{1,4})?(?:\D*$)/i; 

/**
 * @description
 * `re` = `/(?:^|\D)(852)[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/`
 * - There are 3 capturing groups in the regex:
 * - **`$1`** - Country code - `(852)`
 * - **`$2`** - First four digits - `(\d{4})`
 * - **`$3`** - Last four digits - `(\d{4})`
 */
export const HONG_KONG_PHONE_REGEX = new RegExp(
    /(?:^|\D)(852)[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/,
    RegExpFlagsEnum.GLOBAL
);

/**
 * @description
 * `re` = `/(?:^|\D)(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/`
 * - There are 4 capturing groups in the regex:
 * - **`$1`** - Country code - `(86)`
 * - **`$2`** - Area code - `(\d{2,3})`
 * - **`$3`** - First four digits - `(\d{4})`
 * - **`$4`** - Last four digits - `(\d{4})`
 */
export const CHINA_PHONE_REGEX = new RegExp(
    /(?:^|\D)(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/,
    RegExpFlagsEnum.GLOBAL
);
/** 
 * @description 
 * `re` = `/(?:^|\D)(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/` 
 * - There are 4 capturing groups in the regex:
 * - **`$1`** - Country code - `(81)`
 * - **`$2`** - Area code - `(\d{1})`
 * - **`$3`** - First four digits - `(\d{4})`
 * - **`$4`** - Last four digits - `(\d{4})`
 */
export const JAPAN_PHONE_REGEX= new RegExp(
    /(?:^|\D)(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/,
    RegExpFlagsEnum.GLOBAL
);

/**
 * @description
 * `re` = `/(?:^|\D)(82)[-).\s]?(\d{1,2})?[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?:\D|$)/`
 * - There are 4 capturing groups in the regex:
 * - **`$1`** - Country code - `(82)`
 * - **`$2`** - Area code - `(\d{2})`
 * - **`$3`** - First three digits - `(\d{3})`
 * - **`$4`** - Last four digits - `(\d{4})`
 */
export const KOREA_PHONE_REGEX = new RegExp(
    /(?:^|\D)(82)[-).\s]?(\d{1,2})?[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?:\D|$)/,
    RegExpFlagsEnum.GLOBAL
);

const phoneRegexList: {re: RegExp, groupFormat: string}[] = [
    { re: CHINA_PHONE_REGEX, groupFormat: '$1-$2-$3-$4' },
    { re: HONG_KONG_PHONE_REGEX, groupFormat: '$1-$2-$3' },
    { re: KOREA_PHONE_REGEX, groupFormat: '$1-$2-$3-$4' },
    { re: JAPAN_PHONE_REGEX, groupFormat: '$1-$2-$3-$4' },
    { re: PHONE_REGEX, groupFormat: '$1-$2-$3-$4 ext $5' },
]

/**
 * @param {string} phone - `string` - phone number to test
 * @returns {string} `phone` - formatted phone number or empty string if unable to format it
 * @description test phone on regex in this order:
 * 1. {@link KOREA_PHONE_REGEX} = `/(?:^|\D)(82)[-).\s]?(\d{1,2})?[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?:\D|$)/`
 * 2. {@link HONG_KONG_PHONE_REGEX} = `/(?:^|\D)(852)[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/`
 * 3. {@link CHINA_PHONE_REGEX} = `/(?:^|\D)(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)`
 * 4. {@link JAPAN_PHONE_REGEX} = `/(?:^|\D)(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})(?:\D|$)/`
 * 5. GENERIC_{@link PHONE_REGEX} = `/(?:^|\D)(\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})[-.\s]?(?:ext|x|ex)?(?:[-:.\s]*)?(\d{1,4})?(?:\D|$)/i`
 * 6. `else` return emtpy string
 * @note Valid formats for NetSuite Phone Number fields are: 
 * 1. `999-999-9999`
 * 2. `1-999-999-9999`
 * 3. `(999) 999-9999`
 * 4. `1(999) 999-9999`
 * 5. `999-999-9999 ext 9999`
 */
export function extractPhone(phone: string): string[] | RegExpMatchArray | null {
    if (!phone) {
        return null;
    }
    const originalPhone = String(phone);
    // remove leading and trailing letters. remove commas, semicolons, colons, and slashes
    phone = originalPhone.trim().replace(/^\s*[a-zA-Z]*|[a-zA-Z]\s*$|[,;:/]/g, ''); 
    const debugLogs: any[] = [];
    for (let i = 0; i < phoneRegexList.length; i++) {
        const { re, groupFormat } = phoneRegexList[i];
        let matches =  phone.match(re);
        if (!matches) {
            continue;
        }
        let formattedPhones = matches.map(p => formatPhone(p, re, groupFormat));
        debugLogs.push(
            `extractPhone("${originalPhone}") - testing phoneRegexList[${i}] on "${phone}"`,
            TAB + `matches: ${JSON.stringify(matches)}`,
            TAB + `formattedPhones: ${JSON.stringify(formattedPhones)}`,
        )
        return formattedPhones;
    }
    if (phone) { // phone is non-empty and did not match any regex
        debugLogs.push(`extractPhone() - no match found for "${phone}", returning empty string.`)
    };
    log.debug(...debugLogs);
    return null;

}

/**
 * @param phone `string` - the phone number to format
 * @param re {@link RegExp} - the regex to use to extract the phone number
 * @param groupFormat `string` - use to format the phone number
 * - `optional` - if not provided, the phone number is returned as is 
 * @returns `phone`: `string` - the formatted phone number
 */
export function formatPhone(
    phone: string, 
    re: RegExp, 
    groupFormat?: string
): string {
    if (!phone) return '';
    let result: string = '';
    const match = phone.match(re);
    if (!match) {
        return '';
    }
    result = match[0] as string;
    if (groupFormat) {
        result = result.replace(re, groupFormat);
    }
    return cleanString(result, { char: '-', escape: false})
        .replace(/([a-zA-Z]+\s*$)/, '').trim();
}

/**
 * Checks if a string ends with any of the specified suffixes.
 * @param s The `string` to check.
 * @param suffixes An array of possible ending strings.
 * @param flags `Optional` regex flags to use when creating the {@link RegExp} object. see {@link RegExpFlagsEnum}
 * @returns `true` if the string ends with any of the suffixes, `false` otherwise.
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
        log.warn('endsWithAnyOf() Invalid suffixes type. returning false.', 
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
 * 
 * @param str The `string` to check.
 * @param prefixes possible starting string(s).
 * @param flags `Optional` regex flags to use when creating the {@link RegExp} object. see {@link RegExpFlagsEnum}
 * @returns 
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
        log.warn(
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
 * @returns 
 */
export function stringContainsAnyOf(str: string, substrings: string | string[] | RegExp, ...flags: RegExpFlagsEnum[]): boolean {
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
        log.warn('containsAnyOf() Invalid substrings type. returning false.', 
        TAB + `Expected string, array of strings, or RegExp, but received: ${typeof substrings}, ${substrings}`);
        return false; // Invalid substrings type
    }
    return regex.test(str);
}