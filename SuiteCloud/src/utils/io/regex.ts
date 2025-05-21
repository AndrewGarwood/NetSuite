/**
 * @file src/utils/io/regex.ts
 */
import { mainLogger as log } from 'src/config/setupLog';
import { printConsoleGroup as print } from "./writing";
import { StringCaseOptions, StringPadOptions, StringStripOptions } from "./types/Reading";




/**
 * @description 
 * - Removes extra spaces, commas, and dots from a string (e.g. `'..'` becomes `'.'`)
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
/\b(?:compan(y|ies)|[@&]+|corporation|corporate|(drop)?box|corp|inc|co\.|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|plc|llp|(un)?limited|nys|oc|mc|pr|local|group|consulting|consultant(s)?|vcc|bcp|center|(in)?pack(aging|age)?|electric|chemical|Exhibit(s)?|business|Factory|employee|print(s|ing)?|Pharmaceutical(s)?|vistaprint|associates|association|account(s)?|art(s)?|AMZ|independent|beauty|beautiful(ly)?|meditech|partners|Acupuncture|Affiliate(s)?|telecom|maps|cosmetic(s)?|connections|practice|computer|service(s)?|skincare|skin|face|facial|body|artisan(s)?|Alchemy|advanced|surgical|surgery|surgeons|administrators|laser|practice|scientific|science|health|healthcare|medical|med|med( |i)?spa|spa|perfect|surgeons|(med)?(a)?esthetic(s|a)?|salon|lounge|studio|wellness|courier|capital|financ(e|ing)|collector|dept(\.)?|HVAC|insurance|ins|surety|freight|fine art|solution(s)?|trad(e|ing)|renewal|department|inst\.|institute|instant|university|college|America(n)?|US(A)?|global|digital|virtual|orange|coast(al)?|tree|franchise|orthopedic(s)?|academy|advertising|travel|technologies|flash|international|tech|clinic(s|al)?|Exterminator|Nightclub|management|foundation|aid|product(ions|ion|s)?|industr(y|ies|ial)|biomed|bio|bio-chem|lubian|technology|technical|special(ist(s)?|ities)?|support|innovat(e|ive|ion(s)?)|county|united|state(s)?|the|one|of|for|by|and|on|or|at|it|the|about|plan|legal|valley|republic|recruit(ing)?|media|southern|office|post office|clean(er|ers)|transport|law|contract|high|food|meal|therapy|dental|laboratory|instrument|southwest|ingredient(s)?|commerce|city|Laboratories|lab|logistics|newport|radio|video|photo(graphy)?|korea|communication(s)|derm(atology|atologist(s)?)|new|express|goods|mission|depot|treasur(e|er|y)|revenue|biolab|Orders|staff(ing|ed)?|investors|envelope|refresh|Anti|AgingMajestic|motors|museum|event|Kaiser|pacific|visa|platinum|level|Rejuvenation|bespoke|Cardio|speed|pro|tax|firm|DC|square|store|weight|group|Buy|balance(d)?|buckhead|market(s)?|Bulk|perks|GPT|Boutique|supplement(s)?|vitamin(s)?|plus|sales|salesforce|precision|fitness|image|premier|Fulfillment|final|elite|elase|sculpt(ing)?|botox|south|Hills|symposium|wifi|online|worldwide|tv|derm([a-z]+)|wine|rent(al(s)?)?|mail|plumber(s)?|Sociedade|card|\.com)\b/i;
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
    return !s.endsWith('Ph.D.') && !stringEndsWithAnyOf(s, COMPANY_ABBREVIATION_PATTERN as RegExp, RegExpFlagsEnum.IGNORE_CASE) && !stringEndsWithAnyOf(s, singleInitialPattern, RegExpFlagsEnum.IGNORE_CASE);
}

/** `stripRightCondition`: {@link doesNotEndWithKnownAbbreviation} */
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
        // log.debug(`extractEmail("${email}") = "${match[0]}"`);
        return match[0];
    }
    return '';
}
/** `re` = /`^(a(t{1,2})n:)?\s*((Mr|Ms|Mrs|Dr|Prof)\.?)*\s*`/i */
export const ATTN_SALUTATION_PREFIX_PATTERN 
    = new RegExp(/^(a(t{1,2})n:)?\s*((Mr|Ms|Mrs|Dr|Prof)\.?)*\s*/, RegExpFlagsEnum.IGNORE_CASE);
/** `re` = /`^(Mr\.|Ms\.|Mrs\.|Dr\.|Mx\.)`/i */
export const SALUTATION_REGEX 
    = new RegExp(/^(Mr\.|Ms\.|Mrs\.|Dr\.|Mx\.)/, RegExpFlagsEnum.IGNORE_CASE);
/** `re` = /`^[A-Z]{1}\.?$`/i */
export const MIDDLE_INITIAL_REGEX 
    = new RegExp(/^[A-Z]{1}\.?$/, RegExpFlagsEnum.IGNORE_CASE);
/** Matches "MSPA", "BSN", "FNP-C", "LME", "DOO", "PA-C", "MSN-RN", "RN", "NP", "CRNA", "FNP", "PA", "NMD", "MD", "DO", "LE", "CMA", "OM"  */
export const JOB_TITLE_SUFFIX_PATTERN 
    = /\b(,? ?(MSPA|BSN|FNP-C|LME|DOO|Ph\.?D\.|PA-C|MSN-RN|RN|NP|CRNA|FAAD|FNP|PA|NMD|MD|M\.D|DO|LE|CMA|OM|Frcs|FRCS|FACS|FAC)\.?,?)*\s*$/; 
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
    if ( // invalid name
        stringContainsAnyOf(name, /[0-9!#&@]/) 
        || stringContainsAnyOf(name, COMPANY_KEYWORDS_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
    ) {
        // log.debug(`stringContainsAnyOf("${name}", /[0-9!#&@]/) = ${stringContainsAnyOf(name, /[0-9!#&@]/)}`, 
        //     `\n\tor stringContainsAnyOf("${name}", COMPANY_KEYWORDS_PATTERN) = ${stringContainsAnyOf(name, COMPANY_KEYWORDS_PATTERN, RegExpFlagsEnum.IGNORE_CASE)}`);
        return { first: '', middle: '', last: '' };
    }
    const nameSplit = name.split(/\s+/);
    nameSplit.map((namePart) => cleanString(
        namePart, 
        STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION
    ).replace(/(^[-+])*/g, ''));
    if (nameSplit.length == 1) {
        // log.debug(`nameSplit.length == 1: [${nameSplit}]`);
        return { first: nameSplit[0].replace(/,$/g, ''), middle: '', last: '' };
    } else if (nameSplit.length == 2) {
        // log.debug(`nameSplit.length == 2: [${nameSplit}]`);
        return { first: nameSplit[0].replace(/,$/g, ''), middle: '', last: nameSplit[1].replace(/,$/g, '') };
    } else if (nameSplit.length > 2) {
        // log.debug(`nameSplit.length > 2: [${nameSplit}]`);
        return { first: nameSplit[0].replace(/,$/g, ''), middle: nameSplit[1].replace(/,$/g, ''), last: nameSplit.slice(2).join(' ').replace(/,$/g, '') };
    }
    return { first: '', middle: '', last: '' }; 
}


/** 
 * @TODO see if the non digit non capturing part is needed
 * @description 
 * `re` = `/(?:^\D*(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})( ?ext ?(\d{3,4}))?(?:\D*$)/`
 * - There are 5 capturing groups in the regex and 2 non-capturing groups:
 * - **`$1`**  - Country code (optional) - `(?:^\D*(\d{1,3})[-.\s]?)?`
 * - - `(?:...)` is a non-capturing group, `^\D*` matches any non-digit characters (0 or more times), `(\d{1,3})` captures 1 to 3 digits, and `[-.\s]?` matches an optional separator (dash, dot, or space).
 * - **`$2`** - Area code - `(\d{3})`
 * - **`$3`** - First three digits - `(\d{3})`
 * - **`$4`** - Last four digits - `(\d{4})`
 * - **`$5`** - Extension (optional) - `( ?ext ?(\d{3,4}))?`
 * - - `(?:...)` Non-capturing group for any non-digit characters - `(?:\D*$)`
 * */
export const PHONE_REGEX: RegExp = 
    /(?:^\D*(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})[-.\s]?(?:ext|x)?(?:[-:.\s]*)?(\d{1,4})?(?:\D*$)/; 

/**
 * @description
 * `re` = `/(852)[-.\s]?(\d{4})[-.\s]?(\d{4})/`
 * - There are 3 groups in the regex:
 * - **`$1`**  - Country code - `(852)`
 * - **`$2`** - First four digits - `(\d{4})`
 * - **`$3`** - Last four digits - `(\d{4})`
 */
export const HONG_KONG_PHONE_REGEX: RegExp = /(852)[-.\s]?(\d{4})[-.\s]?(\d{4})/;

/**
 * @description
 * `re` = `/(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})/`
 * - There are 4 groups in the regex:
 * - **`$1`**  - Country code - `(86)`
 * - **`$2`** - Area code - `(\d{2,3})`
 * - **`$3`** - First four digits - `(\d{4})`
 * - **`$4`** - Last four digits - `(\d{4})`
 */
export const CHINA_PHONE_REGEX: RegExp = /(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})/;
/** 
 * @description 
 * `re` = `/(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})/` 
 * - There are 4 groups in the regex:
 * - **`$1`**  - Country code - `(81)`
 * - **`$2`** - Area code - `(\d{1})`
 * - **`$3`** - First four digits - `(\d{4})`
 * - **`$4`** - Last four digits - `(\d{4})`
 */
export const JAPAN_PHONE_REGEX: RegExp = /(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})/

/**
 * @description
 * `re` = `/(82)[-.\s]?(\d{2})[-.\s]?(\d{3})[-.\s]?(\d{4})/`
 * - There are 4 groups in the regex:
 * - **`$1`** - Country code - `(82)`
 * - **`$2`** - Area code - `(\d{2})`
 * - **`$3`** - First three digits - `(\d{3})`
 * - **`$4`** - Last four digits - `(\d{4})`
 */
export const KOREA_PHONE_REGEX: RegExp = /(82)[-).\s]?(\d{1,2})?[-.\s]?(\d{3,4})[-.\s]?(\d{4})/

// https://en.wikipedia.org/wiki/List_of_telephone_country_codes

/**
 * @param {string} phone - `string` - phone number to test
 * @param {string} label - `string` - `optional` label to print in the console
 * @returns {string} `phone` - formatted phone number or empty string if unable to format it
 * @description test phone on regex in this order:
 * 1. {@link JAPAN_PHONE_REGEX} = `/(81)[-.\s]?(\d{1})[-.\s]?(\d{4})[-.\s]?(\d{4})/`
 * 2. {@link KOREA_PHONE_REGEX} = `/(82)[-.\s]?(\d{2})[-.\s]?(\d{3})[-.\s]?(\d{4})/`
 * 3. {@link HONG_KONG_PHONE_REGEX} = `/(852)[-.\s]?(\d{4})[-.\s]?(\d{4})/`
 * 4. {@link CHINA_PHONE_REGEX} = `/(86)[-.\s]?(\d{2,3})[-.\s]?(\d{4})[-.\s]?(\d{4})/`
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
    phone = originalPhone.trim().replace(/^\s*[a-zA-Z]*|[a-zA-Z]\s*$|[,;:/]/g, '');
    if (JAPAN_PHONE_REGEX.test(phone)) {
        phone = extractPhone(phone, JAPAN_PHONE_REGEX, '$1-$2-$3-$4');
    } else if (KOREA_PHONE_REGEX.test(phone)) {
        phone = extractPhone(phone, KOREA_PHONE_REGEX, '$1-$2-$3-$4');
    }  else if (HONG_KONG_PHONE_REGEX.test(phone)) {
        phone = extractPhone(phone, HONG_KONG_PHONE_REGEX, '$1-$2-$3');
    } else if (CHINA_PHONE_REGEX.test(phone)) {
        phone = extractPhone(phone, CHINA_PHONE_REGEX, '$1-$2-$3-$4');
    } else if (PHONE_REGEX.test(phone)) {
        phone = extractPhone(phone, PHONE_REGEX, '$1-$2-$3-$4 ext $5');
    } else if (phone.length === 10 && /^\d{10}$/.test(phone)) {
        phone = extractPhone(phone, /(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (phone.length === 11 && /^\d{11}$/.test(phone) && phone.startsWith('1')) {
        phone = extractPhone(phone, /(\d{1})(\d{3})(\d{3})(\d{4})/, '$1-$2-$3-$4');
    } else {
        // log.debug(`applyPhoneRegex() Input value is not valid phone number: "${phone}", returning empty string.`);
        return '';
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

/**
 * 
 * @param phone `string` - the phone number to extract from
 * @param re {@link RegExp} - the regex to use to extract the phone number
 * @param groupFormat `string` - the format to use to extract the phone number
 * - `optional` - if not provided, the phone number is returned as is 
 * @returns `phone`: `string` - the extracted phone number
 */
export function extractPhone(
    phone: string, 
    re: RegExp, 
    groupFormat?: string
): string {
    if (!phone) return '';
    let result: string = '';
    const match = phone.match(PHONE_REGEX);
    if (match) {
        result = match[0];
    }
    if (groupFormat) {
        result = result.replace(re, groupFormat);
    }
    return result;
}

/**
 * Checks if a string ends with any of the specified suffixes.
 * @param s The string to check.
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
    // log.debug(
    //     `\nregex: ${regex}`,
    //     `\nregex.test("${s}"): ${regex.test(s)}`
    // )
    return regex.test(s);
}


/**
 * 
 * @param str The string to check.
 * @param prefixes possible starting string(s).
 * @param flags Optional regex flags to use when creating the RegExp object. see {@link RegExpFlagsEnum}
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
            'Expected string, array of strings, or RegExp, but received:', typeof prefixes, 
            'prefixes', prefixes);
        return false; // Invalid prefixes type
    }
    return regex.test(str);
}

/**
 * 
 * @param str The string to check.
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
            'Expected string, array of strings, or RegExp, but received:', 
            typeof substrings, substrings);
        return false; // Invalid substrings type
    }
    return regex.test(str);
}