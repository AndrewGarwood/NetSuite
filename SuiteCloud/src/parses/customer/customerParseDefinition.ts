/**
 * @file src/parses/customer/customerParseDefinition.ts
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
    ContactRoleEnum,
} from "../../utils/api/types";
import { mainLogger as log } from "src/config/setupLog";
import { CustomerStatusEnum, CustomerTaxItemEnum } from "../../utils/api/types";
import { SB_TERM_DICTIONARY as TERM_DICT, CUSTOMER_CATEGORY_MAPPING as CATEGORY_DICT, ColumnSliceOptions } from "src/utils/io";
import * as evaluate from "../evaluatorFunctions";
import * as prune from "../pruneFunctions";
import * as customerEval from "./customerParseEvaluatorFunctions";
import * as contactEval from "../contact/contactParseEvaluatorFunctions";

const NOT_INACTIVE = false;
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
    'Street1', 'Street2', 'Ship To Street1', 'Ship To Street2', 
    'Bill to 1', 'Ship to 1', 'Bill to 2', 'Ship to 2',
]


export const ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS: SublistDictionaryParseOptions = {
    addressbook: {
        fieldValueMapArray: [
            { sublistId: 'addressbook', line: 0, fieldId: 'label', defaultValue: 'Billing Address - Primary' },
            { sublistId: 'addressbook', line: 1, fieldId: 'label', defaultValue: 'Shipping Address - Primary' },
            { sublistId: 'addressbook', line: 1, fieldId: 'defaultshipping', defaultValue: true },
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
                                'Customer', 'Mr./Ms./...', 
                                ['Primary Contact', 'Bill to 1', 'Bill to 2', 'Street1', 'Street2', 'Secondary Contact']
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
                        { fieldId: 'country', evaluator: evaluate.country, args: ['Ship To Country', 'Ship To State']},
                        { fieldId: 'addressee', evaluator: evaluate.entityId, args: ['Customer'] },
                        { fieldId: 'attention', 
                            evaluator: evaluate.attention, 
                            args: [
                                'Customer', 'Mr./Ms./...',
                                ['Primary Contact', 'Ship to 1', 'Ship to 2', 'Ship To Street1', 'Ship To Street2', 'Secondary Contact']
                            ] 
                        },
                        { fieldId: 'addr1', colName: 'Ship To Street1' },
                        { fieldId: 'addr2', colName: 'Ship To Street2' },
                        { fieldId: 'city', colName: 'Ship To City' },
                        { fieldId: 'state', evaluator: evaluate.state, args: ['Ship To State']},
                        { fieldId: 'zip', colName: 'Ship To Zip' },
                        { fieldId: 'addrphone', evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};

export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldValueMapping[] = [
    { fieldId: 'entityid', evaluator: evaluate.entityId, args: ['Customer'] },
    { fieldId: 'isinactive', defaultValue: NOT_INACTIVE },
    { fieldId: 'email', evaluator: evaluate.email, args: ['Main Email', 'Alt. Email 1'] },
    { fieldId: 'altemail', evaluator: evaluate.email, args: [{colName: 'Main Email', minIndex: 1}, 'Alt. Email 1', 'CC Email'] as Array<string | ColumnSliceOptions>},
    { fieldId: 'phone', evaluator: evaluate.phone, args: ['Main Phone', 'Alt. Phone', 'Work Phone'] },
    { fieldId: 'mobilephone', evaluator: evaluate.phone, args: ['Mobile', 'Alt. Mobile',{colName: 'Main Phone', minIndex: 2}] as Array<string | ColumnSliceOptions> },
    { fieldId: 'homephone', evaluator: evaluate.phone, args: ['Home Phone', {colName: 'Main Phone', minIndex: 3}] as Array<string | ColumnSliceOptions> },
    { fieldId: 'fax', evaluator: evaluate.phone, args: ['Fax', 'Alt. Fax'] },
    { fieldId: 'salutation', evaluator: evaluate.salutation, args: ['Mr./Ms./...', 'First Name', 'Primary Contact', 'Secondary Contact', 'Customer'] },
    { fieldId: 'title', colName: 'Job Title' },
    { fieldId: 'comments', colName: 'Note' },
]


export const CONTACT_ROLES_SUBLIST_DEFAULT_OPTIONS: SublistDictionaryParseOptions = {
    contactroles: {
        fieldValueMapArray: [
            {sublistId: 'contactroles', line: 0, fieldId: 'role', defaultValue: ContactRoleEnum.PRIMARY_CONTACT }
        ]
    } as SublistFieldDictionaryParseOptions
}


export const PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CUSTOMER,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            { fieldId: 'isperson', evaluator: customerEval.customerIsPerson, args: ['Customer'] },
            ...CONTACT_CUSTOMER_SHARED_FIELDS,
            { fieldId: 'externalid', evaluator: evaluate.externalId, args: [RecordTypeEnum.CUSTOMER, 'Customer'] },
            { fieldId: 'altphone', evaluator: evaluate.phone, args: [{colName: 'Main Phone', minIndex: 1}, 'Alt. Phone', 'Work Phone'] as Array<string | ColumnSliceOptions> },
            { fieldId: 'entitystatus', defaultValue: CustomerStatusEnum.CLOSED_WON },
            { fieldId: 'category', evaluator: customerEval.customerCategory, args: ['Customer Type', CATEGORY_DICT] },
            { fieldId: 'companyname', evaluator: customerEval.customerCompany, args: ['Customer', 'Company'] },
            { fieldId: 'firstname', evaluator: customerEval.firstNameIfCustomerIsPerson, args: ['Customer', 'First Name', ...NAME_COLUMNS] },
            { fieldId: 'middlename', evaluator: customerEval.middleNameIfCustomerIsPerson, args: ['Customer', 'M.I.', ...NAME_COLUMNS] },
            { fieldId: 'lastname', evaluator: customerEval.lastNameIfCustomerIsPerson, args: ['Customer', 'Last Name', ...NAME_COLUMNS] },
            { fieldId: 'accountnumber', colName: 'Account No.' },
            { fieldId: 'terms', evaluator: evaluate.terms, args: ['Terms', TERM_DICT] },
            { fieldId: 'taxable', defaultValue: true },
            { fieldId: 'taxitem', defaultValue: CustomerTaxItemEnum.YOUR_TAX_ITEM },
            { fieldId: 'url', evaluator: evaluate.website, args: ['Website', 'Main Email'] },
        ] as FieldValueMapping[],
        subrecordMapArray: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: {
        ...ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
        ...CONTACT_ROLES_SUBLIST_DEFAULT_OPTIONS
    },
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.entity,
};

export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_CUSTOMER_SHARED_FIELDS,
            { fieldId: 'externalid', evaluator: evaluate.externalId, args: [RecordTypeEnum.CONTACT, 'Customer'] },
            { fieldId: 'officephone', evaluator: evaluate.phone, args: ['Work Phone'] },
            { fieldId: 'firstname', evaluator: evaluate.firstName, args: ['First Name', ...NAME_COLUMNS] },
            { fieldId: 'middlename', evaluator: evaluate.middleName, args: ['M.I.', ...NAME_COLUMNS] },
            { fieldId: 'lastname', evaluator: evaluate.lastName, args: ['Last Name', ...NAME_COLUMNS] },
            { fieldId: 'company', evaluator: contactEval.contactCompany, args: ['Customer'] },
            { fieldId: 'contactrole', defaultValue: ContactRoleEnum.PRIMARY_CONTACT },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.requireNameFields,
}