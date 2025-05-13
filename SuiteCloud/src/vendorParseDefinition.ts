/**
 * @file src/vendorParseOptions.ts
 * @description Define {@link ParseOptions} specifying how CSV row values should be parsed into NetSuite record fields to feed into {@link parseCsvToCreateOptions}.
 * - e.g. for the vendor.csv file, I want to create two records from each row, each of which potentially have two subrecords (their addresses).
 * see {@link PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS} and {@link PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS}
 */
import { 
    ParseOptions,
    FieldDictionaryParseOptions, 
    FieldParentTypeEnum, 
    FieldSubrecordMapping, 
    FieldValueMapping, 
    SublistDictionaryParseOptions, 
    SublistFieldDictionaryParseOptions, 
    SublistFieldValueMapping, 
    SublistSubrecordMapping,
} from "./utils/api/types";
import { printConsoleGroup as print } from "./utils/io";
import { READLINE as rl } from "src/config/env";
import { RecordTypeEnum } from "./utils/api/types/NS";
import { SB_TERM_DICTIONARY } from "./utils/io/mappings";
import { 
    evaluatePhone, evaluateEntityId, evaluateEmail, evaluateVendorCategory,
    evaluateAlternateEmail, evaluateCompanyName, evaluateContactCompany,
    evaluateContactFirstName, evaluateContactLastName, evaluateContactMiddleName, 
    evaluateVendorAttention, evaluateVendorBillingCountry, 
    evaluateVendorBillingState, evaluateVendorIsPerson, 
    evaluateVendorSalutation, 
    evaluateVendorShippingCountry, evaluateVendorShippingState, evaluateVendorTerms, 
    VENDOR_VALUE_OVERRIDES
} from "./vendorParseEvaluatorFunctions";
import { pruneContact, pruneVendor } from "./vendorParsePruneFunctions";


/** NOT_INACTIVE = `false` -> `active` === `true` -> NetSuite's `isinactive` = `false` */
export const NOT_INACTIVE = false;
export const BILLING_PHONE_COLUMNS = [
    'Bill from 4', 'Bill from 5', 'Main Phone', 'Work Phone', 'Mobile', 'Alt. Phone', 'Ship from 4', 'Ship from 5', 
];
export const SHIPPING_PHONE_COLUMNS = [
    'Ship from 4', 'Ship from 5', 'Main Phone', 'Work Phone', 'Mobile', 'Alt. Phone', 'Bill from 4', 'Bill from 5', 
];
export const NAME_COLUMNS = [
    'Primary Contact', 'Vendor', 'Bill from 1', 'Ship from 1', 'Bill from 2', 'Ship from 2',
]

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
                        { fieldId: 'addressee', rowEvaluator: evaluateEntityId },
                        { fieldId: 'attention', rowEvaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Bill from Street 1' },
                        { fieldId: 'addr2', colName: 'Bill from Street 2' },
                        { fieldId: 'city', colName: 'Bill from City' },
                        { fieldId: 'state', rowEvaluator: evaluateVendorBillingState },
                        { fieldId: 'zip', colName: 'Bill from Zip' },
                        { fieldId: 'addrphone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: BILLING_PHONE_COLUMNS },
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
                        { fieldId: 'addressee', rowEvaluator: evaluateEntityId },
                        { fieldId: 'attention', rowEvaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Ship from Street1' },
                        { fieldId: 'addr2', colName: 'Ship from Street2' },
                        { fieldId: 'city', colName: 'Ship from City' },
                        { fieldId: 'state', rowEvaluator: evaluateVendorShippingState },
                        { fieldId: 'zip', colName: 'Ship from Zip' },
                        { fieldId: 'addrphone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};


export const CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY: FieldValueMapping[] = [
    { fieldId: 'entityid', rowEvaluator: evaluateEntityId },
    { fieldId: 'isinactive', defaultValue: NOT_INACTIVE },
    { fieldId: 'email', rowEvaluator: evaluateEmail, rowEvaluatorArgs: ['Main Email'] },
    { fieldId: 'altemail', rowEvaluator: evaluateAlternateEmail },
    { fieldId: 'phone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: ['Main Phone'] },
    { fieldId: 'mobilephone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: ['Mobile'] },
    { fieldId: 'homephone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: ['Home Phone'] },
    { fieldId: 'fax', rowEvaluator: evaluatePhone, rowEvaluatorArgs: ['Fax'] },
    { fieldId: 'salutation', rowEvaluator: evaluateVendorSalutation },
    { fieldId: 'title', colName: 'Job Title' },
    { fieldId: 'comments', colName: 'Note' },
]

export const PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.VENDOR,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            { fieldId: 'isperson', rowEvaluator: evaluateVendorIsPerson },
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'category', rowEvaluator: evaluateVendorCategory },  
            { fieldId: 'companyname', rowEvaluator: evaluateEntityId },
            { fieldId: 'firstname', rowEvaluator: evaluateContactFirstName, rowEvaluatorArgs: NAME_COLUMNS },
            { fieldId: 'middlename', rowEvaluator: evaluateContactMiddleName, rowEvaluatorArgs: NAME_COLUMNS },
            { fieldId: 'lastname', rowEvaluator: evaluateContactLastName, rowEvaluatorArgs: NAME_COLUMNS },
            { fieldId: 'printoncheckas', colName: 'Print on Check as' },
            { fieldId: 'accountnumber', colName: 'Account No.' },
            { fieldId: 'taxidnum', colName: 'Tax ID' },
            { fieldId: 'terms', rowEvaluator: evaluateVendorTerms, rowEvaluatorArgs: SB_TERM_DICTIONARY },
            { fieldId: 'is1099eligible', colName: 'Eligible for 1099' },
        ] as FieldValueMapping[],
        subrecordMapArray: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES,
    pruneFunc: pruneVendor,
};

export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'officephone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: ['Work Phone'] },
            { fieldId: 'firstname', rowEvaluator: evaluateContactFirstName, rowEvaluatorArgs: NAME_COLUMNS },
            { fieldId: 'middlename', rowEvaluator: evaluateContactMiddleName, rowEvaluatorArgs: NAME_COLUMNS },
            { fieldId: 'lastname', rowEvaluator: evaluateContactLastName, rowEvaluatorArgs: NAME_COLUMNS },
            { fieldId: 'company', rowEvaluator: evaluateEntityId },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES,
    pruneFunc: pruneContact,
}


