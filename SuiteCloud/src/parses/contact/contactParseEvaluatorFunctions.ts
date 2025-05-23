/**
 * @file src/utils/parses/vcontact/contactParseEvaluatorFunctions.ts
 */
import { 
    FieldValue,
} from "../../api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { isNullLike, BOOLEAN_TRUE_VALUES, RADIO_FIELD_TRUE, RADIO_FIELD_FALSE } from "../../typeValidation";
import { printConsoleGroup as print, stringEndsWithAnyOf, COMPANY_KEYWORDS_PATTERN, 
    applyPhoneRegex, stripCharFromString, 
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, cleanString, extractName, extractPhone,
    extractEmail, EMAIL_REGEX, ValueMapping, isValueMappingEntry, RegExpFlagsEnum, 
    stringStartsWithAnyOf} from "../../io";
import { READLINE as rl } from "src/config/env";
import { HUMAN_VENDORS_ORIGINAL_TEXT,  } from '../../../config/constants'
import { RecordTypeEnum, 
    CountryAbbreviationEnum as COUNTRIES, 
    StateAbbreviationEnum as STATES, 
    TermBase as Term, VendorCategoryEnum 
} from "../../NS";
import { entityId, isPerson } from "../evaluatorFunctions";
// import { name as evaluateName} from "../generalEvaluatorFunctions";

export const HUMAN_VENDORS_TRIMMED = HUMAN_VENDORS_ORIGINAL_TEXT.map(
    (name) => cleanString(name, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION));



export const evaluateAlternateEmail = (row: Record<string, any>): string => {
    let ccEmail = cleanString(row['CC Email']);
    let invalidEmailPattern = new RegExp(/((\s*;\s*)?[a-zA-Z0-9._%+-]+@benev\.com(\s*;\s*)?)*/, 'ig')
    if (ccEmail && !invalidEmailPattern.test(ccEmail)) {
        // log.debug(`invalidEmailPattern.test("${ccEmail}") = ${invalidEmailPattern.test(ccEmail)}`);
        return extractEmail(ccEmail);
    } else if (ccEmail && invalidEmailPattern.test(ccEmail)) {
        // log.debug(`evaluateAlternateEmail: "${ccEmail}" -> "${ccEmail.replace(invalidEmailPattern, '').replace(/[,;:]*/g, '').trim()}"`);
        return extractEmail(ccEmail.replace(invalidEmailPattern, '').replace(/[-,;:]*/g, '').trim());
    } 
    return '';
}

export const contactCompany = (
    row: Record<string, any>,
    entityIdColumn: string,
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn] || isPerson(row, entityIdColumn)) {
        return '';
    }
    return entityId(row, entityIdColumn);
}