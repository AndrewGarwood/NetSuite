/**
 * @file src/parse_configurations/salesorder/salesOrderParseDefinition.ts
 */
import { 
    SB_TERM_DICTIONARY as TERM_DICT,
    SublistLine,
    RecordOptions, idSearchOptions, idPropertyEnum,
} from "../../utils/api/types";
import { 
    CleanStringOptions, 
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
import * as prune from "../pruneFunctions";
import * as evaluate from "../evaluatorFunctions";
import * as customerEval from "../customer/customerEvaluatorFunctions";
import * as soEval from "./salesOrderEvaluatorFunctions";
import { SalesOrderColumnEnum as SO } from "./salesOrderConstants";
import { RecordTypeEnum, SalesOrderStatusEnum, SearchOperatorEnum } from "../../utils/ns/Enums";
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

/** 
 * (body subrecord) 
 * - `fieldId`: `'billaddress'` 
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
 * - `fieldId`: `'shipaddress'` 
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

const lineItemIdEvaluator = (sublistLine: SublistLine, ...args: string[]): string => {
    let idString = `{`+ [
        `item:${sublistLine.item}`,
        `quantity:${sublistLine.quantity}`,
        `rate:${sublistLine.rate}`,
        `amount:${sublistLine.amount}`,
        `description:${sublistLine.description}`
    ].join(',') + `}`;
    return idString;
}

const LINE_ITEM_SUBLIST_OPTIONS: SublistDictionaryParseOptions = {
    item: [{
        lineIdOptions: {lineIdEvaluator: lineItemIdEvaluator},
        item: { evaluator: soEval.itemSkuAsync, args: [SO.ITEM] },
        quantity: { colName: SO.QUANTITY },
        rate: { colName: SO.RATE },
        amount: { colName: SO.AMOUNT },
        description: { colName: SO.ITEM_MEMO },
        istaxable: { defaultValue: false }
    }] as SublistLineParseOptions[],
};

/** use then remove these entries in post processing */
export const INTERMEDIATE_ENTRIES: FieldDictionaryParseOptions = {
    transactiontype: { colName: SO.TRAN_TYPE }, 

}

/**
 * - `'S. O. #'` -> `'SO'`
 * - `'P. O. #'` -> `'PO'`
 * - `'Num'` -> `'NUM'`
 */
const externalIdKeyOptions: CleanStringOptions = {
    replace: [
        {searchValue: /(\.| |#)*/g, replaceValue: ''}, 
    ],
    case: { toUpper: true }
}
const EXTERNAL_ID_ARGS: any[] = [
    RecordTypeEnum.SALES_ORDER, SO.TRAN_TYPE, externalIdKeyOptions, 
    SO.TRAN_ID, SO.INVOICE_NUMBER, SO.PO_NUMBER
];

/**@TODO decide what to assign to the `otherrefnum` property */
export const SALES_ORDER_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: SO.TRAN_ID,
    fieldOptions: {
        // ...INTERMEDIATE_ENTRIES,
        location: { defaultValue: 1 },
        taxrate: { defaultValue: 0 },
        istaxable: { defaultValue: false },
        orderstatus: { defaultValue: SalesOrderStatusEnum.CLOSED },
        externalid: { evaluator: soEval.transactionExternalId, args: EXTERNAL_ID_ARGS},
        otherrefnum: { evaluator: soEval.otherReferenceNumber, 
            args: [SO.CHECK_NUMBER, SO.PO_NUMBER]
        },
        entity: { evaluator: evaluate.entityId, args: [SO.ENTITY_ID] },
        terms: { evaluator: evaluate.terms, args: [SO.TERMS, TERM_DICT] },
        checknumber: { colName: SO.CHECK_NUMBER },
        trandate: { colName: SO.TRAN_DATE },
        saleseffectivedate: { colName: SO.TRAN_DATE },
        startdate: { colName: SO.START_DATE },
        enddate: { colName: SO.END_DATE },
        shipdate: { colName: SO.SHIP_DATE },
        billingaddress: BILLING_ADDRESS_OPTIONS,
        shippingaddress: SHIPPING_ADDRESS_OPTIONS,
    },
    sublistOptions: {
        ...LINE_ITEM_SUBLIST_OPTIONS,
    }
}
const SALES_ORDER_COMPOSE_OPTIONS: ComposeOptions = {
    recordType: RecordTypeEnum.SALES_ORDER,
    idOptions: { 
        composer: (options: RecordOptions) => {
            if (!options || !options.fields 
                || !options.fields.externalid || typeof options.fields.externalid !== 'string') {
                throw new Error(
                    `[salesOrderParseDefinition.ComposeOptions] Unable to compose idOptions from externalid field.`
                );
            }
            const idOptions: idSearchOptions[] = (options.idOptions 
                ? options.idOptions : []
            );
            const encodeExternalId = (externalId: string): string => {
                return externalId.replace(/</, '&lt;').replace(/>/, '&gt;')
            }
            const encodedExternalId = encodeExternalId(options.fields.externalid);
            idOptions.push(
                {
                    idProp: idPropertyEnum.EXTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: encodedExternalId
                }, 
            );
            return idOptions;
        }
    }
}
export const SALES_ORDER_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    composeOptions: SALES_ORDER_COMPOSE_OPTIONS,
    pruneFunc: prune.salesOrder,
}