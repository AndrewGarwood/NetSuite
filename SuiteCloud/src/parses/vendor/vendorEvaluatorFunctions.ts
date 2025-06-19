/**
 * @file src/parses/vendor/vendorParseEvaluatorFunctions.ts
 */
import { 
    FieldValue,
} from "../../utils/api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { isNullLike, BOOLEAN_TRUE_VALUES, RADIO_FIELD_TRUE, RADIO_FIELD_FALSE } from "../../utils/typeValidation";
import { printConsoleGroup as print, stringEndsWithAnyOf, COMPANY_KEYWORDS_PATTERN, 
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
} from "../../utils/ns";

export const VENDOR_VALUE_OVERRIDES: ValueMapping = {
    'A Q Skin Solutions, Inc.': 'AQ Skin Solutions, Inc.' as FieldValue  
}

export const HUMAN_VENDORS_TRIMMED = HUMAN_VENDORS_ORIGINAL_TEXT.map(
    (name) => cleanString(name, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION));

/**
 * 
 * @param initialValue - the initial value to check if it should be overwritten
 * @param valueOverrides see {@link ValueMapping}: {@link VENDOR_VALUE_OVERRIDES}
 * @returns 
 */
export function checkForOverride(initialValue: string, valueOverrides: ValueMapping): FieldValue {
    if (!initialValue) {
        return initialValue;
    }   
    // print({label: `checkForOverride: ${initialValue}`, details: [
    //     `is "${initialValue}" a value we want to override? = ${Object.keys(valueOverrides).includes(initialValue)}`
    //     ], printToConsole: false
    // });
    if (Object.keys(valueOverrides).includes(initialValue)) {
        let mappedValue = valueOverrides[initialValue as keyof typeof valueOverrides];
        if (isValueMappingEntry(mappedValue)) {
            return mappedValue.newValue as FieldValue;
        } else {
            return mappedValue as FieldValue;
        }
    }
    return initialValue;
}

/**
 * the `isperson` field in NeSuite is a `radio` field, which only accepts `string` values,
 * so we must `return` a `string` value of either `T` ({@link RADIO_FIELD_TRUE}) or `F` ({@link RADIO_FIELD_FALSE}) instead of a `boolean` value.
 */
export const evaluateVendorIsPerson = (row: Record<string, any>): string => {
    let vendor = checkForOverride(row['Vendor'], VENDOR_VALUE_OVERRIDES) as string;
    if (HUMAN_VENDORS_TRIMMED.includes(vendor)) {
        // print({label: `evaluateVendorIsPerson: ${vendor} -> true`, printToConsole: false});
        return RADIO_FIELD_TRUE; // vendor is a person
    }
    // print({label: `evaluateVendorIsPerson: ${vendor} -> false`, printToConsole: false});
    return RADIO_FIELD_FALSE; // return false as default (not a person, so a company)
}


export const evaluateVendorSalutation = (row: Record<string, any>): string => {
    let salutationRowValue = cleanString(row['Mr./Ms./...']);
    let vendorRowValue = cleanString(row['Vendor'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, { toLower: true});
    if (salutationRowValue) {
        return salutationRowValue.trim();
    } else if (vendorRowValue.startsWith('dr. ') || vendorRowValue.startsWith('dr ')) {
        return 'Dr.';
    } else {
        // print({label: `No salutation available, vendor: ${vendorRowValue}`, printToConsole: false});
        return '';
    }
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @returns the first name of the contact if the vendor is a person, otherwise returns an empty string.
 * @see {@link evaluateVendorIsPerson}
 */
export const evaluateVendorFirstName = (row: Record<string, any>, ...nameColumns: string[]): string => {
    return evaluateVendorIsPerson(row) === RADIO_FIELD_TRUE ? evaluateContactFirstName(row, ...nameColumns) : '';
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @returns the middle name/initial of the contact if the vendor is a person, otherwise returns an empty string.
 * @see {@link evaluateVendorIsPerson}
 */
export const evaluateVendorMiddleName = (row: Record<string, any>, ...nameColumns: string[]): string => {
    return evaluateVendorIsPerson(row) === RADIO_FIELD_TRUE ? evaluateContactMiddleName(row, ...nameColumns) : '';
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @returns the last name of the contact if the vendor is a person, otherwise returns an empty string.
 * @see {@link evaluateVendorIsPerson}
 */
export const evaluateVendorLastName = (row: Record<string, any>, ...nameColumns: string[]): string => {
    return evaluateVendorIsPerson(row) === RADIO_FIELD_TRUE ? evaluateContactLastName(row, ...nameColumns) : '';
}
/**
 * 
 * @param row - the `row` of data to look for a vendor payment terms in
 * @param termArgs `termDict`: `Record<string`, {@link Term}`>` to use for evaluating the vendor payment terms
 * @returns 
 */
export const evaluateVendorTerms = (row: Record<string, any>, ...termArgs: any[]): FieldValue => {
    const termDict = termArgs[0] as Record<string, Term> || null;
    if (!termDict) {
        log.error('evaluateVendorTerms: termDict is undefined. Cannot evaluate terms.');
        return null;
    }
    let termsRowValue = cleanString(row['Terms']);
    if (termsRowValue && Object.keys(termDict).includes(termsRowValue)) {
        return termDict[termsRowValue].internalid as number;
    } else if (termsRowValue && Object.keys(termDict).some((key) => termDict[key].name === termsRowValue)) {
        let key = Object.keys(termDict)
            .find((key) => termDict[key].name === termsRowValue);
        return key ? termDict[key].internalid as number: null;
    } else if (!termsRowValue){
        return null;
    }
    log.warn(`Invalid terms: "${termsRowValue}"`);
    return null;
}

export const evaluateVendorAttention = (row: Record<string, any>): string => {
    let vendor = checkForOverride(row['Vendor'], VENDOR_VALUE_OVERRIDES) as string;
    let attn: string = '';
    attn += evaluateVendorSalutation(row) 
        + ` ${evaluateContactFirstName(row)}`
        + ` ${evaluateContactMiddleName(row)}`
        + ` ${evaluateContactLastName(row)}`;
    attn = cleanString(attn === '' && row['Primary Contact'] ? row['Primary Contact'] : attn);
    return attn === vendor ? '' : attn;
}

export const evaluateVendorBillingCountry = (row: Record<string, any>): string => {
    let billFromCountry = cleanString(row['Bill from Country'], undefined, { toUpper: true});
    let billFromState = cleanString(row['Bill from State'], undefined, { toUpper: true});
    if (Object.keys(COUNTRIES).includes(billFromCountry)) {
        return COUNTRIES[billFromCountry as keyof typeof COUNTRIES];
    } else if (Object.values(COUNTRIES).includes(billFromCountry as COUNTRIES)) {
        return billFromCountry;
    } else if (Object.keys(STATES).includes(billFromState) || Object.values(STATES).includes(billFromState as STATES)) {
        return COUNTRIES.UNITED_STATES; // Default to United States if state is valid but country is not
    } else {
        // log.warn(`Invalid Billing country: "${billFromCountry}" or state: "${billFromState}"`);
        return '';
    }
}

export const evaluateVendorBillingState = (row: Record<string, any>): string => {
    let billFromState = cleanString(row['Bill from State'], undefined, { toUpper: true});
    if (Object.keys(STATES).includes(billFromState)) {
        return STATES[billFromState as keyof typeof STATES];
    } else if (Object.values(STATES).includes(billFromState as STATES)) {
        return billFromState;
    } else {
        // log.warn(`Invalid Billing state: "${billFromState}"`);
        return '';
    }
}

export const evaluateVendorShippingState = (row: Record<string, any>): string => {
    let shipFromState = cleanString(row['Ship from State'], undefined, { toUpper: true});
    if (Object.keys(STATES).includes(shipFromState)) {
        return STATES[shipFromState as keyof typeof STATES];
    } else if (Object.values(STATES).includes(shipFromState as STATES)) {
        return shipFromState;
    } else {
        // log.warn(`Invalid Shipping state: "${shipFromState}"`);
        return '';
    }
}

export const evaluateVendorShippingCountry = (row: Record<string, any>): string => {
    let shipFromCountry = cleanString(row['Ship from Country'], undefined, { toUpper: true});
    let shipFromState = cleanString(row['Ship from State'], undefined, { toUpper: true});
    if (Object.keys(COUNTRIES).includes(shipFromCountry)) {
        return COUNTRIES[shipFromCountry as keyof typeof COUNTRIES];
    } else if (Object.values(COUNTRIES).includes(shipFromCountry as COUNTRIES)) {
        return shipFromCountry;
    } else if (Object.keys(STATES).includes(shipFromState) || Object.values(STATES).includes(shipFromState as STATES)) {
        return COUNTRIES.UNITED_STATES; // Default to United States if state is valid but country is not
    } else {
        // log.warn(`Invalid Shipping country: "${shipFromCountry}" or state: "${shipFromState}"`);
        return '';
    }
}

/** {@link VendorCategoryEnum}, {@link HUMAN_VENDORS_TRIMMED} */
export const evaluateVendorCategory = (row: Record<string, any>): number | string => {
    let vendor = cleanString(row['Vendor'] as string, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    let eligibleFor1099: string = String(row['Eligible for 1099']).trim().toLowerCase();
    if (BOOLEAN_TRUE_VALUES.includes(eligibleFor1099)) {
        return VendorCategoryEnum._1099;
    } else if (!BOOLEAN_TRUE_VALUES.includes(eligibleFor1099) && HUMAN_VENDORS_TRIMMED.includes(vendor)) {
        return VendorCategoryEnum.CONSULTANT;
    }
    return '';
}

/**
 * @deprecated
 * @param row - the `row` of data to look for a phone number in
 * @param phoneColumns the columns of the `row` to look for a phone number in
 * @returns `phone` - `{string}` - the formatted version of the first valid phone number found in the `row`, or an empty string if none is found.
 * @see {@link extractPhone} for the regex used to validate the phone number.
 */
export const evaluatePhone = (
    row: Record<string, any>, 
    ...phoneColumns: string[]
): string => {
    let phone: string = '';
    for (const col of phoneColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        // log.debug(`evaluatePhone: applyPhoneRegex("${initialVal}", vendor="${row['Vendor']}") = "${applyPhoneRegex(initialVal, `vendor="${row['Vendor']}"`)}"`);
        phone = (extractPhone(initialVal) || [''])[0];
        if (phone) { return phone; }// return the first valid phone number found
    }
    // print({label: `evaluatePhone: No valid phone number found in columns: ${phoneColumns.join(', ')}`});
    return ''
}

/**
 * @deprecated
 * @param row 
 * @param emailColumns 
 * @returns 
 */
export const evaluateEmail = (
    row: Record<string, any>, 
    ...emailColumns: string[]
): string => {
    let email: string = '';
    for (const col of emailColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        // log.debug(`evaluateEmail: extractEmail("${initialVal}") = "${extractEmail(initialVal)}"`);
        email = (extractEmail(initialVal) || [''])[0];
        if (email) { return email; }// return the first valid email number found
    }
    // print({label: `evaluateEmail: No valid email number found in columns: ${emailColumns.join(', ')}`});
    return ''
}

/**
 * return the name `{first, middle, last}` corresponding to the first column with a non-empty first and last name
 * @param row 
 * @param nameColumns 
 * @returns 
 */
function evaluateName(
    row: Record<string, any>, 
    ...nameColumns: string[]
): {
    first: string;
    middle: string;
    last: string;
} {
    for (const col of nameColumns) {
        let initialVal = cleanString(row[col], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
        if (!initialVal) {
            continue;
        }
        const {first, middle, last} = extractName(initialVal);
        if (first && last) { 
        // log.debug(`extractName("${initialVal}") from col="${col}"`,
        //     `\n\t-> {first="${first}", middle="${middle}", last="${last}"}`);
            return {first: first, middle: middle || '', last: last}; 
            // 
        }
    }
    return {first: '', middle: '', last: ''};
}



export const evaluateContactFirstName = (
    row: Record<string, any>, 
    ...nameColumns: string[]
): string => {
    let first = cleanString(row['First Name'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    // log.debug(`cleanString(row['First Name']): "${first}"`);
    if (!first || first.split(' ').length > 1) {
        first = evaluateName(row, ...(['First Name'].concat(nameColumns))).first;
    }
    // log.debug(`first after evaluate nameColumns: "${first}"`);
    return first;
}


export const evaluateContactMiddleName = (
    row: Record<string, any>, 
    ...nameColumns: string[]
): string => {
    let middle = cleanString(row['M.I.']);
    if (!middle || middle.split(' ').length > 1) {
        middle = evaluateName(row, ...nameColumns).middle;
    }
    // log.debug(`middle after evaluate nameColumns: "${middle}"`);
    return middle.replace(/^-/, '').replace(/-$/, ''); // remove leading and trailing dashes
}

export const evaluateContactLastName = (
    row: Record<string, any>, 
    ...nameColumns: string[]
): string => {
    let last = cleanString(row['Last Name'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    // log.debug(`cleanString(row['Last Name']): "${last}"`);
    if (!last) {
        last = evaluateName(row, ...nameColumns).last;
    }
    // log.debug(`last after evaluate nameColumns: "${last}"`);
    return last;
}

export const evaluateAlternateEmail = (row: Record<string, any>): string => {
    let ccEmail = cleanString(row['CC Email']);
    let invalidEmailPattern = new RegExp(/(\s*;\s*)?[a-zA-Z0-9._%+-]+@benev\.com(\s*;\s*)?/, 'ig')
    if (ccEmail && !invalidEmailPattern.test(ccEmail)) {
        // log.debug(`invalidEmailPattern.test("${ccEmail}") = ${invalidEmailPattern.test(ccEmail)}`);
        return (extractEmail(ccEmail) || [''])[0];
    } else if (ccEmail && invalidEmailPattern.test(ccEmail)) {
        // log.debug(`evaluateAlternateEmail: "${ccEmail}" -> "${ccEmail.replace(invalidEmailPattern, '').replace(/[,;:]*/g, '').trim()}"`);
        return (extractEmail(ccEmail.replace(invalidEmailPattern, '').replace(/[,;:]*/g, '').trim()) || [''])[0];
    } 
    return '';
}
// @TODO : refactor evaluateCompanyName, evaluateContactCompany, and evaluateEntityId -------------------------------------
export const evaluateCompanyName = (row: Record<string, any>): string => {
    let company = cleanString(row['Company'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    let vendor = cleanString(row['Vendor'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    let printOnCheckAs = cleanString(row['Print on Check As'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    let result: string = vendor;
    if (company !== vendor && printOnCheckAs && company === printOnCheckAs) {
        log.debug(`evaluateCompanyName: `,
            `\n\t       company = "${company}"`, 
            `\n\t        vendor = "${vendor}"`, 
            `\n\tprintOnCheckAs = "${printOnCheckAs}"`);
        result = company;
    } 
    // else if (vendor !== company && printOnCheckAs && vendor === printOnCheckAs) {
    //     result = vendor;
    // } else if (!company && HUMAN_VENDORS_TRIMMED.includes(vendor)) {
    //     return getFullName(row);
    // }
    return checkForOverride(result, VENDOR_VALUE_OVERRIDES) as string;
}
/** If contact's corresponding vendor record has `isperson` == `true`, 
 * then the vendor is not able to be selected as the contact's company */
export const evaluateContactCompany = (row: Record<string, any>): string => {
    let vendor = cleanString(row['Vendor'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    if (HUMAN_VENDORS_TRIMMED.includes(vendor)) {
        return '';
    }
    return evaluateCompanyName(row);
}

/**
 * as of right now, just returns {@link checkForOverride}`(`
 * {@link cleanString}`(row['Vendor'] as string`, {@link STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION}`)`, 
 * {@link VENDOR_VALUE_OVERRIDES}`)` 
 * */
export const evaluateEntityId = (row: Record<string, any>): string => {
    let vendor = cleanString(row['Vendor'], STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
    // if (HUMAN_VENDORS_TRIMMED.includes(vendor)) {
    //     return getFullName(row);
    // }
    // let company = cleanString(row['Company'] as string, conditionalStripDotOptions);
    // let printOnCheckAs = cleanString(row['Print on Check As'] as string, conditionalStripDotOptions);
    return checkForOverride(vendor, VENDOR_VALUE_OVERRIDES) as string;
    
}

/** `fullName = `${salutation} ${firstName} ${middleName} ${lastName}`.trim();` only includes salutation if it's a doctor */
export const getFullName = (row: Record<string, any>): string => {
    let salutation = evaluateVendorSalutation(row) === 'Dr.' ? 'Dr.' : '';
    let firstName = evaluateContactFirstName(row);
    let middleName = evaluateContactMiddleName(row);
    let lastName = evaluateContactLastName(row);
    let fullName = `${salutation} ${firstName} ${middleName} ${lastName}`;
    if (fullName === '') {
        log.debug(`No valid name found in row: ${JSON.stringify(row)}`);
        return '';
    }
    return cleanString(fullName, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION);
}

