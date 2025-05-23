/**
 * @file src/parses/vendor/vendorParseOptions.ts
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
} from "../../utils/api/types";
import { printConsoleGroup as print } from "../../utils/io";
import { READLINE as rl } from "src/config/env";
import { ContactRoleEnum, RecordTypeEnum } from "../../utils/NS";
import { SB_TERM_DICTIONARY } from "../../utils/io/mappings";
import { 
    evaluatePhone, evaluateEntityId, evaluateEmail, evaluateVendorCategory,
    evaluateAlternateEmail, evaluateContactCompany,
    evaluateContactFirstName, evaluateContactLastName, evaluateContactMiddleName, 
    evaluateVendorAttention, evaluateVendorBillingCountry, 
    evaluateVendorBillingState, evaluateVendorIsPerson, 
    evaluateVendorSalutation, evaluateVendorFirstName, evaluateVendorLastName, evaluateVendorMiddleName,
    evaluateVendorShippingCountry, evaluateVendorShippingState, evaluateVendorTerms, 
    VENDOR_VALUE_OVERRIDES
} from "./vendorParseEvaluatorFunctions";
import { pruneContact, pruneVendor } from "./vendorParsePruneFunctions";


/** NOT_INACTIVE = `false` -> `active` === `true` -> NetSuite's `isinactive` = `false` */
export const NOT_INACTIVE = false;
export const BILLING_PHONE_COLUMNS = [
    'Bill from 4', 'Bill from 5', 'Main Phone', 'Work Phone', 'Mobile', 
    'Alt. Phone', 'Ship from 4', 'Ship from 5', 
];
export const SHIPPING_PHONE_COLUMNS = [
    'Ship from 4', 'Ship from 5', 'Main Phone', 'Work Phone', 'Mobile', 
    'Alt. Phone', 'Bill from 4', 'Bill from 5', 
];
export const NAME_COLUMNS = [
    'Primary Contact', 'Print on Check as', 'Vendor', 
    'Bill from 1', 'Ship from 1', 'Bill from 2', 'Ship from 2',
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
                        { fieldId: 'country', evaluator: evaluateVendorBillingCountry },
                        { fieldId: 'addressee', evaluator: evaluateEntityId },
                        { fieldId: 'attention', evaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Bill from Street 1' },
                        { fieldId: 'addr2', colName: 'Bill from Street 2' },
                        { fieldId: 'city', colName: 'Bill from City' },
                        { fieldId: 'state', evaluator: evaluateVendorBillingState },
                        { fieldId: 'zip', colName: 'Bill from Zip' },
                        { fieldId: 'addrphone', evaluator: evaluatePhone, args: BILLING_PHONE_COLUMNS },
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
                        { fieldId: 'country', evaluator: evaluateVendorShippingCountry },
                        { fieldId: 'addressee', evaluator: evaluateEntityId },
                        { fieldId: 'attention', evaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Ship from Street1' },
                        { fieldId: 'addr2', colName: 'Ship from Street2' },
                        { fieldId: 'city', colName: 'Ship from City' },
                        { fieldId: 'state', evaluator: evaluateVendorShippingState },
                        { fieldId: 'zip', colName: 'Ship from Zip' },
                        { fieldId: 'addrphone', evaluator: evaluatePhone, args: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};


export const CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY: FieldValueMapping[] = [
    { fieldId: 'entityid', evaluator: evaluateEntityId },
    { fieldId: 'externalid', evaluator: evaluateEntityId },
    { fieldId: 'isinactive', defaultValue: NOT_INACTIVE },
    { fieldId: 'email', evaluator: evaluateEmail, args: ['Main Email'] },
    { fieldId: 'altemail', evaluator: evaluateAlternateEmail },
    { fieldId: 'phone', evaluator: evaluatePhone, args: ['Main Phone'] },
    { fieldId: 'mobilephone', evaluator: evaluatePhone, args: ['Mobile'] },
    { fieldId: 'homephone', evaluator: evaluatePhone, args: ['Home Phone'] },
    { fieldId: 'fax', evaluator: evaluatePhone, args: ['Fax'] },
    { fieldId: 'salutation', evaluator: evaluateVendorSalutation },
    { fieldId: 'title', colName: 'Job Title' },
    { fieldId: 'comments', colName: 'Note' },
]

export const PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.VENDOR,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            { fieldId: 'isperson', evaluator: evaluateVendorIsPerson },
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'category', evaluator: evaluateVendorCategory },  
            { fieldId: 'companyname', evaluator: evaluateEntityId },
            { fieldId: 'firstname', evaluator: evaluateVendorFirstName, args: NAME_COLUMNS },
            { fieldId: 'middlename', evaluator: evaluateVendorMiddleName, args: NAME_COLUMNS },
            { fieldId: 'lastname', evaluator: evaluateVendorLastName, args: NAME_COLUMNS },
            { fieldId: 'printoncheckas', colName: 'Print on Check as' },
            { fieldId: 'accountnumber', colName: 'Account No.' },
            { fieldId: 'taxidnum', colName: 'Tax ID' },
            { fieldId: 'terms', evaluator: evaluateVendorTerms, args: [SB_TERM_DICTIONARY] },
            { fieldId: 'is1099eligible', colName: 'Eligible for 1099' },
        ] as FieldValueMapping[],
        subrecordMapArray: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES,
    // pruneFunc: pruneVendor,
};

export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'officephone', evaluator: evaluatePhone, args: ['Work Phone'] },
            { fieldId: 'firstname', evaluator: evaluateContactFirstName, args: NAME_COLUMNS },
            { fieldId: 'middlename', evaluator: evaluateContactMiddleName, args: NAME_COLUMNS },
            { fieldId: 'lastname', evaluator: evaluateContactLastName, args: NAME_COLUMNS },
            { fieldId: 'company', evaluator: evaluateContactCompany },
            { fieldId: 'contactrole', defaultValue: ContactRoleEnum.PRIMARY_CONTACT },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES,
    // pruneFunc: pruneContact,
}


