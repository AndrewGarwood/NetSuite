/**
 * @file src/parses/customer/customerParseDefinition.ts
 */
import { 
    RecordTypeEnum,
    ContactRoleEnum,
    SearchOperatorEnum,
    idPropertyEnum,
    idSearchOptions,
    CustomerCategoryEnum, 
    SB_TERM_DICTIONARY as TERM_DICT,
} from "../../utils/api/types";
import { CustomerStatusEnum, CustomerTaxItemEnum } from "../../utils/api/types";
import { 
    ColumnSliceOptions,
    FieldDictionaryParseOptions,
    FieldParseOptions,
    RecordParseOptions,
    SublistDictionaryParseOptions,
    SublistLineParseOptions,
    SubrecordParseOptions, 
} from "../../utils/io";
import { CustomerColumnEnum as C, CUSTOMER_CATEGORY_MAPPING as CATEGORY_DICT } from "./customerConstants";
import * as evaluate from "../evaluatorFunctions";
import * as prune from "../pruneFunctions";
import * as customerEval from "./customerEvaluatorFunctions";
import * as contactEval from "../contact/contactEvaluatorFunctions";

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

export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldDictionaryParseOptions = {
    'entityid': { evaluator: evaluate.entityId, args: [C.ENTITY_ID] },
    'isinactive': { defaultValue: NOT_INACTIVE },
    'email': { evaluator: evaluate.email, args: [C.EMAIL, C.ALT_EMAIL] },
    'altemail': { evaluator: evaluate.email, 
        args: [{ colName: C.EMAIL, minIndex: 1}, C.ALT_EMAIL, C.CC_EMAIL] as Array<string | ColumnSliceOptions>
    },
    'phone': { evaluator: evaluate.phone, args: [C.PHONE, C.ALT_PHONE, C.WORK_PHONE] },
    'mobilephone': { evaluator: evaluate.phone, 
        args: [C.MOBILE_PHONE, C.ALT_MOBILE,{ colName: C.PHONE, minIndex: 2}] as Array<string | ColumnSliceOptions> 
    },
    'homephone': { evaluator: evaluate.phone, 
        args: [C.HOME_PHONE, { colName: C.PHONE, minIndex: 3}] as Array<string | ColumnSliceOptions> 
    },
    'fax': { evaluator: evaluate.phone, args: [C.FAX, C.ALT_FAX] },
    'salutation': { evaluator: evaluate.salutation, 
        args: [C.SALUTATION, ...BILLING_NAME_COLUMNS] },
    'title': { colName: C.TITLE},
    'comments': { colName: C.COMMENTS },
}

const BILLING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions:{
        'country': { evaluator: evaluate.country, args: [C.COUNTRY, C.STATE] },
        'addressee': { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        'attention': { evaluator: evaluate.attention, args: [BILLING_ATTENTION_ARGS] },
        'addr1': { evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
        'addr2': { evaluator: evaluate.street, args: [2, BILLING_STREET_ARGS] },
        'city': { colName: C.CITY },
        'state': { evaluator: evaluate.state, args: [C.STATE]},
        'zip': { colName: C.ZIP },
        'addrphone': { evaluator: evaluate.phone, args: BILLING_PHONE_COLUMNS },
    } as FieldDictionaryParseOptions,
};

const SHIPPING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions: { 
        'country': { evaluator: evaluate.country, args: [C.SHIP_TO_COUNTRY, C.SHIP_TO_STATE]},
        'addressee': { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        'attention': { evaluator: evaluate.attention, args: [SHIPPING_ATTENTION_ARGS] },
        'addr1': { evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
        'addr2': { evaluator: evaluate.street, args: [2, SHIPPING_STREET_ARGS] },
        'city': { colName: C.SHIP_TO_CITY },
        'state': { evaluator: evaluate.state, args: [C.SHIP_TO_STATE]},
        'zip': { colName: C.SHIP_TO_ZIP },
        'addrphone': { evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
    } as FieldDictionaryParseOptions,
};

export const ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS: SublistDictionaryParseOptions = {
    addressbook: [
        { addressbookaddress: BILLING_ADDRESS_OPTIONS },
        { addressbookaddress: SHIPPING_ADDRESS_OPTIONS },  
    ] as SublistLineParseOptions[],
};

export const CUSTOMER_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ENTITY_ID,
    fieldOptions: {
        'isperson': { evaluator: customerEval.customerIsPerson, args: [C.ENTITY_ID] },
        ...CONTACT_CUSTOMER_SHARED_FIELDS,
        'externalid': { evaluator: evaluate.externalId, args: [RecordTypeEnum.CUSTOMER, C.ENTITY_ID] },
        'altphone': { evaluator: evaluate.phone, 
            args: [{ colName: C.PHONE, minIndex: 1}, C.ALT_PHONE, C.WORK_PHONE] as Array<string | ColumnSliceOptions> 
        },
        'entitystatus': { evaluator: customerEval.customerStatus, args: [C.CATEGORY] },
        'category': { evaluator: customerEval.customerCategory, args: [C.CATEGORY, CATEGORY_DICT] },
        'companyname': { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        'firstname': { evaluator: customerEval.firstNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.FIRST_NAME, ...NAME_COLUMNS] },
        'middlename': { evaluator: customerEval.middleNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.MIDDLE_NAME, ...NAME_COLUMNS] },
        'lastname': { evaluator: customerEval.lastNameIfCustomerIsPerson, args: [C.ENTITY_ID, C.LAST_NAME, ...NAME_COLUMNS] },
        'accountnumber': { colName: C.ACCOUNT_NUMBER },
        'terms': { evaluator: evaluate.terms, args: [C.TERMS, TERM_DICT] },
        'taxable': {defaultValue: true },
        'taxitem': {defaultValue: CustomerTaxItemEnum.AVATAX },
        'url': { evaluator: evaluate.website, args: [C.WEBSITE, C.EMAIL] },
        
    } as FieldDictionaryParseOptions,
    sublistOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
};


export const CONTACT_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ENTITY_ID,
    fieldOptions: {
        ...CONTACT_CUSTOMER_SHARED_FIELDS,
        'externalid': { evaluator: evaluate.externalId, args: [RecordTypeEnum.CONTACT, C.ENTITY_ID] },
        'officephone': { evaluator: evaluate.phone, args: [C.WORK_PHONE] },
        'firstname': { evaluator: evaluate.firstName, args: [C.FIRST_NAME, ...NAME_COLUMNS] },
        'middlename': { evaluator: evaluate.middleName, args: [C.MIDDLE_NAME, ...NAME_COLUMNS] },
        'lastname': { evaluator: evaluate.lastName, args: [C.LAST_NAME, ...NAME_COLUMNS] },
        'company': { evaluator: contactEval.contactCompany, args: [C.ENTITY_ID] },
        'contactrole': {defaultValue: ContactRoleEnum.PRIMARY_CONTACT },
        
    } as FieldDictionaryParseOptions,
    sublistOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
}



