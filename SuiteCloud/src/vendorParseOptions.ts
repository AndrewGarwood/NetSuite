/**
 * @file src/vendorParseOptions.ts
 * @description Define {@link ParseOptions} specifying how CSV row values should be parsed into NetSuite record fields to feed into {@link parseCsvToCreateOptions}.
 * - e.g. for the vendor.csv file, I want to create two records from each row, each of which potentially have two subrecords (their addresses).
 * see {@link PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS} and {@link PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS}
 */
import { 
    FieldValue,

    ParseOptions,
    FieldDictionaryParseOptions, 
    FieldParentTypeEnum, 
    FieldSubrecordMapping, 
    FieldValueMapping, 
    SublistDictionaryParseOptions, 
    SublistFieldDictionaryParseOptions, 
    SublistFieldValueMapping, 
    SublistSubrecordMapping 
} from "./types/api";
import { parseCsvToCreateOptions } from './parseCsvToRequestBody'
import { ValueMapping, isValueMappingEntry } from "./types/io";
import { stripChar, printConsoleGroup as print, stringEndsWithAnyOf } from "./utils/io";
import { READLINE as rl } from "src/config/env";
import { HUMAN_VENDORS_ORIGINAL_TEXT,  } from './config/constants'
import { TERM_VALUE_MAPPING } from "./utils/io/mappings";
import { RecordTypeEnum, CountryAbbreviationEnum as COUNTRIES, StateAbbreviationEnum as STATES, CountryAbbreviationEnum, StateAbbreviationEnum } from "./types/NS";
import { COMPANY_KEYWORDS_PATTERN } from "./utils/io/regex";

const VENDOR_VALUE_OVERRIDES: ValueMapping = {
    'VENDOR_NAME_WITH_SPELLING_ERROR_THAT_THEY_NEVER_FIXED': 'VENDOR_NAME_CORRECTED' as FieldValue  
}
// see if there exist ways to redundancy in rowEvaluator functions... 
// also maybe move all the evaluator functions to their own file

const HUMAN_VENDORS_TRIMMED = HUMAN_VENDORS_ORIGINAL_TEXT.map((name) => cleanString(name));
function cleanString(s: string, toUpper: boolean = false, toLower: boolean = false): string {
    if (!s) return '';
    s = s.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim();
    if (!s.endsWith('Ph.D.') && !stringEndsWithAnyOf(s, COMPANY_KEYWORDS_PATTERN)) {
        s = stripChar(s, '.', true).trim();
    }
    s = toUpper ? s.toUpperCase() : toLower ? s.toLowerCase() : s;
    return s;
}

function checkForOverride(initialValue: string, valueOverrides: ValueMapping): FieldValue {
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

const evaluateVendorIsPerson = (row: Record<string, any>): boolean => {
    let vendor = checkForOverride(cleanString(row['Vendor']), VENDOR_VALUE_OVERRIDES) as string;
    if (HUMAN_VENDORS_TRIMMED.includes(vendor)) {
        print({label: `evaluateVendorIsPerson: ${vendor} -> true`, printToConsole: false, enableOverwrite: false});
        return true; // vendor is a person
    }
    print({label: `evaluateVendorIsPerson: ${vendor} -> false`, printToConsole: false, enableOverwrite: false});
    return false; // return false as default (not a person, so a company)
}

const evaluateVendorCompanyName = (row: Record<string, any>): string => {
    if (!evaluateVendorIsPerson(row)) {
        return checkForOverride(cleanString(row['Vendor']), VENDOR_VALUE_OVERRIDES) as string;
    } else {
        return '';
    }
}

const evaluateVendorFirstName = (row: Record<string, any>): string => {
    if (evaluateVendorIsPerson(row)) {
        return cleanString(row['First Name']);
    } else {
        return '';
    }
}

const evaluateVendorMiddleName = (row: Record<string, any>): string => {
    if (evaluateVendorIsPerson(row)) {
        return cleanString(row['M.I.']);
    } else {
        return '';
    }
}

const evaluateVendorLastName = (row: Record<string, any>): string => {
    if (evaluateVendorIsPerson(row)) {
        return cleanString(row['Last Name']);
    } else {
        return '';
    }
}

const evaluateVendorSalutation = (row: Record<string, any>): string => {
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

const evaluateVendorTerms = (row: Record<string, any>): string => {
    let termsRowValue = String(row['Terms']).trim();
    if (termsRowValue && Object.keys(TERM_VALUE_MAPPING).includes(termsRowValue)) {
        return TERM_VALUE_MAPPING[termsRowValue as keyof typeof TERM_VALUE_MAPPING] as string;
    } else if (termsRowValue && Object.values(TERM_VALUE_MAPPING).includes(termsRowValue as string)) {
        return termsRowValue;
    } else {
        console.log(`Invalid terms: ${termsRowValue}`);
        return '';
    }
}
const evaluateVendorAttention = (row: Record<string, any>): string => {
    let attn: string = '';
    if (row['First Name']) {
        attn += `${row['First Name']}`;
    }
    if (row['M.I.']) {
        attn += ` ${row['M.I.']}`;
    }
    if (row['Last Name']) {
        attn += ` ${row['Last Name']}`;
    }
    attn = attn === '' && row['Primary Contact'] ? row['Primary Contact'] : attn;
    return attn.trim();
}

const evaluateVendorBillingCountry = (row: Record<string, any>): string => {
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

const evaluateVendorBillingState = (row: Record<string, any>): string => {
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

const evaluateVendorShippingState = (row: Record<string, any>): string => {
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


const evaluateVendorShippingCountry = (row: Record<string, any>): string => {
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

export const ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS: SublistDictionaryParseOptions = {
    addressbook: {
        fieldValueMapArray: [
            { sublistId: 'addressbook', line: 0, fieldId: 'label', defaultValue: 'Billing Address - Primary' },
            { sublistId: 'addressbook', line: 1, fieldId: 'label', defaultValue: 'Shipping Address - Primary' },
        ] as SublistFieldValueMapping[],
        subrecordMapArray: [
            {
                parentSublistId: 'addressbook',
                line: 0,
                fieldId: 'addressbookaddress',
                subrecordType: 'address',
                fieldDictParseOptions: {
                    fieldValueMapArray: [
                        { fieldId: 'country', rowEvaluator: evaluateVendorBillingCountry },
                        { fieldId: 'addressee', colName: 'Vendor'},
                        { fieldId: 'attention', rowEvaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Bill from Street 1' },
                        { fieldId: 'addr2', colName: 'Bill from Street 2' },
                        { fieldId: 'city', colName: 'Bill from City' },
                        { fieldId: 'state', rowEvaluator: evaluateVendorBillingState },
                        { fieldId: 'zip', colName: 'Bill from Zip' },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
            {
                parentSublistId: 'addressbook',
                line: 1,
                fieldId: 'addressbookaddress',
                subrecordType: 'address',
                fieldDictParseOptions: {
                    fieldValueMapArray: [
                        { fieldId: 'country', rowEvaluator: evaluateVendorShippingCountry },
                        { fieldId: 'addressee', colName: 'Vendor'},
                        { fieldId: 'attention', rowEvaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Ship from Street1' },
                        { fieldId: 'addr2', colName: 'Ship from Street2' },
                        { fieldId: 'city', colName: 'Ship from City' },
                        { fieldId: 'state', rowEvaluator: evaluateVendorShippingState },
                        { fieldId: 'zip', colName: 'Ship from Zip' },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};
const CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY: FieldValueMapping[] = [
    { fieldId: 'entityid', colName: 'Vendor' },
    { fieldId: 'email', colName: 'Main Email' },
    { fieldId: 'altemail', colName: 'CC Email' },
    { fieldId: 'phone', colName: 'Main Phone' },
    { fieldId: 'mobilephone', colName: 'Mobile' },
    { fieldId: 'homephone', colName: 'Work Phone' },
    { fieldId: 'fax', colName: 'Fax' },
    { fieldId: 'salutation', rowEvaluator: evaluateVendorSalutation },
    { fieldId: 'title', colName: 'Job Title' },
    { fieldId: 'comments', colName: 'Notes' },
]

export const PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.VENDOR,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            { fieldId: 'isperson', rowEvaluator: evaluateVendorIsPerson },
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'companyname', rowEvaluator: evaluateVendorCompanyName },
            { fieldId: 'firstname', rowEvaluator: evaluateVendorFirstName },
            { fieldId: 'middlename', rowEvaluator: evaluateVendorMiddleName },
            { fieldId: 'lastname', rowEvaluator: evaluateVendorLastName },
            { fieldId: 'printoncheckas', colName: 'Print on Check as' },
            { fieldId: 'accountnumber', colName: 'Account No.' },
            { fieldId: 'taxidnum', colName: 'Tax ID' },
            { fieldId: 'terms', rowEvaluator: evaluateVendorTerms},
            { fieldId: 'is1099eligible', colName: 'Eligible for 1099' },
        ] as FieldValueMapping[],
        subrecordMapArray: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES
};

export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'officephone', colName: 'Work Phone' },
            { fieldId: 'firstname', colName: 'First Name' },
            { fieldId: 'middlename', colName: 'M.I.' },
            { fieldId: 'lastname', colName: 'Last Name' },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES
}