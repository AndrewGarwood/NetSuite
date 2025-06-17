/**
 * @deprecated
 * @file src/parses/customer/customerParseDefinition.ts
 */
import { 
    FieldDictionaryParseOptions, 
    SublistDictionaryParseOptions, 
    RecordTypeEnum,
    ContactRoleEnum,
    SearchOperatorEnum,
    idPropertyEnum,
    idSearchOptions,
    idSearchParseOptions,
    CustomerCategoryEnum,
    FieldParseOptions,
} from "../../utils/api/types";
import { CustomerStatusEnum, CustomerTaxItemEnum } from "../../utils/api/types";
import { 
    ColumnSliceOptions, 
} from "../../utils/io";
import { CustomerColumnEnum as C, CUSTOMER_CATEGORY_MAPPING as CATEGORY_DICT } from "./customerParseConstants";
import * as evaluate from "../evaluatorFunctions";
import * as prune from "../pruneFunctions";
import * as customerEval from "./customerParseEvaluatorFunctions";
import * as contactEval from "../contact/contactParseEvaluatorFunctions";

/** use to set the field `"isinactive"` to false */
const NOT_INACTIVE = false;
export const BILLING_PHONE_COLUMNS = [
    C.BILL_TO_FOUR, C.BILL_TO_FIVE, C.PHONE, C.WORK_PHONE, C.MOBILE_PHONE, 
    C.ALT_PHONE, C.ALT_MOBILE, C.HOME_PHONE,
];
export const SHIPPING_PHONE_COLUMNS = [
    C.SHIP_TO_FOUR, C.SHIP_TO_FIVE, C.PHONE, C.WORK_PHONE, C.MOBILE_PHONE, 
    C.ALT_PHONE, C.ALT_MOBILE, C.HOME_PHONE,
];
/**
 * if `'First Name'` and `Columns.LAST_NAME` not filled, 
 * then look for name to extract from these columns
 * */
export const NAME_COLUMNS = [
    C.PRIMARY_CONTACT, C.SECONDARY_CONTACT, C.ENTITY_ID, 
    C.STREET_ONE, C.STREET_TWO, C.SHIP_TO_STREET_ONE, C.SHIP_TO_STREET_TWO,
    C.BILL_TO_ONE, C.SHIP_TO_ONE, C.BILL_TO_TWO,  C.SHIP_TO_TWO,
]
/** Look for {@link evaluate.attention} names in these columns for the billing address */
export const BILLING_NAME_COLUMNS = [
    C.BILL_TO_ONE, C.BILL_TO_TWO, 
    C.STREET_ONE, C.STREET_TWO, 
    C.PRIMARY_CONTACT, C.SECONDARY_CONTACT, C.ENTITY_ID
]

/** Look for {@link evaluate.attention} names in these columns for the shipping address */
export const SHIPPING_NAME_COLUMNS = [
    C.SHIP_TO_ONE, C.SHIP_TO_TWO, 
    C.SHIP_TO_STREET_ONE, C.SHIP_TO_STREET_TWO,
    C.PRIMARY_CONTACT, C.SECONDARY_CONTACT, C.ENTITY_ID
];

/** 
 * `string` args for the evaluatorFunction {@link evaluate.attention}: 
 * - {@link evaluate.AttentionArguments} = `entityIdColumn`, `salutationColumn`, `firstNameColumn`, `middleNameColumn`, `lastNameColumn`, `nameColumns`
 * */
const BILLING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: C.ENTITY_ID, 
    salutationColumn: C.SALUTATION,
    firstNameColumn: C.FIRST_NAME,
    middleNameColumn: C.MIDDLE_NAME,
    lastNameColumn: C.LAST_NAME, 
    nameColumns: BILLING_NAME_COLUMNS
}

/** 
 * `string` args for the evaluatorFunction {@link evaluate.attention}: 
 * - {@link evaluate.AttentionArguments} = `entityIdColumn`, `salutationColumn`, `firstNameColumn`, `middleNameColumn`, `lastNameColumn`, `nameColumns`
 * */
const SHIPPING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: C.ENTITY_ID, 
    salutationColumn: C.SALUTATION,
    firstNameColumn: C.FIRST_NAME,
    middleNameColumn: C.MIDDLE_NAME,
    lastNameColumn: C.LAST_NAME, 
    nameColumns: SHIPPING_NAME_COLUMNS
}

/** 
 * `string` args for the evaluatorFunction {@link evaluate.street}: 
 * - {@link evaluate.StreetArguments} = `streetLineOneColumn`, `streetLineTwoColumn`, `companyNameColumn`, `addresseeFunction` & {@link evaluate.AttentionArguments}
 * - {@link customerEval.customerCompany}
 * - {@link evaluate.AttentionArguments} = `entityIdColumn`, `salutationColumn`, `firstNameColumn`, `middleNameColumn`, `lastNameColumn`, `nameColumns`
 * */
const BILLING_STREET_ARGS: evaluate.StreetArguments = {
    streetLineOneColumn: C.STREET_ONE, 
    streetLineTwoColumn: C.STREET_TWO,
    companyNameColumn: C.COMPANY,
    addresseeFunction: customerEval.customerCompany, 
    ...BILLING_ATTENTION_ARGS
}

/** 
 * `string` args for the evaluatorFunction {@link evaluate.street}
 * - {@link evaluate.StreetArguments} = `streetLineOneColumn`, `streetLineTwoColumn`, `companyNameColumn`, `addresseeFunction` & {@link evaluate.AttentionArguments}
 * - {@link customerEval.customerCompany}
 * - {@link evaluate.AttentionArguments} = `entityIdColumn`, `salutationColumn`, `firstNameColumn`, `middleNameColumn`, `lastNameColumn`, `nameColumns`
 * */
const SHIPPING_STREET_ARGS: evaluate.StreetArguments = {
    streetLineOneColumn: C.SHIP_TO_STREET_ONE,
    streetLineTwoColumn: C.SHIP_TO_STREET_TWO,
    companyNameColumn: C.COMPANY,
    addresseeFunction: customerEval.customerCompany,
    ...SHIPPING_ATTENTION_ARGS
}

export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldDictionaryParseOptions ={
    'entityid': { evaluator: evaluate.entityId, args: [C.ENTITY_ID] },
    'isinactive': { defaultValue: NOT_INACTIVE },
    'email': { evaluator: evaluate.email, args: [C.EMAIL, C.ALT_EMAIL] },
    'altemail': { 
        evaluator: evaluate.email, 
        args: [{colName: C.EMAIL, minIndex: 1}, C.ALT_EMAIL, C.CC_EMAIL] as Array<string | ColumnSliceOptions>
    },
    'phone': { evaluator: evaluate.phone, args: [C.PHONE, C.ALT_PHONE, C.WORK_PHONE] },
    'mobilephone': { 
        evaluator: evaluate.phone, 
        args: [C.MOBILE_PHONE, C.ALT_MOBILE,{colName: C.PHONE, minIndex: 2}] as Array<string | ColumnSliceOptions> 
    },
    'homephone': { 
        evaluator: evaluate.phone, 
        args: [C.HOME_PHONE, {colName: C.PHONE, minIndex: 3}] as Array<string | ColumnSliceOptions> 
    },
    'fax': { evaluator: evaluate.phone, args: [C.FAX, C.ALT_FAX] },
    'salutation': { evaluator: 
        evaluate.salutation, 
        args: [C.SALUTATION, ...BILLING_NAME_COLUMNS] },
    'title': { colName: C.TITLE},
    'comments': { colName: C.COMMENTS },
}


/**
 * @deprecated
 */
export const ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS: SublistDictionaryParseOptions = {
    addressbook: {
        fieldValues: [
            { sublistId: 'addressbook', line: 0, fieldId: 'label', evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
            { sublistId: 'addressbook', line: 1, fieldId: 'label', evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
            { sublistId: 'addressbook', line: 1, fieldId: 'defaultshipping', defaultValue: true },
        ] as SublistFieldValueParseOptions[],
        subrecordValues: [
            {
                sublistId: 'addressbook',
                line: 0,
                fieldId: 'addressbookaddress',
                subrecordType: 'address',
                fieldDictParseOptions: {
                    fieldValues: [
                        { fieldId: 'country', 
                            evaluator: evaluate.country, 
                            args: [C.COUNTRY, C.STATE] 
                        },
                        { fieldId: 'addressee', evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
                        { fieldId: 'attention', evaluator: evaluate.attention, args: [BILLING_ATTENTION_ARGS] },
                        { fieldId: 'addr1', evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
                        { fieldId: 'addr2', evaluator: evaluate.street, args: [2, BILLING_STREET_ARGS] },
                        { fieldId: 'city', colName: C.CITY },
                        { fieldId: 'state', evaluator: evaluate.state, args: [C.STATE]},
                        { fieldId: 'zip', colName: C.ZIP },
                        { fieldId: 'addrphone', evaluator: evaluate.phone, args: BILLING_PHONE_COLUMNS },
                    ] as FieldValueParseOptions[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordParseOptions,
            {
                sublistId: 'addressbook',
                line: 1,
                fieldId: 'addressbookaddress',
                subrecordType: 'address',
                fieldDictParseOptions: {
                    fieldValues: [
                        { fieldId: 'country', evaluator: evaluate.country, args: [C.SHIP_TO_COUNTRY, C.SHIP_TO_STATE]},
                        { fieldId: 'addressee', evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
                        { fieldId: 'attention', evaluator: evaluate.attention, args: [SHIPPING_ATTENTION_ARGS] },
                        { fieldId: 'addr1', evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
                        { fieldId: 'addr2', evaluator: evaluate.street, args: [2, SHIPPING_STREET_ARGS] },
                        { fieldId: 'city', colName: C.SHIP_TO_CITY },
                        { fieldId: 'state', evaluator: evaluate.state, args: [C.SHIP_TO_STATE]},
                        { fieldId: 'zip', colName: C.SHIP_TO_ZIP },
                        { fieldId: 'addrphone', evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
                    ] as FieldValueParseOptions[],
                } as FieldDictionaryParseOptions,
            } as SublistSubrecordParseOptions,
        ] as SublistSubrecordParseOptions[],
    } as SublistLineParseOptions,
};

/**
 * @deprecated
 */
export const PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS: DEPRECATED_ParseOptions = {
    recordType: RecordTypeEnum.CUSTOMER,

    fields: {
        // fieldValues: [
        //     { fieldId: 'isperson', evaluator: customerEval.customerIsPerson, args: [C.ENTITY_ID] },
        //     // ...CONTACT_CUSTOMER_SHARED_FIELDS,
        //     { fieldId: 'externalid', evaluator: evaluate.externalId, args: [RecordTypeEnum.CUSTOMER, C.ENTITY_ID] },
        //     { fieldId: 'altphone', 
        //         evaluator: evaluate.phone, 
        //         args: [{colName: C.PHONE, minIndex: 1}, C.ALT_PHONE, C.WORK_PHONE] as Array<string | ColumnSliceOptions> 
        //     },
        //     { fieldId: 'entitystatus', evaluator: customerEval.customerStatus, args: [C.CATEGORY] },
        //     { fieldId: 'category', evaluator: customerEval.customerCategory, args: [C.CATEGORY, CATEGORY_DICT] },
        //     { fieldId: 'companyname', evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        //     { fieldId: 'firstname', evaluator: customerEval.firstNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.FIRST_NAME, ...NAME_COLUMNS] },
        //     { fieldId: 'middlename', evaluator: customerEval.middleNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.MIDDLE_NAME, ...NAME_COLUMNS] },
        //     { fieldId: 'lastname', evaluator: customerEval.lastNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.LAST_NAME, ...NAME_COLUMNS] },
        //     { fieldId: 'accountnumber', colName: C.ACCOUNT_NUMBER },
        //     { fieldId: 'terms', evaluator: evaluate.terms, args: [C.TERMS, TERM_DICT] },
        //     { fieldId: 'taxable', defaultValue: true },
        //     { fieldId: 'taxitem', defaultValue: CustomerTaxItemEnum.AVATAX },
        //     { fieldId: 'url', evaluator: evaluate.website, args: [C.WEBSITE, C.EMAIL] },
        // ] as FieldValueParseOptions[],
        // subrecordValues: [] // No body subrecords
    } as FieldDictionaryParseOptions,
    sublists: {
        ...ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    } as SublistDictionaryParseOptions,
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.entity,
};

/**
 * @deprecated
 * */
export const PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS: DEPRECATED_ParseOptions = {
    recordType: RecordTypeEnum.CONTACT,
    fields: {
        // fieldValues: [
        //     // ...CONTACT_CUSTOMER_SHARED_FIELDS,
        //     { fieldId: 'externalid', evaluator: evaluate.externalId, args: [RecordTypeEnum.CONTACT, C.ENTITY_ID] },
        //     { fieldId: 'officephone', evaluator: evaluate.phone, args: [C.WORK_PHONE] },
        //     { fieldId: 'firstname', evaluator: evaluate.firstName, args: [C.FIRST_NAME, ...NAME_COLUMNS] },
        //     { fieldId: 'middlename', evaluator: evaluate.middleName, args: [C.MIDDLE_NAME, ...NAME_COLUMNS] },
        //     { fieldId: 'lastname', evaluator: evaluate.lastName, args: [C.LAST_NAME, ...NAME_COLUMNS] },
        //     { fieldId: 'company', evaluator: contactEval.contactCompany, args: [C.ENTITY_ID] },
        //     { fieldId: 'contactrole', defaultValue: ContactRoleEnum.PRIMARY_CONTACT },
        // ] as FieldValueParseOptions[],
    } as FieldDictionaryParseOptions,
    sublists: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
    valueOverrides: evaluate.ENTITY_VALUE_OVERRIDES,
    pruneFunc: prune.contact,
}



