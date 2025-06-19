/**
 * @file src/parses/contact/contactEvaluatorFunctions.ts
 */
import { 
    FieldValue,
} from "../../utils/api/types";
import { mainLogger as log } from '../../config/setupLog';
import { 
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, cleanString, extractName, formatPhone,
} from "../../utils/io";
import { HUMAN_VENDORS_ORIGINAL_TEXT,  } from '../../config/constants'
import { RecordTypeEnum, 
    CountryAbbreviationEnum as COUNTRIES, 
    StateAbbreviationEnum as STATES, 
    TermBase as Term, VendorCategoryEnum 
} from "../../utils/ns";
import { entityId, isPerson } from "../evaluatorFunctions";
// import { name as evaluateName} from "../generalEvaluatorFunctions";

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