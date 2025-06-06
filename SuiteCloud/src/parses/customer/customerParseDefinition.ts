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
    SearchOperatorEnum,
    idPropertyEnum,
    idSearchOptions,
    idSearchParseOptions,
} from "../../utils/api/types";
import { mainLogger as log } from "src/config/setupLog";
import { CustomerStatusEnum, CustomerTaxItemEnum } from "../../utils/api/types";
import { 
    SB_TERM_DICTIONARY as TERM_DICT, 
    CUSTOMER_CATEGORY_MAPPING as CATEGORY_DICT, 
    ColumnSliceOptions 
} from "src/utils/io";
import { CustomerColumnEnum as C } from "./customerParseConstants";
import * as evaluate from "../evaluatorFunctions";
import * as prune from "../pruneFunctions";
import * as customerEval from "./customerParseEvaluatorFunctions";
import * as contactEval from "../contact/contactParseEvaluatorFunctions";

/** use to set the field `"isinactive"` to false */
const NOT_INACTIVE = false;
export const BILLING_PHONE_COLUMNS = [
    'Bill to 4', 'Bill to 5', C.PHONE, C.WORK_PHONE, C.MOBILE_PHONE, 
    C.ALT_PHONE, C.ALT_MOBILE, C.HOME_PHONE,
];
export const SHIPPING_PHONE_COLUMNS = [
    'Ship to 4', 'Ship to 5', C.PHONE, C.WORK_PHONE, C.MOBILE_PHONE, 
    C.ALT_PHONE, C.ALT_MOBILE, C.HOME_PHONE,
];
/**if `'First Name'` and `Columns.LAST_NAME` not filled, 
 * then look for name to extract from these columns */
export const NAME_COLUMNS = [
    C.PRIMARY_CONTACT, C.SECONDARY_CONTACT, C.ENTITY_ID, 
    'Street1', 'Street2', 'Ship To Street1', 'Ship To Street2', 
    'Bill to 1', 'Ship to 1', 'Bill to 2', 'Ship to 2',
]

export const BILLING_NAME_COLUMNS = [
    C.BILL_TO_ONE, C.BILL_TO_TWO, 
    C.STREET_ONE, C.STREET_TWO, 
    C.PRIMARY_CONTACT, C.SECONDARY_CONTACT, C.ENTITY_ID
]

export const SHIPPING_NAME_COLUMNS = [
    C.SHIP_TO_ONE, C.SHIP_TO_TWO, 
    C.SHIP_TO_STREET_ONE, C.SHIP_TO_STREET_TWO,
    C.PRIMARY_CONTACT, C.SECONDARY_CONTACT, C.ENTITY_ID
];

/** 
 * args for the evaluatorFunction {@link evaluate.attention}: 
 * - `streetLineOneColumn`, `entityIdColumn`, `salutationColumn`, `...nameColumns` 
 * */
const BILLING_ATTENTION_ARGS = [
    C.STREET_ONE, C.ENTITY_ID, C.SALUTATION,
    ...BILLING_NAME_COLUMNS
];

/** 
 * args for the evaluatorFunction {@link evaluate.attention}: 
 * - `streetLineOneColumn`, `entityIdColumn`, `salutationColumn`, `...nameColumns` 
 * */
const SHIPPING_ATTENTION_ARGS = [
    C.SHIP_TO_STREET_ONE, C.ENTITY_ID, C.SALUTATION,
    ...SHIPPING_NAME_COLUMNS
];

/** 
 * args for the evaluatorFunction {@link evaluate.street}: 
 * - `streetLineOneColumn`, `streetLineTwoColumn`, `entityIdColumn`, 
 * `salutationColumn`, `...nameColumns` 
 * */
const BILLING_STREET_ARGS = [
    C.STREET_ONE, C.STREET_TWO, C.ENTITY_ID, C.SALUTATION, 
    ...BILLING_NAME_COLUMNS
];

/** 
 * args for the evaluatorFunction {@link evaluate.street}: 
 * - `streetLineOneColumn`, `streetLineTwoColumn`, `entityIdColumn`, 
 * `salutationColumn`, `...nameColumns` 
 * */
const SHIPPING_STREET_ARGS = [
    C.SHIP_TO_STREET_ONE, C.SHIP_TO_STREET_TWO, C.ENTITY_ID, C.SALUTATION, 
    ...SHIPPING_NAME_COLUMNS
];

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
                        { fieldId: 'country', evaluator: evaluate.country, args: [C.COUNTRY, C.STATE] },
                        { fieldId: 'addressee', evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
                        { fieldId: 'attention', evaluator: evaluate.attention, args: BILLING_ATTENTION_ARGS },
                        { fieldId: 'addr1', evaluator: evaluate.street, args: [1, ...BILLING_STREET_ARGS] },
                        { fieldId: 'addr2', evaluator: evaluate.street, args: [2, ...BILLING_STREET_ARGS] },
                        { fieldId: 'city', colName: C.CITY },
                        { fieldId: 'state', evaluator: evaluate.state, args: [C.STATE]},
                        { fieldId: 'zip', colName: C.ZIP },
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
                        { fieldId: 'country', evaluator: evaluate.country, args: [C.SHIP_TO_COUNTRY, C.SHIP_TO_STATE]},
                        { fieldId: 'addressee', evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
                        { fieldId: 'attention', evaluator: evaluate.attention, args: SHIPPING_ATTENTION_ARGS },
                        { fieldId: 'addr1', evaluator: evaluate.street, args: [1, ...SHIPPING_STREET_ARGS] },
                        { fieldId: 'addr2', evaluator: evaluate.street, args: [2, ...SHIPPING_STREET_ARGS] },
                        { fieldId: 'city', colName: C.SHIP_TO_CITY },
                        { fieldId: 'state', evaluator: evaluate.state, args: [C.SHIP_TO_STATE]},
                        { fieldId: 'zip', colName: C.SHIP_TO_ZIP },
                        { fieldId: 'addrphone', evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueMapping[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordMapping,
        ] as SublistSubrecordMapping[],
    } as SublistFieldDictionaryParseOptions,
};
export const ID_PARSE_OPTIONS: idSearchParseOptions[] = [
    {
        idProp: idPropertyEnum.ENTITY_ID, 
        searchOperator: SearchOperatorEnum.TEXT.IS, 
        idValueMapping: { fieldId: 'entityid', evaluator: evaluate.entityId, args: [C.ENTITY_ID] }
    }
]
export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldValueMapping[] = [
    { fieldId: 'entityid', evaluator: evaluate.entityId, args: [C.ENTITY_ID] },
    { fieldId: 'isinactive', defaultValue: NOT_INACTIVE },
    { fieldId: 'email', evaluator: evaluate.email, args: [C.EMAIL, C.ALT_EMAIL] },
    { fieldId: 'altemail', 
        evaluator: evaluate.email, 
        args: [{colName: C.EMAIL, minIndex: 1}, C.ALT_EMAIL, C.CC_EMAIL] as Array<string | ColumnSliceOptions>
    },
    { fieldId: 'phone', evaluator: evaluate.phone, args: [C.PHONE, C.ALT_PHONE, C.WORK_PHONE] },
    { fieldId: 'mobilephone', 
        evaluator: evaluate.phone, 
        args: [C.MOBILE_PHONE, C.ALT_MOBILE,{colName: C.PHONE, minIndex: 2}] as Array<string | ColumnSliceOptions> 
    },
    { fieldId: 'homephone', 
        evaluator: evaluate.phone, 
        args: [C.HOME_PHONE, {colName: C.PHONE, minIndex: 3}] as Array<string | ColumnSliceOptions> 
    },
    { fieldId: 'fax', evaluator: evaluate.phone, args: [C.FAX, C.ALT_FAX] },
    { fieldId: 'salutation', evaluator: 
        evaluate.salutation, 
        args: [C.SALUTATION, ...BILLING_NAME_COLUMNS] },
    { fieldId: 'title', colName: C.TITLE},
    { fieldId: 'comments', colName: C.COMMENTS },
]

/**
 * @deprecated
 * @note
 * Not able to read/write to this sublist because it's a "static sublist"
 * "error.SuiteScriptError", "name": "SSS_INVALID_SUBLIST_OPERATION", 
 * "message": 
 * "You have attempted an invalid sublist or line item operation. 
 *  You are either trying to access a field on a non-existent line or 
 *  you are trying to add or remove lines from a static sublist..."
* {@link https://stoic.software/articles/types-of-sublists/#:~:text=Lastly%2C%20the-,Static%20List,-sublists%20are%20read} 
* */
export const CONTACT_ROLES_SUBLIST_DEFAULT_OPTIONS: SublistDictionaryParseOptions = {
    contactroles: {
        fieldValueMapArray: [
            { sublistId: 'contactroles', line: 0, fieldId: 'role', defaultValue: ContactRoleEnum.PRIMARY_CONTACT }
        ]
    } as SublistFieldDictionaryParseOptions
}


export const PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CUSTOMER,

    fieldDictParseOptions: {
        fieldValueMapArray: [
            { fieldId: 'isperson', evaluator: customerEval.customerIsPerson, args: [C.ENTITY_ID] },
            ...CONTACT_CUSTOMER_SHARED_FIELDS,
            { fieldId: 'externalid', evaluator: evaluate.externalId, args: [RecordTypeEnum.CUSTOMER, C.ENTITY_ID] },
            { fieldId: 'altphone', evaluator: 
                evaluate.phone, 
                args: [{colName: C.PHONE, minIndex: 1}, C.ALT_PHONE, C.WORK_PHONE] as Array<string | ColumnSliceOptions> 
            },
            { fieldId: 'entitystatus', evaluator: customerEval.customerStatus, args: [C.CATEGORY] },
            { fieldId: 'category', evaluator: customerEval.customerCategory, args: [C.CATEGORY, CATEGORY_DICT] },
            { fieldId: 'companyname', evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
            { fieldId: 'firstname', evaluator: customerEval.firstNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.FIRST_NAME, ...NAME_COLUMNS] },
            { fieldId: 'middlename', evaluator: customerEval.middleNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.MIDDLE_NAME, ...NAME_COLUMNS] },
            { fieldId: 'lastname', evaluator: customerEval.lastNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.LAST_NAME, ...NAME_COLUMNS] },
            { fieldId: 'accountnumber', colName: C.ACCOUNT_NUMBER },
            { fieldId: 'terms', evaluator: evaluate.terms, args: [C.TERMS, TERM_DICT] },
            { fieldId: 'taxable', defaultValue: true },
            { fieldId: 'taxitem', defaultValue: CustomerTaxItemEnum.YOUR_TAX_ITEM },
            { fieldId: 'url', evaluator: evaluate.website, args: [C.WEBSITE, C.EMAIL] },
        ] as FieldValueMapping[],
        subrecordMapArray: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: {
        ...ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
        // ...CONTACT_ROLES_SUBLIST_DEFAULT_OPTIONS
    },
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.entity,
};

/**
 * @TODO - don't parse addresses twice, 
 * instead copy the addressbook from the customer parse results.
 * */
export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fieldDictParseOptions: {
        fieldValueMapArray: [
            ...CONTACT_CUSTOMER_SHARED_FIELDS,
            { fieldId: 'externalid', evaluator: evaluate.externalId, args: [RecordTypeEnum.CONTACT, C.ENTITY_ID] },
            { fieldId: 'officephone', evaluator: evaluate.phone, args: [C.WORK_PHONE] },
            { fieldId: 'firstname', evaluator: evaluate.firstName, args: [C.FIRST_NAME, ...NAME_COLUMNS] },
            { fieldId: 'middlename', evaluator: evaluate.middleName, args: [C.MIDDLE_NAME, ...NAME_COLUMNS] },
            { fieldId: 'lastname', evaluator: evaluate.lastName, args: [C.LAST_NAME, ...NAME_COLUMNS] },
            { fieldId: 'company', evaluator: contactEval.contactCompany, args: [C.ENTITY_ID] },
            { fieldId: 'contactrole', defaultValue: ContactRoleEnum.PRIMARY_CONTACT },
        ] as FieldValueMapping[],
    } as FieldDictionaryParseOptions,
    sublistDictParseOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.contact,
}


