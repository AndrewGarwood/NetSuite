/**
 * @file src/utils/parses/customer/customerParseEvaluatorFunctions.ts
 */
import { 
    CustomerStatusEnum,
    FieldValue,
} from "../../utils/api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { RADIO_FIELD_TRUE, RADIO_FIELD_FALSE } from "../../utils/typeValidation";
import { 
    checkForOverride,
    cleanString,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION,
    ValueMapping, 
} from "../../utils/io";
import { isPerson, firstName, middleName, lastName, entityId, ENTITY_VALUE_OVERRIDES } from "../evaluatorFunctions";


export const customerIsPerson = (row: Record<string, any>, entityIdColumn: string): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return RADIO_FIELD_FALSE;
    }
    return isPerson(row, entityIdColumn) ? RADIO_FIELD_TRUE : RADIO_FIELD_FALSE;
}

/** calls {@link firstName}`(row, firstNameColumn, ...nameColumns)` from `evaluatorFunctions.ts` if customer is an individual human and not a company */
export const firstNameIfCustomerIsPerson = (
    row: Record<string, any>,
    entityIdColumn: string,
    firstNameColumn: string,
    ...nameColumns: string[]
): string => {
    if (!row || !entityIdColumn || !firstNameColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!isPerson(row, entityIdColumn)) {
        return '';
    }
    let firstNameValue = firstName(row, firstNameColumn, ...nameColumns);
    return firstNameValue ? firstNameValue : '';
}

export const middleNameIfCustomerIsPerson = (
    row: Record<string, any>,
    entityIdColumn: string,
    middleNameColumn: string,
    ...nameColumns: string[]
): string => {
    if (!row || !entityIdColumn || !middleNameColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!isPerson(row, entityIdColumn)) {
        return '';
    }
    let middleNameValue = middleName(row, middleNameColumn, ...nameColumns);
    return middleNameValue ? middleNameValue : '';
}

export const lastNameIfCustomerIsPerson = (
    row: Record<string, any>,
    entityIdColumn: string,
    lastNameColumn: string,
    ...nameColumns: string[]
): string => {
    if (!row || !entityIdColumn || !lastNameColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!isPerson(row, entityIdColumn)) {
        return '';
    }
    let lastNameValue = lastName(row, lastNameColumn, ...nameColumns);
    return lastNameValue ? lastNameValue : '';
}

export const customerCategory = (
    row: Record<string, any>,
    categoryColumn: string,
    categoryDict: ValueMapping
): FieldValue => {
    if (!row || !categoryColumn || !categoryDict) {
        return '';
    }
    let categoryValue = row[categoryColumn];
    if (!categoryValue || !categoryDict[categoryValue]) {
        return '';
    }
    return categoryDict[categoryValue] as FieldValue;
}

export const customerStatus = (
    row: Record<string, any>,
    categoryColumn: string,
): FieldValue => {
    if (!row || !categoryColumn) {
        return '';
    }
    let categoryValue = row[categoryColumn];
    if (!categoryValue) {
        return CustomerStatusEnum.QUALIFIED;
    }
    return CustomerStatusEnum.CLOSED_WON;
}


export const customerCompany = (
    row: Record<string, any>,
    entityIdColumn: string,
    companyNameColumn: string,
): string => {
    if (!row || !entityIdColumn || !companyNameColumn || !row[entityIdColumn]) {
        return '';
    }
    let entity = entityId(row, entityIdColumn);
    if (!isPerson(row, entityIdColumn, companyNameColumn)) {
        return entity;
    }
    let companyName = checkForOverride(
        cleanString(row[companyNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION), 
        companyNameColumn, 
        ENTITY_VALUE_OVERRIDES
    ) as string;   
    if (companyName 
        && companyName.toLowerCase().replace(/\W*/g, '') !== entity.toLowerCase().replace(/\W*/g, '')
        //  && COMPANY_KEYWORD_REGEX.test(companyName)
    ) {
        return companyName;
    }
    // log.debug(`Reached End of customerCompany() -> returning entityId: "${entity}"`); 
    return entity;
    
}
