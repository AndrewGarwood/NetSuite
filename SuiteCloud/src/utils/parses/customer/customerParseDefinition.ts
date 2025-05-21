/**
 * @file src/utils/parses/customer/customerParseDefinition.ts
 */
import { 
    ParseOptions,
    FieldDictionaryParseOptions, 
    FieldValueMapping, 
    SublistDictionaryParseOptions, 
    SublistFieldDictionaryParseOptions, 
    SublistFieldValueMapping, 
    SublistSubrecordMapping,
    RecordTypeEnum,
} from "../../api/types";
import { mainLogger as log } from "src/config/setupLog";
import { CustomerStatusEnum, CustomerTaxItemEnum } from "../../api/types";
import { SB_TERM_DICTIONARY as TERM_DICT, CUSTOMER_CATEGORY_MAPPING as CATEGORY_DICT } from "src/utils/io";
import * as evaluate from "../generalEvaluatorFunctions";
import * as prune from "../generalPruneFunctions";
import * as customEval from "./customerParseEvaluatorFunctions";
import * as contactEval from "../contact/contactParseEvaluatorFunctions";
import { RADIO_FIELD_TRUE } from "src/utils/typeValidation";

export const NOT_INACTIVE = false;
export const BILLING_PHONE_COLUMNS = [
    'Bill to 4', 'Bill to 5', 'Main Phone', 'Work Phone', 'Mobile', 
    'Alt. Phone', 'Alt. Mobile', 'Home Phone',
];
export const SHIPPING_PHONE_COLUMNS = [
    'Ship to 4', 'Ship to 5', 'Main Phone', 'Work Phone', 'Mobile', 
    'Alt. Phone', 'Alt. Mobile', 'Home Phone',
];
/**if `'First Name'` and `'Last Name'` not filled, 
 * then look for name to extract from these columns */
export const NAME_COLUMNS = [
    'Primary Contact', 'Secondary Contact', 'Customer', 
    'Street1', 'Street2', 'Ship to Street1', 'Ship to Street2', 
    'Bill to 1', 'Ship to 1', 'Bill to 2', 'Ship to 2',
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
                        { fieldId: 'country', evaluator: evaluate.country, args: ['Country', 'State']},
                        { fieldId: 'addressee', evaluator: evaluate.entityId, args: ['Customer'] },
                        { fieldId: 'attention', 
                            evaluator: evaluate.attention, 
                            args: [
                                'Customer', 
                                ...['Primary Contact', 'Bill to 1', 'Bill to 2', 'Street1', 'Street2', 'Secondary Contact']
                            ] 
                        },
                        { fieldId: 'addr1', colName: 'Street1' },
                        { fieldId: 'addr2', colName: 'Street2' },
                        { fieldId: 'city', colName: 'City' },
                        { fieldId: 'state', evaluator: evaluate.state, args: ['State']},
                        { fieldId: 'zip', colName: 'Zip' },
                        { fieldId: 'addrphone', evaluator: evaluate.phone, args: BILLING_PHONE_COLUMNS },
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
                        { fieldId: 'country', evaluator: evaluate.country, args: ['Ship to Country', 'Ship to State']},
                        { fieldId: 'addressee', evaluator: evaluate.entityId, args: ['Customer'] },
                        { fieldId: 'attention', 
                            evaluator: evaluate.attention, 
                            args: [
                                'Customer', 
                                ...['Primary Contact', 'Ship to 1', 'Ship to 2', 'Ship to Street1', 'Ship to Street2', 'Secondary Contact']
                            ] 
                        },
                        { fieldId: 'addr1', colName: 'Ship to Street1' },
                        { fieldId: 'addr2', colName: 'Ship to Street2' },
                        { fieldId: 'city', colName: 'Ship to City' },
                        { fieldId: 'state', evaluator: evaluate.state, args: ['Ship to State']},
                        { fieldId: 'zip', colName: 'Ship to Zip' },
                        { fieldId: 'addrphone', evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};

export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldValueMapping[] = [
    { fieldId: 'entityid', evaluator: evaluate.entityId, args: ['Customer'] },
    { fieldId: 'externalid', evaluator: evaluate.entityId, args: ['Customer'] },
    { fieldId: 'isinactive', defaultValue: NOT_INACTIVE },
    { fieldId: 'email', evaluator: evaluate.email, args: ['Main Email', 'Alt. Email 1'] },
    { fieldId: 'altemail', evaluator: evaluate.email, args: ['Alt. Email 1', 'CC Email'] },
    { fieldId: 'phone', evaluator: evaluate.phone, args: ['Main Phone', 'Alt. Phone', 'Work Phone'] },
    { fieldId: 'mobilephone', evaluator: evaluate.phone, args: ['Mobile', 'Alt. Mobile'] },
    { fieldId: 'homephone', evaluator: evaluate.phone, args: ['Home Phone'] },
    { fieldId: 'fax', evaluator: evaluate.phone, args: ['Fax', 'Alt. Fax'] },
    { fieldId: 'salutation', evaluator: evaluate.salutation, args: ['Mr./Ms./...', 'First Name', 'Primary Contact', 'Secondary Contact', 'Customer'] },
    { fieldId: 'title', colName: 'Job Title' },
    { fieldId: 'comments', colName: 'Note' },
]

export const PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CUSTOMER,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            { fieldId: 'isperson', evaluator: customEval.customerIsPerson, args: ['Customer'] },
            ...CONTACT_CUSTOMER_SHARED_FIELDS,
            { fieldId: 'entitystatus', defaultValue: CustomerStatusEnum.CLOSED_WON },
            { fieldId: 'category', evaluator: customEval.customerCategory, args: ['Customer Type', CATEGORY_DICT] },
            { fieldId: 'companyname', evaluator: customEval.customerCompany, args: ['Customer', 'Company'] },
            { fieldId: 'firstname', evaluator: customEval.firstNameIfCustomerIsPerson, args: ['Customer', 'First Name', ...NAME_COLUMNS] },
            { fieldId: 'middlename', evaluator: customEval.middleNameIfCustomerIsPerson, args: ['Customer', 'M.I.', ...NAME_COLUMNS] },
            { fieldId: 'lastname', evaluator: customEval.lastNameIfCustomerIsPerson, args: ['Customer', 'Last Name', ...NAME_COLUMNS] },
            { fieldId: 'accountnumber', colName: 'Account No.' },
            { fieldId: 'terms', evaluator: evaluate.terms, args: ['Terms', TERM_DICT] },
            { fieldId: 'taxable', defaultValue: RADIO_FIELD_TRUE },
            { fieldId: 'taxitem', defaultValue: CustomerTaxItemEnum.YOUR_TAX_ITEM },
            { fieldId: 'url', colName: 'Website'}
        ] as FieldValueMapping[],
        subrecordMapArray: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.entity,
};

export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_CUSTOMER_SHARED_FIELDS,
            { fieldId: 'officephone', evaluator: evaluate.phone, args: ['Work Phone'] },
            { fieldId: 'firstname', evaluator: evaluate.firstName, args: NAME_COLUMNS },
            { fieldId: 'middlename', evaluator: evaluate.middleName, args: NAME_COLUMNS },
            { fieldId: 'lastname', evaluator: evaluate.lastName, args: NAME_COLUMNS },
            { fieldId: 'company', evaluator: contactEval.contactCompany, args: ['Customer'] },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.requireNameFields,
}