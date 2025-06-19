/**
 * @file src/parses/salesorder/salesOrderParseDefinition.ts
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
import * as evaluate from "../evaluatorFunctions";
import * as customerEval from "../customer/customerEvaluatorFunctions";
import * as contactEval from "../contact/contactEvaluatorFunctions";
import { SalesOrderCustomerColumnEnum as SO_C, SalesOrderColumnEnum as SO } from "./salesOrderConstants";
/** use to set the field `"isinactive"` to false */
const NOT_INACTIVE = false;
/**
 * if `'First Name'` and `Columns.LAST_NAME` not filled, 
 * then look for name to extract from these columns
 * */
export const NAME_COLUMNS = [
    SO.ENTITY, SO_C.PRIMARY_CONTACT, SO_C.STREET_ONE, SO_C.STREET_TWO, 
    SO_C.SHIP_TO_STREET_ONE, SO_C.SHIP_TO_STREET_TWO,
]
/** Look for {@link evaluate.attention} names in these columns for the billing address */
export const BILLING_NAME_COLUMNS = [
    SO_C.STREET_ONE, SO_C.STREET_TWO, SO_C.PRIMARY_CONTACT,  SO_C.ENTITY_ID
]

/** Look for {@link evaluate.attention} names in these columns for the shipping address */
export const SHIPPING_NAME_COLUMNS = [
    SO_C.SHIP_TO_STREET_ONE, SO_C.SHIP_TO_STREET_TWO, 
    SO_C.PRIMARY_CONTACT, SO_C.ENTITY_ID
];

const BILLING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: SO_C.ENTITY_ID, 
    salutationColumn: undefined,
    firstNameColumn: undefined,
    middleNameColumn: undefined,
    lastNameColumn: undefined, 
    nameColumns: BILLING_NAME_COLUMNS
}

const SHIPPING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: SO_C.ENTITY_ID, 
    salutationColumn: undefined,
    firstNameColumn: undefined,
    middleNameColumn: undefined,
    lastNameColumn: undefined, 
    nameColumns: SHIPPING_NAME_COLUMNS
}

const BILLING_STREET_ARGS: evaluate.StreetArguments = {
    streetLineOneColumn: SO_C.STREET_ONE, 
    streetLineTwoColumn: SO_C.STREET_TWO,
    companyNameColumn: undefined,
    addresseeFunction: customerEval.customerCompany, 
    ...BILLING_ATTENTION_ARGS
}

const SHIPPING_STREET_ARGS: evaluate.StreetArguments = {
    streetLineOneColumn: SO_C.SHIP_TO_STREET_ONE,
    streetLineTwoColumn: SO_C.SHIP_TO_STREET_TWO,
    companyNameColumn: undefined,
    addresseeFunction: customerEval.customerCompany,
    ...SHIPPING_ATTENTION_ARGS
}


export const CONTACT_CUSTOMER_SHARED_FIELDS: FieldDictionaryParseOptions = {
    'entityid': { evaluator: evaluate.entityId, args: [SO_C.ENTITY_ID] },
    'isinactive': { defaultValue: NOT_INACTIVE },
    'email': { evaluator: evaluate.email, args: [SO_C.EMAIL] },
    'phone': { evaluator: evaluate.phone, args: [SO_C.PHONE] },
    'fax': { evaluator: evaluate.phone, args: [SO_C.FAX] },
}

const BILLING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions:{
        'country': { evaluator: evaluate.country, args: [SO_C.COUNTRY, SO_C.STATE] },
        'addressee': { evaluator: customerEval.customerCompany, args: [SO_C.ENTITY_ID] },
        'attention': { evaluator: evaluate.attention, args: [BILLING_ATTENTION_ARGS] },
        'addr1': { evaluator: evaluate.street, args: [1, BILLING_STREET_ARGS] },
        'addr2': { evaluator: evaluate.street, args: [2, BILLING_STREET_ARGS] },
        'city': { colName: SO_C.CITY },
        'state': { evaluator: evaluate.state, args: [SO_C.STATE]},
        'zip': { colName: SO_C.ZIP },
        // 'addrphone': { evaluator: evaluate.phone, args: BILLING_PHONE_COLUMNS },
    } as FieldDictionaryParseOptions,
};

const SHIPPING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions: { 
        'country': { evaluator: evaluate.country, args: [SO_C.SHIP_TO_COUNTRY, SO_C.SHIP_TO_STATE]},
        'addressee': { evaluator: customerEval.customerCompany, args: [SO_C.ENTITY_ID] },
        'attention': { evaluator: evaluate.attention, args: [SHIPPING_ATTENTION_ARGS] },
        'addr1': { evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
        'addr2': { evaluator: evaluate.street, args: [2, SHIPPING_STREET_ARGS] },
        'city': { colName: SO_C.SHIP_TO_CITY },
        'state': { evaluator: evaluate.state, args: [SO_C.SHIP_TO_STATE]},
        'zip': { colName: SO_C.SHIP_TO_ZIP },
        // 'addrphone': { evaluator: evaluate.phone, args: SHIPPING_PHONE_COLUMNS },
    } as FieldDictionaryParseOptions,
};