/**
 * @file src/vendorParseDetails.ts
 */
import { 
    FieldValue,
    FieldDictionary,
    CreateRecordOptions,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SetSubrecordOptions,
    SublistFieldDictionary,
} from "./utils/api/types";
import { isNullLike } from "./utils/typeValidation";
import { ValueMapping, isValueMappingEntry } from "./utils/io/types";
import { printConsoleGroup as print, stringEndsWithAnyOf } from "./utils/io";
import { READLINE as rl } from "src/config/env";
import { HUMAN_VENDORS_ORIGINAL_TEXT,  } from './config/constants'
import { SB_TERM_DICTIONARY } from "./utils/io/mappings";
import { RecordTypeEnum, CountryAbbreviationEnum as COUNTRIES, StateAbbreviationEnum as STATES, CountryAbbreviationEnum, StateAbbreviationEnum } from "./utils/api/types/NS";
import { COMPANY_KEYWORDS_PATTERN, PHONE_REGEX, JAPAN_PHONE_REGEX, KOREA_PHONE_REGEX, applyPhoneRegex, stripChar } from "./utils/io/regex";

export const VENDOR_VALUE_OVERRIDES: ValueMapping = {
    'A Q Skin Solutions, Inc.': 'AQ Skin Solutions, Inc.' as FieldValue  
}

export const HUMAN_VENDORS_TRIMMED = 
    HUMAN_VENDORS_ORIGINAL_TEXT.map((name) => cleanString(name));

export function cleanString(
    s: string, 
    toUpper: boolean=false, 
    toLower: boolean=false
): string {
    if (!s) return '';
    s = s.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim();
    if (!s.endsWith('Ph.D.') && !stringEndsWithAnyOf(s, COMPANY_KEYWORDS_PATTERN)) {
        s = stripChar(s, '.', true).trim();
    }
    s = toUpper ? s.toUpperCase() : toLower ? s.toLowerCase() : s;
    return s;
}

export function checkForOverride(initialValue: string, valueOverrides: ValueMapping): FieldValue {
    print({label: `checkForOverride: ${initialValue}`, details: [
        `is "${initialValue}" a value we want to override? = ${Object.keys(valueOverrides).includes(initialValue)}`
        ], printToConsole: false, enableOverwrite: false
    });
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
 * the `isperson` field in NeSuite is a `radio` field, which only accepts `string` values
 */
export const evaluateVendorIsPerson = (row: Record<string, any>): string => {
    let vendor = checkForOverride(row['Vendor'], VENDOR_VALUE_OVERRIDES) as string;
    if (HUMAN_VENDORS_TRIMMED.includes(vendor)) {
        print({label: `evaluateVendorIsPerson: ${vendor} -> true`, printToConsole: false, enableOverwrite: false});
        return 'T'; // vendor is a person
    }
    print({label: `evaluateVendorIsPerson: ${vendor} -> false`, printToConsole: false, enableOverwrite: false});
    return 'F'; // return false as default (not a person, so a company)
}

/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @note the `isperson` field in NeSuite is a `radio` field, which only accepts `string` values
 */
export const evaluateVendorFirstName = (row: Record<string, any>): string => {
    if (evaluateVendorIsPerson(row) === 'T') { // if vendor is a person, return the first name
        return evaluateContactFirstName(row);
    } else {
        return '';
    }
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @note the `isperson` field in NeSuite is a `radio` field, which only accepts `string` values
 */
export const evaluateVendorMiddleName = (row: Record<string, any>): string => {
    if (evaluateVendorIsPerson(row) === 'T') { // if vendor is a person, return the middle name/initial
        return evaluateContactMiddleName(row);
    } else {
        return '';
    }
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @note the `isperson` field in NeSuite is a `radio` field, which only accepts `string` values
 */
export const evaluateVendorLastName = (row: Record<string, any>): string => {
    if (evaluateVendorIsPerson(row) === 'T') { // if vendor is a person, return the last name
        return evaluateContactLastName(row);
    } else {
        return '';
    }
}

export const evaluateVendorSalutation = (row: Record<string, any>): string => {
    let salutationRowValue = String(row['Mr./Ms./...']);
    let vendorRowValue = String(row['Vendor']).toLowerCase();
    if (salutationRowValue) {
        return salutationRowValue.trim();
    } else if (vendorRowValue.startsWith('dr. ') || vendorRowValue.startsWith('dr ')) {
        return 'Dr.';
    } else {
        print({label: `No salutation available, vendor: ${vendorRowValue}`, printToConsole: false, enableOverwrite: false});
        return '';
    }
}

export const evaluateVendorTerms = (row: Record<string, any>): FieldValue => {
    let termsRowValue = String(row['Terms']).trim();
    if (termsRowValue && Object.keys(SB_TERM_DICTIONARY).includes(termsRowValue)) {
        return SB_TERM_DICTIONARY[termsRowValue].internalid as number;
    } else if (termsRowValue && Object.keys(SB_TERM_DICTIONARY).some((key) => SB_TERM_DICTIONARY[key].name === termsRowValue)) {
        let key = Object.keys(SB_TERM_DICTIONARY)
            .find((key) => SB_TERM_DICTIONARY[key].name === termsRowValue);
        return key ? SB_TERM_DICTIONARY[key].internalid as number: null;
    } else if (!termsRowValue){
        return null;
    }
    console.log(`Invalid terms: "${termsRowValue}"`);
    return null;
}

export const evaluateVendorAttention = (row: Record<string, any>): string => {
    let vendor = checkForOverride(row['Vendor'], VENDOR_VALUE_OVERRIDES) as string;
    let attn: string = '';
    if (row['Mr./Ms./...']) {
        attn += evaluateVendorSalutation(row);
    }
    if (row['First Name']) {
        attn += ` ${evaluateContactFirstName(row)}`;
    }
    if (row['M.I.']) {
        attn += ` ${evaluateContactMiddleName(row)}`;
    }
    if (row['Last Name']) {
        attn += ` ${evaluateContactLastName(row)}`;
    }
    attn = (attn === '' && row['Primary Contact'] ? row['Primary Contact'] : attn).trim();
    return attn === vendor ? '' : attn;
}

export const evaluateVendorBillingCountry = (row: Record<string, any>): string => {
    let billFromCountry: string = String(row['Bill from Country']).trim().toUpperCase();
    let billFromState: string = String(row['Bill from State']).trim().toUpperCase();
    if (Object.keys(COUNTRIES).includes(billFromCountry)) {
        return COUNTRIES[billFromCountry as keyof typeof COUNTRIES];
    } else if (Object.values(COUNTRIES).includes(billFromCountry as CountryAbbreviationEnum)) {
        return billFromCountry;
    } else if (Object.keys(STATES).includes(billFromState) || Object.values(STATES).includes(billFromState as StateAbbreviationEnum)) {
        return COUNTRIES.UNITED_STATES; // Default to United States if state is valid but country is not
    } else {
        print({label: `Invalid Billing country: ${billFromCountry} or state: ${billFromState}`, printToConsole: false, enableOverwrite: false});
        return '';
    }
}

export const evaluateVendorBillingState = (row: Record<string, any>): string => {
    let billFromState: string = String(row['Bill from State']).trim().toUpperCase();
    if (Object.keys(STATES).includes(billFromState)) {
        return STATES[billFromState as keyof typeof STATES];
    } else if (Object.values(STATES).includes(billFromState as StateAbbreviationEnum)) {
        return billFromState;
    } else {
        print({label: `Invalid Billing state: ${billFromState}`, printToConsole: false, enableOverwrite: false});
        return '';
    }
}

export const evaluateVendorShippingState = (row: Record<string, any>): string => {
    let shipFromState: string = String(row['Ship from State']).trim().toUpperCase();
    if (Object.keys(STATES).includes(shipFromState)) {
        return STATES[shipFromState as keyof typeof STATES];
    } else if (Object.values(STATES).includes(shipFromState as StateAbbreviationEnum)) {
        return shipFromState;
    } else {
        print({label: `Invalid Shipping state: ${shipFromState}`, printToConsole: false, enableOverwrite: false});
        return '';
    }
}

export const evaluateVendorShippingCountry = (row: Record<string, any>): string => {
    let shipFromCountry: string = String(row['Ship from Country']).trim().toUpperCase();
    let shipFromState: string = String(row['Ship from State']).trim().toUpperCase();
    if (Object.keys(COUNTRIES).includes(shipFromCountry)) {
        return COUNTRIES[shipFromCountry as keyof typeof COUNTRIES];
    } else if (Object.values(COUNTRIES).includes(shipFromCountry as CountryAbbreviationEnum)) {
        return shipFromCountry;
    } else if (Object.keys(STATES).includes(shipFromState) || Object.values(STATES).includes(shipFromState as StateAbbreviationEnum)) {
        return COUNTRIES.UNITED_STATES; // Default to United States if state is valid but country is not
    } else {
        print({label: `Invalid Shipping country: ${shipFromCountry} or state: ${shipFromState}`, printToConsole: false, enableOverwrite: false});
        return '';
    }
}
/**
 * Check for phone in this column order: 'Bill from 4', 'Bill from 5', 'Main Phone', 'Work Phone', 'Mobile', 'Alt. Phone'
 * @param row - `Record<string, any>` - the row to evaluate
 * @returns `billingPhone` - `string` - the first valid phone number found in the row
 * @see {@link applyPhoneRegex}
 */
export const evaluateBillingPhone = (row: Record<string, any>): string => {
    const billingPhoneColumns = [
        'Bill from 4', 'Bill from 5', 'Main Phone', 'Work Phone', 'Mobile', 'Alt. Phone'
    ];
    let billingPhone: string = '';
    for (const col of billingPhoneColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        billingPhone = applyPhoneRegex(initialVal, row['Vendor']);
    }
    return billingPhone;
}


/**
 * @description Check for phone in this column order: 'Ship from 4', 'Ship from 5', 'Main Phone', 'Work Phone', 'Mobile', 'Alt. Phone'
 * @param row - `Record<string, any>` - the row to evaluate
 * @returns `shippingPhone` - `string` - the first valid phone number found in the row
 * @see {@link applyPhoneRegex} for regex validation
 */
export const evaluateShippingPhone = (row: Record<string, any>): string => {
    const shippingPhoneColumns = [
        'Ship from 4', 'Ship from 5', 'Main Phone', 'Work Phone', 'Mobile', 'Alt. Phone'
    ];
    let shippingPhone: string = '';
    for (const col of shippingPhoneColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        shippingPhone = applyPhoneRegex(initialVal, row['Vendor']);
    }
    return shippingPhone;
}

export const evaluateAlternateEmail = (row: Record<string, any>): string => {
    let ccEmail: string = String(row['CC Email']).trim();
    let invalidEmailPattern = new RegExp(/(\s*;\s*)?[a-zA-Z0-9._%+-]+@benev\.com(\s*;\s*)?/, 'ig')
    if (ccEmail && !invalidEmailPattern.test(ccEmail)) {
        return ccEmail;
    } else if (ccEmail && invalidEmailPattern.test(ccEmail)) {
        print({label: `evaluateAlternateEmail: ${ccEmail} -> ${ccEmail.replace(invalidEmailPattern, '').trim()}`, printToConsole: false, enableOverwrite: false});
        return ccEmail.replace(invalidEmailPattern, '').trim();
    } 
    return '';
}

export const evaluateContactFirstName = (row: Record<string, any>): string => {
    let firstName: string = String(row['First Name']).trim();
    if (firstName) return firstName;
    let primaryContact: string = String(row['Primary Contact']).trim();
    let contactSplit = primaryContact.split(' ');
    if (contactSplit.length > 0) {
        return contactSplit[0].trim();
    }
    return '';
}

export const evaluateContactMiddleName = (row: Record<string, any>): string => {
    let middleInitial: string = String(row['M.I.']).trim();
    if (middleInitial) return middleInitial;
    let primaryContact: string = String(row['Primary Contact']).trim();
    let contactSplit = primaryContact.split(' ');
    if (contactSplit.length > 2) {
        return contactSplit[1].trim();
    }
    return '';
}

export const evaluateContactLastName = (row: Record<string, any>): string => {
    const middleInitialPattern = new RegExp(/^[A-Z]\.$/, 'i');
    let lastName: string = String(row['Last Name']).trim();
    if (lastName) return lastName;
    let primaryContact: string = String(row['Primary Contact']).trim();
    let contactSplit = primaryContact.split(' ');
    if (contactSplit.length === 2) {
        return cleanString(contactSplit[1]);
    } else if (contactSplit.length === 3 && middleInitialPattern.test(contactSplit[1])) {
        // if primary contact has a middle initial, omit it when returning the last name
        return cleanString(contactSplit[2]);
    } else if (contactSplit.length > 3) {
        return cleanString(contactSplit.slice(2).join(' '));
    }
    return '';
}

export const evaluateCompanyName = (row: Record<string, any>): string => {
    let company = row['Company'] ? cleanString(row['Company']) 
        : row['Vendor'] ? cleanString(row['Vendor']) : '';
    company = checkForOverride(company, VENDOR_VALUE_OVERRIDES) as string;
    return company;
}

/** make sure contact has a firstname. then call {@link pruneAddressBookSublistOfRecordOptions} */
export const pruneContact = (
    contactOptions: CreateRecordOptions
): CreateRecordOptions | null => {
    if (isNullLike(contactOptions)) {
        return null;
    }
    const REQUIRED_ADDRESS_FIELDS = ['firstname']
    try {
        let fieldDict = contactOptions.fieldDict as FieldDictionary;
        for (const requiredField of REQUIRED_ADDRESS_FIELDS) {
            if (!fieldDict?.valueFields?.some((field) => field.fieldId === requiredField && !field.value)) {
                print({
                    label: `pruneContact: SetFieldValueOptions is missing field "${requiredField}", returning null`, 
                    printToConsole: false, enableOverwrite: false
                });
                return null;
            }
        }
        contactOptions = pruneAddressBookSublistOfRecordOptions(contactOptions) as CreateRecordOptions;
        return contactOptions;
    } catch (error) {
        console.error(`Error in pruneContact():`, error);
        return contactOptions;
    }
}

export const pruneAddressBookSublistOfRecordOptions = (
    options: CreateRecordOptions
): CreateRecordOptions | null => {
    if (isNullLike(options)) {
        return null;
    }
    const REQUIRED_ADDRESS_FIELDS = ['addr1']
    try {
        let addressbook = options?.sublistDict?.addressbook as SublistFieldDictionary;
        let valueFields = addressbook?.valueFields as SetSublistValueOptions[];
        let subrecordFields = addressbook?.subrecordFields as SetSubrecordOptions[];
        subrecordFields?.forEach((subrecOps, index) => {
            let subrecValueFields = subrecOps?.fieldDict?.valueFields as SetFieldValueOptions[];
            for (const requiredField of REQUIRED_ADDRESS_FIELDS) {
                if (!subrecValueFields?.some((field) => field.fieldId === requiredField)) {
                    print({
                        label: `subrecordFields[${index}]: SetSubrecordOptions is missing address field "${requiredField}", removing it from subrecordFields`, 
                        printToConsole: false, enableOverwrite: false
                    });
                    valueFields?.splice(index, 1);
                    subrecordFields?.splice(index, 1);
                    return options;
                }
                print({
                    label: `All required fields found. Keeping addressbook subrecordFields[${index}]`, 
                    printToConsole: false, enableOverwrite: false
                });
            }
        });
        return options;
    } catch (error) {
        console.error(`Error in pruneAddressBookSublistOfRecordOptions: ${error}`);
    }
    return null;
};