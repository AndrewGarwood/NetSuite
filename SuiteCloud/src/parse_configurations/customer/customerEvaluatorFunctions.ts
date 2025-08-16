/**
 * @file src/parse_configurations/customer/customerEvaluatorFunctions.ts
 */
import {
    FieldValue,
} from "../../api/types";
import { mainLogger as mlog, 
    parseLogger as plog, DEBUG_LOGS as DEBUG, INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL, 
    getCustomerCategoryDictionary,
    getEntityValueOverrides} from "../../config";
import {
    clean,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION,
} from "typeshi/dist/utils/regex";
import { isPerson, firstName, middleName, lastName, entityId } from "../evaluatorFunctions";
import { CustomerColumnEnum as C } from "./customerConstants";
import { checkForOverride, RADIO_FIELD_FALSE, RADIO_FIELD_TRUE } from "../../utils/ns";


export const customerIsPerson = async (
    row: Record<string, any>, 
    entityIdColumn: string,
    companyColumn: string=C.COMPANY
): Promise<string> => {
    plog.info([`customerIsPerson() anyNull check`,
        `  row.keys().length:  ${Object.keys(row).length}`,
        `     entityIdColumn: '${entityIdColumn}'`,
        `      companyColumn: '${companyColumn}'`,
        `row[entityIdColumn]: '${row[entityIdColumn]}'`,
        ` row[companyColumn]: '${row[companyColumn]}'`,
    ].join(TAB))
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return RADIO_FIELD_FALSE;
    }
    return (await isPerson(row, entityIdColumn, companyColumn) 
        ? RADIO_FIELD_TRUE 
        : RADIO_FIELD_FALSE
    );
}

/** 
 * calls {@link firstName}`(row, firstNameColumn, ...nameColumns)` 
 * from `evaluatorFunctions.ts` if customer is an individual human and not a company 
 * */
export const firstNameIfCustomerIsPerson = async (
    row: Record<string, any>,
    entityIdColumn: string,
    firstNameColumn?: string,
    ...nameColumns: string[]
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!await isPerson(row, entityIdColumn)) {
        return '';
    }
    let firstNameValue = firstName(row, firstNameColumn, ...nameColumns);
    return firstNameValue ? firstNameValue : '';
}

export const middleNameIfCustomerIsPerson = async (
    row: Record<string, any>,
    entityIdColumn: string,
    middleNameColumn?: string,
    ...nameColumns: string[]
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!await isPerson(row, entityIdColumn)) {
        return '';
    }
    let middleNameValue = middleName(row, middleNameColumn, ...nameColumns);
    return middleNameValue ? middleNameValue : '';
}

export const lastNameIfCustomerIsPerson = async (
    row: Record<string, any>,
    entityIdColumn: string,
    lastNameColumn?: string,
    ...nameColumns: string[]
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!await isPerson(row, entityIdColumn)) {
        return '';
    }
    let lastNameValue = lastName(row, lastNameColumn, ...nameColumns);
    return lastNameValue ? lastNameValue : '';
}

export const customerCategory = async (
    row: Record<string, any>,
    categoryColumn: string,
): Promise<FieldValue> => {
    if (!row || !categoryColumn) {
        return '';
    }
    const categoryDict = await getCustomerCategoryDictionary()
    let categoryValue = row[categoryColumn] as string;
    if (!categoryValue || !categoryDict[categoryValue]) {
        return '';
    }
    return categoryDict[categoryValue] as FieldValue;
}

/**
 * @deprecated
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

    return '';
}


/**
 * @param row `Record<string, any>`
 * @param entityIdColumn `string`
 * @param companyNameColumn `string`
 * @returns **`companyName`** `string` 
 * - the name of the customer's company, 
 * - or the `entityId` if no company name is provided.
 */
export const customerCompany = async (
    row: Record<string, any>,
    entityIdColumn: string,
    companyNameColumn: string=C.COMPANY,
): Promise<string> => {
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
            await getEntityValueOverrides()
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
