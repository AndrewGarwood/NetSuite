/**
 * @file src/parse_configurations/customer/customerEvaluatorFunctions.ts
 */
import {
    FieldDictionary,
    FieldValue,
    RecordOptions,
} from "../../api/types";
import { 
    mainLogger as mlog, 
    parseLogger as plog, INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL, 
    getCustomerCategoryDictionary,
    getEntityValueOverrides
} from "../../config";
import {
    clean,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION,
} from "typeshi/dist/utils/regex";
import { isPerson, firstName, middleName, lastName, entityId } from "../evaluatorFunctions";
import { CustomerColumnEnum as C } from "./customerConstants";
import { checkForOverride, RADIO_FIELD_FALSE, RADIO_FIELD_TRUE } from "../../utils/ns";
import { isNonEmptyString } from "@typeshi/typeValidation";


export const customerIsPerson = async (
    fields: FieldDictionary,
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
    return (isPerson(fields, row, entityIdColumn, companyColumn) 
        ? RADIO_FIELD_TRUE 
        : RADIO_FIELD_FALSE
    );
}

/** 
 * calls {@link firstName}`(row, firstNameColumn, ...nameColumns)` 
 * from `evaluatorFunctions.ts` if customer is an individual human and not a company 
 * */
export const firstNameIfCustomerIsPerson = async (
    fields: FieldDictionary,
    row: Record<string, any>,
    entityIdColumn: string,
    firstNameColumn?: string,
    ...nameColumns: string[]
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!isPerson(fields, row, entityIdColumn)) {
        return '';
    }
    let firstNameValue = firstName(fields, row, firstNameColumn, ...nameColumns);
    return firstNameValue ? firstNameValue : '';
}

export const middleNameIfCustomerIsPerson = async (
    fields: FieldDictionary,
    row: Record<string, any>,
    entityIdColumn: string,
    middleNameColumn?: string,
    ...nameColumns: string[]
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!isPerson(fields, row, entityIdColumn)) {
        return '';
    }
    let middleNameValue = middleName(fields, row, middleNameColumn, ...nameColumns);
    return middleNameValue ? middleNameValue : '';
}

export const lastNameIfCustomerIsPerson = async (
    fields: FieldDictionary,
    row: Record<string, any>,
    entityIdColumn: string,
    lastNameColumn?: string,
    ...nameColumns: string[]
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    if (!isPerson(fields, row, entityIdColumn)) {
        return '';
    }
    let lastNameValue = lastName(fields, row, lastNameColumn, ...nameColumns);
    return lastNameValue ? lastNameValue : '';
}

export const customerCategory = async (
    fields: FieldDictionary,
    row: Record<string, any>,
    categoryColumn: string,
): Promise<FieldValue> => {
    if (!row || !categoryColumn) {
        return '';
    }
    const categoryDict = getCustomerCategoryDictionary()
    let categoryValue = row[categoryColumn] as string;
    if (!categoryValue || !categoryDict[categoryValue]) {
        return '';
    }
    return categoryDict[categoryValue] as FieldValue;
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
    fields: FieldDictionary,
    row: Record<string, any>,
    entityIdColumn: string,
    companyNameColumn: string=C.COMPANY,
): Promise<string> => {
    if (!row || !entityIdColumn || !row[entityIdColumn]) {
        return '';
    }
    let entity = isNonEmptyString(fields.entityid) ? fields.entityid : entityId(fields, row, entityIdColumn);
    // if (!isPerson(row, entityIdColumn, companyNameColumn)) {
    //     return entity;
    // }
    let companyName = (companyNameColumn 
        ? checkForOverride(
            clean(row[companyNameColumn], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION), 
            companyNameColumn, 
            getEntityValueOverrides()
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
