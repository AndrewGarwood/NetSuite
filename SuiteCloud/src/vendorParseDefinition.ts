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
import { applyPhoneRegex, stripChar } from "./utils/io/regex";
import { 
    evaluateAlternateEmail, evaluateBillingPhone, evaluateCompanyName, 
    evaluateContactFirstName, evaluateContactLastName, evaluateContactMiddleName, 
    evaluateShippingPhone, evaluateVendorAttention, evaluateVendorBillingCountry, 
    evaluateVendorBillingState, evaluateVendorFirstName, evaluateVendorIsPerson, 
    evaluateVendorLastName, evaluateVendorMiddleName, evaluateVendorSalutation, 
    evaluateVendorShippingCountry, evaluateVendorShippingState, evaluateVendorTerms, 
    VENDOR_VALUE_OVERRIDES, pruneAddressBookSublistOfRecordOptions, pruneContact, 
} from "./vendorParseDetails";


/** NOT_INACTIVE = `false` -> `active` === `true` -> NetSuite's `isinactive` = `false` */
export const NOT_INACTIVE = false;


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
                        { fieldId: 'addrphone', rowEvaluator: evaluateBillingPhone },
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
                        { fieldId: 'addrphone', rowEvaluator: evaluateShippingPhone },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};


export const CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY: FieldValueMapping[] = [
    { fieldId: 'entityid', colName: 'Vendor' },
    { fieldId: 'isinactive', defaultValue: NOT_INACTIVE },
    { fieldId: 'email', colName: 'Main Email' },
    { fieldId: 'altemail', rowEvaluator: evaluateAlternateEmail },
    { fieldId: 'phone', rowEvaluator: (row: Record<string, any>): string => {return applyPhoneRegex(row['Main Phone'])} },
    { fieldId: 'mobilephone', rowEvaluator: (row: Record<string, any>): string => {return applyPhoneRegex(row['Mobile'])} },
    { fieldId: 'homephone', rowEvaluator: (row: Record<string, any>): string => {return applyPhoneRegex(row['Work Phone'])} },
    { fieldId: 'fax', rowEvaluator: (row: Record<string, any>): string => {return applyPhoneRegex(row['Fax'])} },
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
            { fieldId: 'companyname', rowEvaluator: evaluateCompanyName },
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
    valueOverrides: VENDOR_VALUE_OVERRIDES,
    pruneFunc: pruneAddressBookSublistOfRecordOptions,
};

export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_VENDOR_SHARED_FIELD_VALUE_MAP_ARRAY,
            { fieldId: 'officephone', rowEvaluator: (row: Record<string, any>): string => {return applyPhoneRegex(row['Work Phone'])} },
            { fieldId: 'firstname', rowEvaluator: evaluateContactFirstName },
            { fieldId: 'middlename', rowEvaluator: evaluateContactMiddleName },
            { fieldId: 'lastname', rowEvaluator: evaluateContactLastName },
            { fieldId: 'company', rowEvaluator: evaluateCompanyName },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: VENDOR_VALUE_OVERRIDES,
    pruneFunc: pruneContact,
}