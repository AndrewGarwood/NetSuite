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
import { RecordTypeEnum, CountryAbbreviationEnum as COUNTRIES, StateAbbreviationEnum as STATES, CountryAbbreviationEnum, StateAbbreviationEnum, TermBase as Term } from "./utils/api/types/NS";
import { COMPANY_KEYWORDS_PATTERN, applyPhoneRegex, stripChar } from "./utils/io/regex";

/**
 * Represents the `boolean` value `true` for a radio field in NetSuite.
 */
const RADIO_FIELD_TRUE = 'T';
/**
 * Represents the `boolean` value `false` for a radio field in NetSuite.
 */
const RADIO_FIELD_FALSE = 'F';

export const VENDOR_VALUE_OVERRIDES: ValueMapping = {
    'NAME_WITH_SPELLING_ERROR_THAT_WAS_NEVER_FIXED': 'NAME_WITH_SPELLING_FIXED' as FieldValue  
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
 * the `isperson` field in NeSuite is a `radio` field, which only accepts `string` values,
 * so we must `return` a `string` value of either `T` ({@link RADIO_FIELD_TRUE}) or `F` ({@link RADIO_FIELD_FALSE}) instead of a `boolean` value.
 */
export const evaluateVendorIsPerson = (row: Record<string, any>): string => {
    let vendor = checkForOverride(row['Vendor'], VENDOR_VALUE_OVERRIDES) as string;
    if (HUMAN_VENDORS_TRIMMED.includes(vendor)) {
        print({label: `evaluateVendorIsPerson: ${vendor} -> true`, printToConsole: false, enableOverwrite: false});
        return RADIO_FIELD_TRUE; // vendor is a person
    }
    print({label: `evaluateVendorIsPerson: ${vendor} -> false`, printToConsole: false, enableOverwrite: false});
    return RADIO_FIELD_FALSE; // return false as default (not a person, so a company)
}

/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @returns the first name of the contact if the vendor is a person, otherwise returns an empty string.
 * @see {@link evaluateVendorIsPerson}
 */
export const evaluateVendorFirstName = (row: Record<string, any>): string => {
    return evaluateVendorIsPerson(row) === RADIO_FIELD_TRUE ? evaluateContactFirstName(row) : '';
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @returns the middle name/initial of the contact if the vendor is a person, otherwise returns an empty string.
 * @see {@link evaluateVendorIsPerson}
 */
export const evaluateVendorMiddleName = (row: Record<string, any>): string => {
    return evaluateVendorIsPerson(row) === RADIO_FIELD_TRUE ? evaluateContactMiddleName(row) : '';
}
/**
 * calls {@link evaluateVendorIsPerson} to determine if the vendor is a person or not.
 * @returns the last name of the contact if the vendor is a person, otherwise returns an empty string.
 * @see {@link evaluateVendorIsPerson}
 */
export const evaluateVendorLastName = (row: Record<string, any>): string => {
    return evaluateVendorIsPerson(row) === RADIO_FIELD_TRUE ? evaluateContactLastName(row) : '';
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

export const evaluateVendorTerms = (row: Record<string, any>, ...termArgs: any[]): FieldValue => {
    const termDict = termArgs[0] as Record<string, Term> || null;
    if (!termDict) {
        console.error('evaluateVendorTerms: termDict is undefined. Cannot evaluate terms.');
        return null;
    }
    let termsRowValue = String(row['Terms']).trim();
    if (termsRowValue && Object.keys(termDict).includes(termsRowValue)) {
        return termDict[termsRowValue].internalid as number;
    } else if (termsRowValue && Object.keys(termDict).some((key) => termDict[key].name === termsRowValue)) {
        let key = Object.keys(termDict)
            .find((key) => termDict[key].name === termsRowValue);
        return key ? termDict[key].internalid as number: null;
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
 * 
 * @param row - the `row` of data to look for a phone number in
 * @param phoneColumns the columns of the `row` to look for a phone number in
 * @returns `phone` - `{string}` - the formatted version of the first valid phone number found in the `row`, or an empty string if none is found.
 * @see {@link applyPhoneRegex} for the regex used to validate the phone number.
 */
export const evaluatePhone = (row: Record<string, any>, ...phoneColumns: string[]): string => {
    // console.trace(`evaluatePhone(row, ${phoneColumns})`);
    let phone: string = '';
    for (const col of phoneColumns) {
        let initialVal = cleanString(row[col]);
        if (!initialVal) {
            continue;
        }
        phone = applyPhoneRegex(initialVal, `vendor="${row['Vendor']}"`);
        if (phone) { return phone; }// return the first valid phone number found
    }
    // print({label: `evaluatePhone: No valid phone number found in columns: ${phoneColumns.join(', ')}`});
    return ''
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


// TODO: maybe refactor pruneVendor and pruneContact into a single function that takes a record type and requireFields as arguments

export const pruneVendor = (
    vendorOptions: CreateRecordOptions,
    label?: string
): CreateRecordOptions | null => {
    if (isNullLike(vendorOptions)) {
        console.log(`pruneVendor(${(label || '')}): vendorOptions is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_VENDOR_FIELDS = ['entityid']
    try {
        let fieldDict = vendorOptions.fieldDict as FieldDictionary;
        for (const requiredField of REQUIRED_VENDOR_FIELDS) {
            if (!fieldDict?.valueFields?.some((field) => field.fieldId === requiredField && field.value)) {
                print({
                    label: `pruneVendor(${(label || '')}): SetFieldValueOptions is missing field "${requiredField}", returning null`, 
                    printToConsole: false, enableOverwrite: false
                });
                return null;
            }
        }
        vendorOptions = pruneAddressBook(vendorOptions, `${(label || '')}, pruneVendor calling pruneAddressBook `) as CreateRecordOptions;
        return vendorOptions;
    } catch (error) {
        console.error(`Error in pruneVendor(${(label || '')}):`, error);
        return vendorOptions;
    }
}

/** make sure contact has a firstname and entityid. then call {@link pruneAddressBook} */
export const pruneContact = (
    contactOptions: CreateRecordOptions,
    label?: string
): CreateRecordOptions | null => {
    if (isNullLike(contactOptions)) {
        console.log(`pruneContact(${(label || '')}): contactOptions is null or undefined, returning null`);
        return null;
    }
    const REQUIRED_CONTACT_FIELDS = ['entityid', 'firstname']
    try {
        let fieldDict = contactOptions.fieldDict as FieldDictionary;
        for (const requiredField of REQUIRED_CONTACT_FIELDS) {
            if (!fieldDict?.valueFields?.some((field) => field.fieldId === requiredField && field.value)) {
                print({
                    label: `pruneContact(${(label || '')}): SetFieldValueOptions is missing field "${requiredField}", returning null`, 
                    printToConsole: false, enableOverwrite: false
                });
                return null;
            }
        }
        contactOptions = pruneAddressBook(contactOptions, `${(label || '')}, pruneContact calling pruneAddressBook `) as CreateRecordOptions;
        return contactOptions;
    } catch (error) {
        console.error(`Error in pruneContact(${(label || '')}):`, error);
        return contactOptions;
    }
}

export const pruneAddressBook = (
    options: CreateRecordOptions,
    label?: string
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
                        label: `pruneAddressBook(${(label || '')}):`, details: `subrecordFields[${index}]: SetSubrecordOptions is missing address field "${requiredField}", removing it from subrecordFields`, 
                        printToConsole: false, enableOverwrite: false
                    });
                    valueFields?.splice(index, 1);
                    subrecordFields?.splice(index, 1);
                    return options;
                }
                print({
                    label: `pruneAddressBook(${(label || '')}):`, details: `All required fields found. Keeping addressbook subrecordFields[${index}]`, 
                    printToConsole: false, enableOverwrite: false
                });
            }
        });
        return options;
    } catch (error) {
        console.error(`pruneAddressBook(${(label || '')}): Error in pruneAddressBook: ${error}`);
    }
    return null;
};