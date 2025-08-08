/**
 * @file src/utils/regex/entity.ts
 */
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    DEBUG_LOGS as DEBUG } from "../../config";
import { StringReplaceOptions, StringStripOptions, KOREA_ADDRESS_LATIN_TEXT_PATTERN, StringReplaceParams,  } from ".";
import { RegExpFlagsEnum } from "./types/StringOptions";
import { clean } from "./cleaning";
import { getJobTitleSuffixList, getCompanyKeywordList } from "../../config/dataLoader";
import { stringContainsAnyOf, stringEndsWithAnyOf } from "./stringOperations";
const SUPPRESS: any[] = [];

/** `re` = /`^\s*((attention|attn|atn):)?\s*((Mr|Ms|Mrs|Dr|Prof)\.?)*\s*`/`i` */
export const ATTN_SALUTATION_PREFIX_PATTERN = new RegExp(
    /^\s*((attention|attn|atn):)?\s*((Mr|Ms|Mrs|Dr|Prof)\.?)*\s*/, 
    RegExpFlagsEnum.IGNORE_CASE
);
/** `re` = /`^(Mr\.|Ms\.|Mrs\.|Dr\.|Mx\.)`/`i` */
export const SALUTATION_REGEX = new RegExp(
    /^(Mr\.|Ms\.|Mrs\.|Dr\.|Mx\.|Prof\.)/, 
    RegExpFlagsEnum.IGNORE_CASE
);
/** `re` = /`^[A-Z]{1}\.?$`/i */
export const MIDDLE_INITIAL_REGEX = new RegExp(
    /^[A-Z]{1}\.?$/, 
    RegExpFlagsEnum.IGNORE_CASE
);
/** `re` = `/((([A-Z]\.){1})*|([A-Z]{1,4}(\.|-)?)){asterisk}/` */
export const CREDENTIAL_PATTERN = /((([A-Z]\.){1})*|([A-Z]{1,4}(\.|-)?))*/;

/**
 * `re` = `/^\s*([A-Za-z'-]{2,})\s*,\s*(?:(?:[A-Z]{1,4}\.?\,?\s*)+)?([A-Za-z'-]+(?:\s+[A-Za-z.'-]+)*)\s*$/`
 */
export const LAST_NAME_COMMA_FIRST_NAME_PATTERN = new RegExp(
    /^\s*([A-Za-z'-]{2,})\s*,\s*(?:(?:[A-Z]{1,4}\.?\,?\s*)+)?([A-Za-z'-]+(?:\s+[A-Za-z.'-]+)*)\s*$/,
    RegExpFlagsEnum.IGNORE_CASE
);

export const REMOVE_ATTN_SALUTATION_PREFIX: StringReplaceParams = {
    searchValue: ATTN_SALUTATION_PREFIX_PATTERN, replaceValue: ''
};
/**
 * re = `/(, (` + getJobTitleSuffixList().join('|') + `)\.?,?){asterisk}/g`,
 */
let _jobTitleSuffixPattern: RegExp | null = null;
export function getJobTitleSuffixPattern(): RegExp {
    if (_jobTitleSuffixPattern === null) {
        _jobTitleSuffixPattern = new RegExp(
            `(, (` + getJobTitleSuffixList().join('|') + `)\.?)+`,
            RegExpFlagsEnum.GLOBAL
        );
    }
    return _jobTitleSuffixPattern;
}


/** 
 * `re` = `/((, ?| )(MSPA|APRN|BSN|FNP-C|LME|DDS|DOO|Ph\.?D\.|MSN-RN|R\.?N|N\.?P|CRNA|FAAD|FNP|P.?A.?C|PA-C|PA|DMD|NMD|MD|M\.D|DO|L\.?E\.?|CMA|CANS|O.?M|Frcs|FRCS|FACS|FAC)\.?,?)+/g`  
 * */
export const JOB_TITLE_SUFFIX_PATTERN = new RegExp(
    /((, ?| )(MSPA|APRN|ARNP|BSN|FNP-C|LME|DDS|MD|DO|DOO|Ph\.?D\.|MSN|MSN-RN|R\.?N|N\.?P|CRNA|FAAD|FNP|P.?A.?C|PA-C|PA|DMD|NMD|MD|M\.D|DO|L\.?E\.?|CMA|CANS|O.?M|Frcs|FRCS|FACS|FAC)\.?)+/, 
    RegExpFlagsEnum.GLOBAL
); 

export const REMOVE_JOB_TITLE_SUFFIX: StringReplaceParams = {
    searchValue: JOB_TITLE_SUFFIX_PATTERN, replaceValue: ''
};
// {searchValue: getJobTitleSuffixPattern(), replaceValue: ''}



/**
 * - {@link REMOVE_ATTN_SALUTATION_PREFIX}
 * - {@link REMOVE_JOB_TITLE_SUFFIX}
 * - remove trailing comma
 */
export const CLEAN_NAME_REPLACE_OPTIONS: StringReplaceOptions = [
    REMOVE_ATTN_SALUTATION_PREFIX,
    REMOVE_JOB_TITLE_SUFFIX,
    { searchValue: /,$/g, replaceValue: '' }, // remove trailing comma
]


/**
 * **if** `name` contains a digit or contains any of {@link COMPANY_KEYWORDS_PATTERN} or `/[0-9!#&@]/`, 
 * - `then` do not attempt to extract name and return empty strings
 * @param name `string` - the full name from which to extract 3 parts: the first, middle, and last names
 * @returns `{first: string, middle?: string, last?: string}` - the first, middle, and last names
 * @example
 * let name = 'John Doe';
 * console.log(extractName(name)); // { first: 'John', middle: '', last: 'Doe' }
 * name = 'John A. Doe';
 * console.log(extractName(name)); // { first: 'John', middle: 'A.', last: 'Doe' }
 */
export function extractName(
    name: string,
    includeJobTitleSuffix: boolean = true
): { first: string, middle?: string, last?: string } {
    if (!name || typeof name !== 'string') return { first: '', middle: '', last: '' };
    const originalName = name;
    const jobTitleSuffix = extractJobTitleSuffix(name);
    name = clean(name, {replace: CLEAN_NAME_REPLACE_OPTIONS})
        .replace(JOB_TITLE_SUFFIX_PATTERN, ''); // redundant
    const containsInvalidCharsOrCompanyKeywords = (
        stringContainsAnyOf(name, /[0-9!#&@]/)
        || stringContainsAnyOf(name, COMPANY_KEYWORDS_PATTERN, RegExpFlagsEnum.IGNORE_CASE)
    );
    if (containsInvalidCharsOrCompanyKeywords 
        || KOREA_ADDRESS_LATIN_TEXT_PATTERN.test(name)) {
        return { first: '', middle: '', last: '' };
    }
    SUPPRESS.push(`extractName()`,
        TAB + `  originalName = "${originalName}"`,
        TAB + `  cleaned name = "${name}"`,
        TAB + `jobTitleSuffix = "${jobTitleSuffix}"`
    );
    let nameSplit = name.split(/(?<!,)\s+/);
    if (nameSplit.length === 0) {
        return { first: '', middle: '', last: '' };
    }
    if (LAST_NAME_COMMA_FIRST_NAME_PATTERN.test(originalName)) {
        // move last name to the end
        nameSplit.push(nameSplit.shift() || ''); 
    }
    nameSplit.map((namePart) => clean(namePart, {
        strip: STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, 
        replace: [{searchValue: /(^[-+])*/g, replaceValue: ''}]
    }));
    SUPPRESS.push(NL + `nameSplit.length === ${nameSplit.length},`,
        `nameSplit: ${JSON.stringify(nameSplit)}`
    );
    if (nameSplit.length == 1) {
        return { 
            first: nameSplit[0].replace(/(,|\.)$/g, ''), 
            middle: '', 
            last: '' 
        };
    } 
    const firstName = nameSplit[0].replace(/(,|\.)$/g, '');
    if (nameSplit.length == 2) {
        let initialLastName = nameSplit[1];
        let alreadyHasJobTitleSuffix = (
            stringEndsWithAnyOf(initialLastName, new RegExp(`,? ?${jobTitleSuffix}`))
            || 
            stringEndsWithAnyOf(initialLastName.replace(/\./, ''), new RegExp(`,? ?${jobTitleSuffix}`))
        )
        const lastName = (
            jobTitleSuffix && includeJobTitleSuffix 
            && !alreadyHasJobTitleSuffix
            ? initialLastName.replace(/,$/g, '') + `, ${jobTitleSuffix}`
            : initialLastName.replace(/,$/g, '')
        ).replace(/,\s*$/g, '');
        return { 
            first: firstName, 
            middle: '', 
            last: lastName
        };
    } else if (nameSplit.length > 2) {
        const middleName = nameSplit[1].replace(/,$/g, '');
        let initialLastName = nameSplit.slice(2).join(' ');
        let alreadyHasJobTitleSuffix = (
            stringEndsWithAnyOf(initialLastName, new RegExp(`,? ?${jobTitleSuffix}`))
            || 
            stringEndsWithAnyOf(initialLastName.replace(/\./, ''), new RegExp(`,? ?${jobTitleSuffix}`))
        )
        const lastName = (jobTitleSuffix && includeJobTitleSuffix 
            && !alreadyHasJobTitleSuffix
            ? initialLastName + `, ${jobTitleSuffix}`
            : initialLastName
        ).replace(/,\s*$/g, '');
        return { 
            first: firstName, 
            middle: middleName, 
            last: lastName
                // redundant but trying to make sure the suffix is removed
                // .replace(JOB_TITLE_SUFFIX_PATTERN, '')
                // .replace(getJobTitleSuffixPattern(), '')
                // .replace(/(,|\.)$/g, '') 
        };
    }
    DEBUG.push(NL + `extractName() - no valid name parts found, returning empty strings`);
    return { first: '', middle: '', last: '' }; 
}

/**
 * - {@link JOB_TITLE_SUFFIX_PATTERN}
 * 
 * Cases to consider for input param `s`: (want to extract JOB_TITLE) 
 * - `s` = `"lastName, {JOB_TITLE}"`
 * - `s` = `"firstName lastName, {JOB_TITLE}"`
 * - `s` = `"firstName middleName lastName, {JOB_TITLE}"`
 * - `s` = `"firstName middleInitial lastName, {JOB_TITLE}"`
 * - `s` = `"lastName, {JOB_TITLE}, firstName"` // matches {@link LAST_NAME_COMMA_FIRST_NAME_PATTERN}
 * @param s `string`
 * @returns **`jobTitle`** `string` - the job title, if it exists
 */
export function extractJobTitleSuffix(
    s: string,
): string {
    if (!s || typeof s !== 'string') return '';
    s = clean(s, {replace: [
        REMOVE_ATTN_SALUTATION_PREFIX, 
        { searchValue: /,$/g, replaceValue: '' }
    ]});
    if (JOB_TITLE_SUFFIX_PATTERN.test(s)) {
        SUPPRESS.push(NL + `[regex/entity.extractJobTitleSuffix()]`, TAB + `s = "${s}"`);
        const jobTitleMatch = s.match(JOB_TITLE_SUFFIX_PATTERN);
        if (jobTitleMatch && jobTitleMatch.length > 0) {
            let jobTitle = jobTitleMatch[0].replace(/^\s*,\s*/g, '').trim();
            SUPPRESS.push(TAB + `jobTitleMatch[0] = "${jobTitleMatch[0]}" -> trim and return "${jobTitle}"`);
            return jobTitle;
        }
    }
    return '';
}


/** 
 * - `re` = `/\b(?:company|corp|inc|co\.?,? ltd\.?|ltd|\.?l\.?lc|plc . . .)\b/` `i`
 * */
// export const COMPANY_KEYWORDS_PATTERN = new RegExp(
//     `\\b(?:` + getCompanyKeywordList().join('|') + `)\\b`, RegExpFlagsEnum.IGNORE_CASE
// );
export const COMPANY_KEYWORDS_PATTERN: RegExp = 
/\b(?:compan(y|ies)|[+@&]+|corporation|corporate|(drop)?box|corp|inc|co\.|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|plc|llp|(un)?limited|nys|oc|mc|pr|local|group|consulting|consultant(s)?|vcc|bcp|center|(in)?pack(aging|age)?|electric|chemical|Exhibit(s)?|business|Factory|employee|print(s|ing)?|Pharmaceutical(s)?|vista ?print|associates|association|account(s)?|art(s)?|AMZ|independent|beauty|beautiful(ly)?|meditech|medaesthetic|partners|Acupuncture|Affiliate(s)?|telecom|maps|cosmetic(s)?|connections|practice|computer|service(s)?|skincare|skin|face|facial|body|artisan(s)?|Alchemy|plastic|advanced|surgical|surgery|surgeons|administrators|laser|practice|scientific|science|health|healthcare|medical|med|med( |i)?spa|spa|SpaMedica|perfect|surgeons|(med)?(a)?esthetic(s|a)?|salon|lounge|studio|wellness|courier|capital|financ(e|ing)|collector|dept(\.)?|HVAC|insurance|ins|surety|freight|fine art|solution(s)?|trad(e|ing)|renewal|department|inst\.|institute|instant|university|college|America(n)?|US(A)?|global|digital|virtual|orange|coast(al)?|tree|franchise|orthopedic(s)?|academy|advertising|travel|technologies|flash|international|tech|clinic(s|al)?|Exterminator|Nightclub|management|foundation|aid|product(ions|ion|s)?|industr(y|ies|ial)|biomed|bio|bio-chem|lubian|technology|technical|special(ist(s)?|ities)?|support|innovat(e|ive|ion(s)?)|county|united|state(s)?|the|one|of|for|by|and|on|or|at|it|the|about|plan|legal|valley|republic|recruit(ing)?|media|southern|office|post office|clean(er|ers)|transport|law|contract|high|food|meal|therapy|therapeutic(s)?|dental|laboratory|instrument|southwest|ingredient(s)?|commerce|city|Laboratories|lab|logistics|newport|radio|video|photo(graphy)?|korea|communication(s)|derm(atology|atologist(s)?)|new|express|goods|mission|depot|treasur(e|er|y)|revenue|biolab|Orders|staff(ing|ed)?|investors|envelope|refresh|Anti|AgingMajestic|motors|museum|event|Kaiser|pacific|visa|platinum|level|Rejuvenation|bespoke|Cardio|speed|pro|tax|firm|DC|square|store|weight|group|Buy|balance(d)?|buckhead|market(s)?|Bulk|perks|GPT|Boutique|supplement(s)?|vitamin(s)?|plus|sales|salesforce|precision|fitness|image|premier|Fulfillment|final|elite|elase|sculpt(ing)?|botox|south|Hills|symposium|wifi|online|worldwide|tv|derm([a-z]+)|wine|rent(al(s)?)?|mail|plumber(s)?|Sociedade|card|\.com)\b/i;


export const COMPANY_ABBREVIATION_PATTERN: RegExp =
/\b(?:corp|inc|co\.?,? ltd\.?|ltd|(p\.)?l\.?l\.?c|p\.?c|plc|llp|s\.c)\.?\s*$/i;

/** 
 * @param {string} s - `string` - the string to check
 * @returns `!s.endsWith('Ph.D.') && !`{@link stringEndsWithAnyOf}`(s`, {@link COMPANY_ABBREVIATION_PATTERN} as RegExp, `[`{@link RegExpFlagsEnum.IGNORE_CASE}`]) && !stringEndsWithAnyOf(s, /\b[A-Z]\.?\b/, [RegExpFlagsEnum.IGNORE_CASE]);` */
export function doesNotEndWithKnownAbbreviation(s: string): boolean {
    if (!s) return false;
    s = s.trim();
    /** matches 1 to 2 occurences of a single letter followed by an optional period */
    const initialsPattern = /\b([A-Z]\.?){1}([A-Z]\.?)?\b/;
    return (!s.endsWith('Ph.D.') 
        && !stringEndsWithAnyOf(s, /\b[A-Z]{2}\.?\b/) 
        && !stringEndsWithAnyOf(s, JOB_TITLE_SUFFIX_PATTERN, RegExpFlagsEnum.IGNORE_CASE) 
        && !stringEndsWithAnyOf(s, COMPANY_ABBREVIATION_PATTERN, RegExpFlagsEnum.IGNORE_CASE) 
        && !stringEndsWithAnyOf(s, initialsPattern, RegExpFlagsEnum.IGNORE_CASE)
    );
}

/** strip leading `.` and (trailing `.` if satisfy stripRightCondition: {@link doesNotEndWithKnownAbbreviation}) */
export const STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION: StringStripOptions = {
    char: '.',
    escape: true,
    stripLeftCondition: undefined,
    leftArgs: undefined,
    stripRightCondition: doesNotEndWithKnownAbbreviation,
}