/**
 * @file src/parses/vcontact/contactParseEvaluatorFunctions.ts
 */
import { 
    FieldValue,
} from "../../utils/api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { isNullLike, BOOLEAN_TRUE_VALUES, RADIO_FIELD_TRUE, RADIO_FIELD_FALSE } from "../../utils/typeValidation";
import { stringEndsWithAnyOf, COMPANY_KEYWORDS_PATTERN, 
    extractPhone, stripCharFromString, 
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, cleanString, extractName, formatPhone,
    extractEmail, EMAIL_REGEX, ValueMapping, isValueMappingEntry, RegExpFlagsEnum, 
    stringStartsWithAnyOf} from "../../utils/io";
import { READLINE as rl } from "src/config/env";
import { HUMAN_VENDORS_ORIGINAL_TEXT,  } from '../../config/constants'
import { RecordTypeEnum, 
    CountryAbbreviationEnum as COUNTRIES, 
    StateAbbreviationEnum as STATES, 
    TermBase as Term, VendorCategoryEnum 
} from "../../utils/NS";
import { entityId, isPerson } from "../evaluatorFunctions";

export const HUMAN_VENDORS_TRIMMED = HUMAN_VENDORS_ORIGINAL_TEXT.map(
    (name) => cleanString(name, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION));



export const contactCompany = (
    row: Record<string, any>,
    entityIdColumn: string,
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn] || isPerson(row, entityIdColumn)) {
        return '';
    }
    return entityId(row, entityIdColumn);
}