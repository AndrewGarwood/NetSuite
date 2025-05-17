/**
 * @file src/utils/parses/customer/customerParseDefinition.ts
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
} from "../../api/types";
// import * as parseMap from "src/utils/api/types/CsvToApiMapping" 
import { mainLogger as log } from "src/config/setupLog";
import { CustomerStatusEnum } from "../../api/types";
//customer_subset.tsv header row:
// Source Name	Name Address	Name Street1	Name Street2	Name City	Name State	Name Zip	Name Contact	Name Phone #	Name Fax #	Name E-Mail	Name Account #	Ship To City	Ship To Address 1	Ship To Address 2	Ship To State	Ship Zip

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
                        // { fieldId: 'country', rowEvaluator: evaluateVendorBillingCountry },
                        // { fieldId: 'addressee', rowEvaluator: evaluateEntityId },
                        // { fieldId: 'attention', rowEvaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Bill from Street 1' },
                        { fieldId: 'addr2', colName: 'Bill from Street 2' },
                        { fieldId: 'city', colName: 'Bill from City' },
                        // { fieldId: 'state', rowEvaluator: evaluateVendorBillingState },
                        { fieldId: 'zip', colName: 'Bill from Zip' },
                        // { fieldId: 'addrphone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: BILLING_PHONE_COLUMNS },
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
                        // { fieldId: 'country', rowEvaluator: evaluateVendorShippingCountry },
                        // { fieldId: 'addressee', rowEvaluator: evaluateEntityId },
                        // { fieldId: 'attention', rowEvaluator: evaluateVendorAttention},
                        { fieldId: 'addr1', colName: 'Ship from Street1' },
                        { fieldId: 'addr2', colName: 'Ship from Street2' },
                        { fieldId: 'city', colName: 'Ship from City' },
                        // { fieldId: 'state', rowEvaluator: evaluateVendorShippingState },
                        { fieldId: 'zip', colName: 'Ship from Zip' },
                        // { fieldId: 'addrphone', rowEvaluator: evaluatePhone, rowEvaluatorArgs: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};