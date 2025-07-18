/**
 * @file src/parses/contact/contactEvaluatorFunctions.ts
 */
import { mainLogger as log } from '../../config/setupLog';
import { 
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, clean, extractName, formatPhone,
} from "../../utils/io/regex/index";
import { HUMAN_VENDOR_LIST as HUMAN_VENDORS_ORIGINAL_TEXT } from '../vendor/vendorConstants';
import { RecordTypeEnum, 
    CountryAbbreviationEnum as COUNTRIES, 
    StateAbbreviationEnum as STATES, 
    TermBase as Term, VendorCategoryEnum 
} from "../../utils/ns";
import { entityId, isPerson } from "../evaluatorFunctions";

/**
 * @deprecated
 * @param row 
 * @param entityIdColumn 
 * @returns 
 */
export const contactCompany = (
    row: Record<string, any>,
    entityIdColumn: string,
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn] || isPerson(row, entityIdColumn)) {
        return '';
    }
    return entityId(row, entityIdColumn);
}