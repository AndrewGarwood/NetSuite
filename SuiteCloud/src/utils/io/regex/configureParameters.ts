/**
 * @file src/utils/io/regex/configureParameters.ts
 */
import { DATA_DIR, validatePath, DEBUG_LOGS as DEBUG, 
    parseLogger as log, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    STOP_RUNNING
} from '../../../config';
import { readJsonFileAsObject as read } from '../reading';
import { StringCaseOptions, StringPadOptions, StringStripOptions, StringReplaceParams, 
    StringReplaceOptions, CleanStringOptions } from ".";
import { hasKeys, isNonEmptyArray, isCleanStringOptions } from '../../typeValidation';
import { distance as levenshteinDistance } from 'fastest-levenshtein';
import path from 'path';
const filePath = path.join(DATA_DIR, '.constants', 'regex_constants.json');
validatePath(filePath);
const REGEX_CONSTANTS = read(filePath) as Record<string, any>;
if (!REGEX_CONSTANTS 
    || !hasKeys(REGEX_CONSTANTS, ['COMPANY_KEYWORD_LIST', 'JOB_TITLE_SUFFIX_LIST'])
) {
    throw new Error(`[regex.ts] Invalid REGEX_CONSTANTS file at '${filePath}'.`
        +`Expected json object to have 'COMPANY_KEYWORD_LIST' key.`
    );
}
export const COMPANY_KEYWORD_LIST: string[] = REGEX_CONSTANTS.COMPANY_KEYWORD_LIST || [];
export const JOB_TITLE_SUFFIX_LIST: string[] = REGEX_CONSTANTS.JOB_TITLE_SUFFIX_LIST || [];
if (!isNonEmptyArray(COMPANY_KEYWORD_LIST)) {
    throw new Error(`[regex.ts] Invalid COMPANY_KEYWORD_LIST in REGEX_CONSTANTS file at '${filePath}'.`);
}
if (!isNonEmptyArray(JOB_TITLE_SUFFIX_LIST)) {
    throw new Error(`[regex.ts] Invalid JOB_TITLE_SUFFIX_LIST in REGEX_CONSTANTS file at '${filePath}'.`);
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

/** strip leading `.` and (trailing `.` if satisfy stripRightCondition: {@link doesNotEndWithKnownAbbreviation}) */
export { STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION } from "./entity";

/** always strip leading and trailing `.` from a `string` */
export const UNCONDITIONAL_STRIP_DOT_OPTIONS: StringStripOptions = {
    char: '.',
    escape: true,
    stripLeftCondition: undefined,
    leftArgs: undefined,
    stripRightCondition: undefined,
    rightArgs: undefined
}


/**
 * add space around hyphen if it already has one on a single side, 
 */
export const ENSURE_SPACE_AROUND_HYPHEN: StringReplaceParams = { searchValue: /( -(\S)|(\S)- )/g, replaceValue: ' - ' };
/**
 * replace em hyphen with a regular hyphen
 */
export const REPLACE_EM_HYPHEN: StringReplaceParams = { searchValue: /—/g, replaceValue: '-' }