/**
 * @file src/parse_configurations/customer/customerEvaluatorFunctions.ts
 */
import {
    FieldValue,
} from "../../api/types";
import { mainLogger as mlog, parseLogger as plog, DEBUG_LOGS as DEBUG, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config";
import { RADIO_FIELD_TRUE, RADIO_FIELD_FALSE, anyNull } from "../../utils/typeValidation";
import {
    clean,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION,
    equivalentAlphanumericStrings as equivalentAlphanumeric
} from "../../utils/io/regex/index";
import { isPerson, firstName, middleName, lastName, entityId, ENTITY_VALUE_OVERRIDES } from "../evaluatorFunctions";
import { CustomerColumnEnum as C } from "./customerConstants";
import { ValueMapping, checkForOverride } from "src/utils/io";
import { SUPPRESS } from "../evaluators/common";


export const customerIsPerson = (
    row: Record<string, any>, 
    entityIdColumn: string,
    companyColumn: string=C.COMPANY
): string => {
    SUPPRESS.push(NL+`customerIsPerson() anyNull check`,
        TAB+`anyNull(row, entityIdColumn, row[entityIdColumn]) = ${anyNull(row, entityIdColumn, row[entityIdColumn])}`,
        TAB+`  row.keys().length:  ${Object.keys(row).length}`,
        TAB+`     entityIdColumn: '${entityIdColumn}'`,
        TAB+`      companyColumn: '${companyColumn}'`,
        TAB+`row[entityIdColumn]: '${row[entityIdColumn]}'`,
        TAB+` row[companyColumn]: '${row[companyColumn]}'`,
    )
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return RADIO_FIELD_FALSE;
    }
    return (isPerson(row, entityIdColumn, companyColumn) 
        ? RADIO_FIELD_TRUE 
        : RADIO_FIELD_FALSE
    );
}

/** 
 * calls {@link firstName}`(row, firstNameColumn, ...nameColumns)` 
 * from `evaluatorFunctions.ts` if customer is an individual human and not a company 
 * */
export const firstNameIfCustomerIsPerson = (
    row: Record<string, any>,
    entityIdColumn: string,
    firstNameColumn?: string,
    ...nameColumns: string[]
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
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
    middleNameColumn?: string,
    ...nameColumns: string[]
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
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
    lastNameColumn?: string,
    ...nameColumns: string[]
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
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
    let categoryValue = row[categoryColumn] as string;
    if (!categoryValue || !categoryDict[categoryValue]) {
        return '';
    }
    return categoryDict[categoryValue] as FieldValue;
}

/**
 * Error: "You have entered an Invalid Field Value 7 for the following field: entitystatus"
 * -> not possible to set a customer record to qualified; instead make a 'lead' record, 
 * just returning empty string (not setting value) for now. 
 * */
export const customerStatus = (
    row: Record<string, any>,
    categoryColumn: string,
): FieldValue => {
    if (!row || !categoryColumn) {
        return '';
    }
    let categoryValue = row[categoryColumn];
    // not possible to set a customer record to qualified; instead make a 'lead' record.
    // if (!categoryValue) {
    //     return CustomerStatusEnum.QUALIFIED; 
    // }
    return ''; //CustomerStatusEnum.CLOSED_WON;
}


/**
 * @param row `Record<string, any>`
 * @param entityIdColumn `string`
 * @param companyNameColumn `string`
 * @returns **`companyName`** `string` 
 * - the name of the customer's company, 
 * - or the `entityId` if no company name is provided.
 */
export const customerCompany = (
    row: Record<string, any>,
    entityIdColumn: string,
    companyNameColumn: string=C.COMPANY,
): string => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    let entity = entityId(row, entityIdColumn);
    // if (!isPerson(row, entityIdColumn, companyNameColumn)) {
    //     return entity;
    // }
    let companyName = (companyNameColumn 
        ? checkForOverride(
            clean(row[companyNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION), 
            companyNameColumn, 
            ENTITY_VALUE_OVERRIDES
        ) as string
        : ''
    );
    return companyName ? companyName : entity;   
    // if (companyName && equivalentAlphanumeric(companyName, entity)) {
    //     return companyName;
    // }
    // // log.debug(`Reached End of customerCompany() -> returning entityId: "${entity}"`); 
    // return entity;
    
}
