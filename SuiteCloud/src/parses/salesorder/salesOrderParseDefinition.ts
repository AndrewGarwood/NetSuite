/**
 * @file src/parses/salesorder/salesOrderParseDefinition.ts
 */
import { 
    RecordTypeEnum,
    ContactRoleEnum,
    SearchOperatorEnum,
    idPropertyEnum,
    idSearchOptions, 
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
import * as evaluate from "../evaluatorFunctions";
import * as customerEval from "../customer/customerEvaluatorFunctions";
import * as soEval from "./salesOrderEvaluatorFunctions";
import { SalesOrderColumnEnum as SO } from "./salesOrderConstants";
/** use to set the field `"isinactive"` to false */
const NOT_INACTIVE = false;
/**
 * if `'First Name'` and `Columns.LAST_NAME` not filled, 
 * then look for name to extract from these columns
 * */
export const NAME_COLUMNS = [
    SO.ENTITY_ID, SO.PRIMARY_CONTACT, SO.STREET_ONE, SO.STREET_TWO, 
    SO.SHIP_TO_STREET_ONE, SO.SHIP_TO_STREET_TWO,
]
/** Look for {@link evaluate.attention} names in these columns for the billing address */
export const BILLING_NAME_COLUMNS = [
    SO.STREET_ONE, SO.STREET_TWO, SO.PRIMARY_CONTACT,  SO.ENTITY_ID
]

/** Look for {@link evaluate.attention} names in these columns for the shipping address */
export const SHIPPING_NAME_COLUMNS = [
    SO.SHIP_TO_STREET_ONE, SO.SHIP_TO_STREET_TWO, 
    SO.PRIMARY_CONTACT, SO.ENTITY_ID
];

const BILLING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: SO.ENTITY_ID, 
    salutationColumn: undefined,
    firstNameColumn: undefined,
    middleNameColumn: undefined,
    lastNameColumn: undefined, 
    nameColumns: BILLING_NAME_COLUMNS
}

const SHIPPING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: SO.ENTITY_ID, 
    salutationColumn: undefined,
    firstNameColumn: undefined,
    middleNameColumn: undefined,
    lastNameColumn: undefined, 
    nameColumns: SHIPPING_NAME_COLUMNS
}

const BILLING_STREET_ARGS: evaluate.StreetArguments = {
    streetLineOneColumn: SO.STREET_ONE, 
    streetLineTwoColumn: SO.STREET_TWO,
    companyNameColumn: undefined,
    addresseeFunction: customerEval.customerCompany, 
    ...BILLING_ATTENTION_ARGS
}

const SHIPPING_STREET_ARGS: evaluate.StreetArguments = {
    streetLineOneColumn: SO.SHIP_TO_STREET_ONE,
    streetLineTwoColumn: SO.SHIP_TO_STREET_TWO,
    companyNameColumn: undefined,
    addresseeFunction: customerEval.customerCompany,
    ...SHIPPING_ATTENTION_ARGS
}


// export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldDictionaryParseOptions = {
//     entityid: { evaluator: evaluate.entityId, args: [SO.ENTITY_ID] },
//     isinactive: { defaultValue: NOT_INACTIVE },
//     email: { evaluator: evaluate.email, args: [SO.EMAIL] },
//     phone: { evaluator: evaluate.phone, args: [SO.PHONE] },
//     fax: { evaluator: evaluate.phone, args: [SO.FAX] },
// }

/** 
 * (body subrecord) 
 * - fieldId: `'billaddress'` 
 * */
const BILLING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions: {
        country: { evaluator: evaluate.country, args: [SO.COUNTRY, SO.STATE] },
        addressee: { evaluator: customerEval.customerCompany, args: [SO.ENTITY_ID] },
        attention: { evaluator: evaluate.attention, args: [BILLING_ATTENTION_ARGS] },
        addr1: { evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
        addr2: { evaluator: evaluate.street, args: [2, BILLING_STREET_ARGS] },
        city: { colName: SO.CITY },
        state: { evaluator: evaluate.state, args: [SO.STATE]},
        zip: { colName: SO.ZIP },
    } as FieldDictionaryParseOptions,
};

/** 
 * (body subrecord) 
 * - fieldId: `'shipaddress'` 
 * */
const SHIPPING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions: { 
        country: { evaluator: evaluate.country, args: [SO.SHIP_TO_COUNTRY, SO.SHIP_TO_STATE]},
        addressee: { evaluator: customerEval.customerCompany, args: [SO.ENTITY_ID] },
        attention: { evaluator: evaluate.attention, args: [SHIPPING_ATTENTION_ARGS] },
        addr1: { evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
        addr2: { evaluator: evaluate.street, args: [2, SHIPPING_STREET_ARGS] },
        city: { colName: SO.SHIP_TO_CITY },
        state: { evaluator: evaluate.state, args: [SO.SHIP_TO_STATE]},
        zip: { colName: SO.SHIP_TO_ZIP },
    } as FieldDictionaryParseOptions,
};
//        addrphone: { evaluator: evaluate.phone, args: [SO.PHONE] },

const LINE_ITEM_SUBLIST_OPTIONS: SublistDictionaryParseOptions = {
    item: [{
        item: { evaluator: () => {return "not implemented"}, args: [SO.ITEM] },
        quantity: { colName: SO.QUANTITY },
        rate: { colName: SO.RATE },
        amount: { colName: SO.AMOUNT },
    }] as SublistLineParseOptions[],
};

/** use then remove these entries in post processing */
export const INTERMEDIATE_ENTRIES: FieldDictionaryParseOptions = {
    transactiontype: { colName: SO.TRAN_TYPE }, 

}

export const SALES_ORDER_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: SO.TRAN_ID,
    fieldOptions: {
        ...INTERMEDIATE_ENTRIES,
        externalid: { evaluator: soEval.externalId, args: [SO.TRAN_ID, SO.INVOICE_NUMBER, SO.PO_NUMBER]},
        entity: { evaluator: evaluate.entityId, args: [SO.ENTITY_ID] },
        terms: { evaluator: evaluate.terms, args: [SO.TERMS] },
        checknumber: { colName: SO.CHECK_NUMBER },
        trandate: { colName: SO.TRAN_DATE },
        saleseffectivedate: { colName: SO.TRAN_DATE },
        shipdate: { colName: SO.SHIP_DATE },
        billaddress: BILLING_ADDRESS_OPTIONS,
        shipaddress: SHIPPING_ADDRESS_OPTIONS,
    },
    sublistOptions: {
        ...LINE_ITEM_SUBLIST_OPTIONS,
    }
}

/*
post processing:
- couponcode
- class: evaluate salesorder.class based on all line items in the order...?
- remove fields.transactiontype
*/