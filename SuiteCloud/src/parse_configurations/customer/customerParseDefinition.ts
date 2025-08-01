/**
 * @file src/parse_configurations/customer/customerParseDefinition.ts
 */
import { mainLogger as mlog } from "../../config";
import { 
    idPropertyEnum,
    RecordOptions,
    idSearchOptions, 
} from "../../api/types";
import { 
    ColumnSliceOptions,
    FieldDictionaryParseOptions,
    FieldParseOptions,
    RecordParseOptions,
    SublistDictionaryParseOptions,
    SublistLineParseOptions,
    SubrecordParseOptions, RecordPostProcessingOptions, CloneOptions,
    ProcessParseResultsOptions, ComposeOptions,
    SublistLineIdOptions,
} from "../../utils/io";
import { CustomerColumnEnum as C, CUSTOMER_CATEGORY_MAPPING as CATEGORY_DICT } from "./customerConstants";
import * as evaluate from "../evaluatorFunctions";
import * as prune from "../pruneFunctions";
import * as customerEval from "./customerEvaluatorFunctions";
import { ContactRoleEnum, CustomerTaxItemEnum, RecordTypeEnum, SearchOperatorEnum } from "src/utils/ns/Enums";
import { SB_TERM_DICTIONARY } from "src/utils/ns/record/accounting/Term";
import { isNonEmptyString } from "src/utils/typeValidation";

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
 * if `'Columns.FIRST_NAME'` and `Columns.LAST_NAME` not filled, 
 * then look for name to extract from these columns
 * */
export const NAME_COLUMNS = [
    C.PRIMARY_CONTACT, 
    C.ENTITY_ID, 
    C.STREET_ONE, C.STREET_TWO, 
    C.BILL_TO_ONE, C.BILL_TO_TWO,
    C.SHIP_TO_STREET_ONE, C.SHIP_TO_STREET_TWO, 
    C.SHIP_TO_ONE, C.SHIP_TO_TWO, 
    C.SECONDARY_CONTACT,
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

/**
 * fields belonging to both record types, or customer fields 
 * that are used in post processing for the contact's RecordOptions 
 * */
export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldDictionaryParseOptions = {
    isperson: { evaluator: customerEval.customerIsPerson, args: [C.ENTITY_ID, C.COMPANY] },
    isinactive: { defaultValue: NOT_INACTIVE },
    email: { evaluator: evaluate.email, args: [C.EMAIL, C.ALT_EMAIL] },
    altemail: { evaluator: evaluate.email, args: [
            {colName: C.EMAIL, minIndex: 1}, C.ALT_EMAIL, C.CC_EMAIL
        ] as Array<string | ColumnSliceOptions>
    },
    phone: { evaluator: evaluate.phone, args: [C.PHONE, C.ALT_PHONE, C.WORK_PHONE] },
    mobilephone: { evaluator: evaluate.phone, args: [
            C.MOBILE_PHONE, C.ALT_MOBILE, {colName: C.PHONE, minIndex: 2}
        ] as Array<string | ColumnSliceOptions> 
    },
    homephone: { evaluator: evaluate.phone, args: [
            C.HOME_PHONE, {colName: C.PHONE, minIndex: 3}
        ] as Array<string | ColumnSliceOptions> 
    },
    fax: { evaluator: evaluate.phone, args: [C.FAX, C.ALT_FAX] },
    salutation: { evaluator: evaluate.salutation, args: [C.SALUTATION, ...NAME_COLUMNS] },
    firstname: { evaluator: evaluate.firstName, args: [C.FIRST_NAME, ...NAME_COLUMNS] },
    middlename: { evaluator: evaluate.middleName, args: [C.MIDDLE_NAME, ...NAME_COLUMNS] },
    lastname: { evaluator: evaluate.lastName, args: [C.LAST_NAME, ...NAME_COLUMNS] },
    title: { evaluator: evaluate.jobTitleSuffix, args: [C.TITLE, ...NAME_COLUMNS] },
    comments: { colName: C.COMMENTS },
}

const BILLING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions:{
        country: { evaluator: evaluate.country, args: [C.COUNTRY, C.STATE] },
        addressee: { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        attention: { evaluator: evaluate.attention, args: [BILLING_ATTENTION_ARGS] },
        addr1: { evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
        addr2: { evaluator: evaluate.street, args: [2, BILLING_STREET_ARGS] },
        city: { colName: C.CITY },
        state: { evaluator: evaluate.state, args: [C.STATE]},
        zip: { colName: C.ZIP },
        addrphone: { evaluator: evaluate.phone, args: BILLING_PHONE_COLUMNS },
    } as FieldDictionaryParseOptions,
};

const SHIPPING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions: { 
        country: { evaluator: evaluate.country, args: [C.SHIP_TO_COUNTRY, C.SHIP_TO_STATE]},
        addressee: { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        attention: { evaluator: evaluate.attention, args: [SHIPPING_ATTENTION_ARGS] },
        addr1: { evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
        addr2: { evaluator: evaluate.street, args: [2, SHIPPING_STREET_ARGS] },
        city: { colName: C.SHIP_TO_CITY },
        state: { evaluator: evaluate.state, args: [C.SHIP_TO_STATE]},
        zip: { colName: C.SHIP_TO_ZIP },
        addrphone: { evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
    } as FieldDictionaryParseOptions,
};

export const ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS: SublistDictionaryParseOptions = {
    addressbook: [
        { 
            lineIdOptions: {lineIdProp: 'label'} as SublistLineIdOptions, 
            label: { evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
            addressbookaddress: BILLING_ADDRESS_OPTIONS, 
        },
        { 
            lineIdOptions: {lineIdProp: 'label'} as SublistLineIdOptions, 
            label: { evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
            addressbookaddress: SHIPPING_ADDRESS_OPTIONS, 
        },  
    ] as SublistLineParseOptions[],
};

export const CUSTOMER_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ENTITY_ID,
    fieldOptions: {
        entityid: { evaluator: evaluate.entityId, args: [C.ENTITY_ID] }, // customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        ...CONTACT_CUSTOMER_SHARED_FIELDS,
        externalid: { evaluator: evaluate.entityExternalId, args: [RecordTypeEnum.CUSTOMER, C.ENTITY_ID] },
        altphone: { evaluator: evaluate.phone, 
            args: [{ colName: C.PHONE, minIndex: 1}, 
                C.ALT_PHONE, C.WORK_PHONE, C.SHIP_TO_FOUR, C.SHIP_TO_FIVE
            ] as Array<string | ColumnSliceOptions> 
        },
        entitystatus: { evaluator: customerEval.customerStatus, args: [C.CATEGORY] },
        category: { evaluator: customerEval.customerCategory, args: [C.CATEGORY, CATEGORY_DICT] },
        companyname: { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        accountnumber: { colName: C.ACCOUNT_NUMBER },
        terms: { evaluator: evaluate.terms, args: [C.TERMS, SB_TERM_DICTIONARY] },
        taxable: {defaultValue: true },
        taxitem: {defaultValue: CustomerTaxItemEnum.YOUR_TAX_ITEM },
        url: { evaluator: evaluate.website, args: [C.WEBSITE, C.EMAIL] },
        
    } as FieldDictionaryParseOptions,
    sublistOptions: ADDRESS_BOOK_SUBLIST_PARSE_OPTIONS,
};

/**
 * 
 * */
export const CONTACT_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ENTITY_ID,
    fieldOptions: {
        entityid: { evaluator: evaluate.entityId, args: [C.ENTITY_ID] },
        externalid: { evaluator: evaluate.entityExternalId, args: [RecordTypeEnum.CONTACT, C.ENTITY_ID] },
        officephone: { evaluator: evaluate.phone, args: [C.WORK_PHONE, C.SHIP_TO_FOUR, C.SHIP_TO_FIVE] },
        company: { evaluator: customerEval.customerCompany, args: [C.ENTITY_ID, C.COMPANY] },
        contactrole: {defaultValue: ContactRoleEnum.PRIMARY_CONTACT },
    } as FieldDictionaryParseOptions,
};
/** 
 * from parsed customer RecordOptions, 
 * clone {@link CONTACT_CUSTOMER_SHARED_FIELDS} 
 * and the `'addressbook'` sublist 
 * to the contact RecordOptions with matching `'entityid'` */
export const CLONE_CUSTOMER_FIELDS_TO_CONTACT_OPTIONS: CloneOptions = {
    donorType: RecordTypeEnum.CUSTOMER,
    recipientType: RecordTypeEnum.CONTACT,
    idProp: idPropertyEnum.ENTITY_ID,
    fieldIds: Object.keys(CONTACT_CUSTOMER_SHARED_FIELDS),
    sublistIds: ['addressbook'],
};



const CUSTOMER_COMPOSE_OPTIONS: ComposeOptions = {
    recordType: RecordTypeEnum.CUSTOMER,
    idOptions: { 
        composer: (options: RecordOptions, idOptions: idSearchOptions[]=[]) => {
            const encodeExternalId = (externalId: string): string => {
                return externalId.replace(/</, '&lt;').replace(/>/, '&gt;')
            }
            const fields = options.fields;
            if (!fields) {return []; }
            idOptions.push(
                { 
                    idProp: idPropertyEnum.ENTITY_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: fields.companyname as string
                },
                { 
                    idProp: idPropertyEnum.ENTITY_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: fields.entityid as string  
                },
                {
                    idProp: idPropertyEnum.EXTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: encodeExternalId(fields.externalid as string)
                },
                {
                    idProp: idPropertyEnum.EXTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: encodeExternalId(`${fields.companyname}<${RecordTypeEnum.CUSTOMER}>`)
                },
            );
            
            if (isNonEmptyString(fields.firstname) && isNonEmptyString(fields.lastname)
                && fields.entityid !== `${fields.firstname} ${fields.lastname}`
            ) {
                idOptions.push({
                    idProp: idPropertyEnum.EXTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: encodeExternalId(`${fields.firstname} ${fields.lastname}<${RecordTypeEnum.CUSTOMER}>`)
                });
            }
            return idOptions;
        }
    }
}
export const CONTACT_CUSTOMER_POST_PROCESSING_OPTIONS: ProcessParseResultsOptions = {
    [RecordTypeEnum.CONTACT]: {
        cloneOptions: CLONE_CUSTOMER_FIELDS_TO_CONTACT_OPTIONS,
        pruneFunc: prune.contact
    } as RecordPostProcessingOptions,
    [RecordTypeEnum.CUSTOMER]: {
        composeOptions: CUSTOMER_COMPOSE_OPTIONS,
        pruneFunc: prune.entity
    } as RecordPostProcessingOptions,
};
