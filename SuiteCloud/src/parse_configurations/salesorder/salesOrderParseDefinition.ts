/**
 * @file src/parse_configurations/salesorder/salesOrderParseDefinition.ts
 */
import { mainLogger as mlog, pruneLogger as plog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import {
    SublistLine,
    RecordOptions, idSearchOptions, idPropertyEnum,
    FieldValue,
    FieldDictionary,
} from "../../api/types";
import * as prune from "../pruneFunctions";
import * as evaluate from "../evaluatorFunctions";
import * as customerEval from "../customer/customerEvaluatorFunctions";
import * as soEval from "./salesOrderEvaluatorFunctions";
import { SalesOrderColumnEnum as SO } from "./salesOrderConstants";
import { CustomerStatusEnum, CustomerTaxItemEnum, RecordTypeEnum, SearchOperatorEnum } from "../../utils/ns/Enums";
import { getSkuDictionary } from "../../config/dataLoader";
import { isNonEmptyString } from "typeshi:utils/typeValidation";
import { SB_TERM_DICTIONARY } from "../../utils/ns";
import { CleanStringOptions, toTitleCase } from "typeshi:utils/regex";
import { 
    SubrecordParseOptions, FieldDictionaryParseOptions, 
    SublistDictionaryParseOptions, SublistLineParseOptions, RecordParseOptions, 
    ColumnSliceOptions, 
    SublistLineIdOptions 
} from "../../services/parse/types/index";
import {
    ComposeOptions, RecordPostProcessingOptions, 
    PostProcessingOperationEnum 
} from "../../services/post_process/types/PostProcessing";

/** 
 * @TODO decide if it is better to move value assignment of 
 * fields with only defaultValue in their FieldParseOptions to Post Processing
 * */

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
    nameColumns: BILLING_NAME_COLUMNS
}

const SHIPPING_ATTENTION_ARGS: evaluate.AttentionArguments = {
    entityIdColumn: SO.ENTITY_ID, 
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
 * - `fieldId`: `'billingaddress'` 
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
 * - `fieldId`: `'shippingaddress'` 
 * */
const SHIPPING_ADDRESS_OPTIONS: SubrecordParseOptions = {
    subrecordType: 'address',
    fieldOptions: { 
        country: { evaluator: evaluate.country, args: [SO.SHIP_TO_COUNTRY, SO.SHIP_TO_STATE] },
        addressee: { evaluator: customerEval.customerCompany, args: [SO.ENTITY_ID] },
        attention: { evaluator: evaluate.attention, args: [SHIPPING_ATTENTION_ARGS] },
        addr1: { evaluator: evaluate.street, args: [1, SHIPPING_STREET_ARGS] },
        addr2: { evaluator: evaluate.street, args: [2, SHIPPING_STREET_ARGS] },
        city: { colName: SO.SHIP_TO_CITY },
        state: { evaluator: evaluate.state, args: [SO.SHIP_TO_STATE] },
        zip: { colName: SO.SHIP_TO_ZIP },
    } as FieldDictionaryParseOptions,
};

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
        item: { evaluator: evaluate.itemId, args: [SO.ITEM] },
        quantity: { colName: SO.QUANTITY, defaultValue: 1 },
        rate: { colName: SO.RATE, defaultValue: 0.0 },
        amount: { colName: SO.AMOUNT, defaultValue: 0.0 },
        description: { colName: SO.ITEM_MEMO },
        istaxable: { defaultValue: false },
        isclosed: { defaultValue: true },
    }] as SublistLineParseOptions[],
};

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
    SO.SO_ID, SO.INVOICE_NUMBER, SO.PO_NUMBER
];

const MEMO_ARGS: any[] = [
    'QB Summary', SO.TRAN_TYPE, SO.TRAN_NUM,
    SO.SO_ID, SO.INVOICE_NUMBER, SO.PO_NUMBER,
]

export const SALES_ORDER_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: SO.SO_ID,
    fieldOptions: {
        custbody_ava_disable_tax_calculation: { defaultValue: true },
        location: { defaultValue: 1 },
        istaxable: { defaultValue: false },
        taxrate: { defaultValue: 0 },
        memo: { evaluator: soEval.memo, args: MEMO_ARGS },
        externalid: { evaluator: soEval.transactionExternalId, args: EXTERNAL_ID_ARGS },
        otherrefnum: { evaluator: soEval.otherReferenceNumber, args: [SO.CHECK_NUMBER, SO.PO_NUMBER] },
        entity: { evaluator: evaluate.entityId, args: [SO.ENTITY_ID] },
        terms: { evaluator: evaluate.terms, args: [SO.TERMS, SB_TERM_DICTIONARY] },
        checknumber: { colName: SO.CHECK_NUMBER },
        trandate: { colName: SO.TRAN_DATE },
        saleseffectivedate: { colName: SO.TRAN_DATE },
        startdate: { colName: SO.START_DATE },
        enddate: { colName: SO.END_DATE },
        shipdate: { colName: SO.SHIP_DATE },
        billingaddress: BILLING_ADDRESS_OPTIONS,
        shippingaddress: SHIPPING_ADDRESS_OPTIONS,
    } as FieldDictionaryParseOptions,
    sublistOptions: {
        ...LINE_ITEM_SUBLIST_OPTIONS,
    } as SublistDictionaryParseOptions
}

/** 
 * @TODO use the RecordOptions[] parsed from this spec and make GET_Record calls 
 * to compare parsed amount and amount in NetSutie
 * */
export const SALES_ORDER_AMOUNT_VALIDATION_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: SO.SO_ID,
    fieldOptions: {
        externalid: { evaluator: soEval.transactionExternalId, args: EXTERNAL_ID_ARGS },
        entity: { evaluator: evaluate.entityId, args: [SO.ENTITY_ID] },
    },
    sublistOptions: {
        ...LINE_ITEM_SUBLIST_OPTIONS,
    } as SublistDictionaryParseOptions
}

const assignItemInternalIds = async (
    sublistLines: SublistLine[]
): Promise<SublistLine[]> => {
    const skuDict = await getSkuDictionary();
    for (let i = 0; i < sublistLines.length; i++) {
        let sku = sublistLines[i].item as string;
        if (!skuDict[sku]) {
            mlog.error([`[SalesOrderParseDefinition.lineItemComposer.assignItemInternalids()]`,
                `Error: sku not found in SkuDictionary`,
                `  sku: '${sku}'`
            ].join(TAB))
            continue;
        }
        sublistLines[i].item = skuDict[sku];
    }
    return sublistLines;
}

/** 
 * for sublistId = `'item'`
 * - assign internalids, then set quantity fields to order quantity  
 * @TODO decide if should parse strings as numbers in csvParser.transformValue(), 
 * or if should just do number conversion in post processing.
 * the latter offers more control. I think NetSuite handles both anyway.
 * */
const lineItemComposer = async (
    record: RecordOptions, 
    sublistLines: SublistLine[]
): Promise<SublistLine[]> => {
    sublistLines = await assignItemInternalIds(sublistLines);
    for (let i = 0; i < sublistLines.length; i++) {
        const floatFields = ['rate', 'amount'];
        for (const fieldId of floatFields) { 
            if (isNonEmptyString(sublistLines[i][fieldId])) {
                sublistLines[i][fieldId] = Math.abs(Number(sublistLines[i][fieldId])) ?? 0.0;
            }
        }
        sublistLines[i].quantity = (
            isNonEmptyString(sublistLines[i].quantity) 
                && Number(sublistLines[i].quantity) !== 0
            ? Math.abs(Number(sublistLines[i].quantity))
            : 1
        );
        const qty = sublistLines[i].quantity as number;
        const quantityFields = [
            // 'quantityavailable', 'quantitycommitted', 'quantityfulfilled', 
            'quantitybilled' // label(quantitybilled) = "Invoiced"
        ];
        for (const fieldId of quantityFields) {
            sublistLines[i][fieldId] = qty
        }
    }
    return sublistLines;
}



function encodeExternalId(externalId: string): string {
    return externalId.replace(/</, '&lt;').replace(/>/, '&gt;')
}
const addEncodedExternalIdSearchOption = (
    options: RecordOptions, 
    idOptions: idSearchOptions[]
): idSearchOptions[] => {
    if (!options || !options.fields 
        || !isNonEmptyString(options.fields.externalid)) {
        throw new Error(
            `[salesOrderParseDefinition.ComposeOptions] Unable to compose idOptions from externalid field.`
        );
    }
    const encodedExternalId = encodeExternalId(options.fields.externalid);
    idOptions.push({
        idProp: idPropertyEnum.EXTERNAL_ID, 
        searchOperator: SearchOperatorEnum.TEXT.IS, 
        idValue: encodedExternalId
    });
    return idOptions;
}

const appendMemo = (
    options: RecordOptions,
    fields: FieldDictionary
): FieldDictionary => {
    if (!options || !options.sublists) {
        return fields;
    }
    /** expected format: `'SO:9999_NUM:0000_PO:1111(TRAN_TYPE)<salesorder>'` */
    let externalId = fields.externalid as string;
    let tranType = (/(?<=\()[A-Z]+(?=\)<)/.exec(externalId) || [''])[0];
    let expectedTotal: number = 0.00;
    let itemSublist = options.sublists.item;
    const ogMemo = fields.memo as string;
    let memo = fields.memo as string || '';
    let notes: string[] = [
        `External ID: ${externalId}`, 
        `QB Type: '${tranType ? toTitleCase(tranType) : 'UNDEFINED'}'`,
        // `(index, SKU): rate * quantity = amount`
    ];
    let index = 1;
    for (const lineItem of itemSublist) {
        if (!isNonEmptyString(lineItem.amount) || !isNonEmptyString(lineItem.item)) { 
            continue; 
        }
        let sku = String(lineItem.item);
        const isDiscountItem = isNonEmptyString(sku && /discount/i.test(sku));
        let amount: string | number = lineItem.amount;
        // notes.push(`(${index}, ${sku}): ${lineItem.rate} * ${lineItem.quantity} = ${lineItem.amount}`);
        amount = Math.abs(Number(amount));
        expectedTotal += isDiscountItem ? -1 * amount : amount;
        index++;
    }
    memo += notes.join(', ') + `, Expected Total: $${expectedTotal.toFixed(2)}`;
    fields.memo = memo.length <= 999 ? memo : ogMemo;
    return fields;
}

/**
 * - {@link addEncodedExternalIdSearchOption}
 * - {@link appendMemo}
 * - {@link lineItemComposer}
 */
const SALES_ORDER_COMPOSE_OPTIONS: ComposeOptions = {
    recordType: RecordTypeEnum.SALES_ORDER,
    idOptions: { composer: addEncodedExternalIdSearchOption },
    fields: { composer: appendMemo },
    sublists: {
        item: { composer: lineItemComposer }
    }
}
export const SALES_ORDER_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    operationOrder: [PostProcessingOperationEnum.CLONE, PostProcessingOperationEnum.COMPOSE, PostProcessingOperationEnum.PRUNE],
    composeOptions: SALES_ORDER_COMPOSE_OPTIONS,
    pruneFunc: prune.salesOrder,
}


export const SO_CUSTOMER_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: SO.ENTITY_ID,
    fieldOptions: {
        entityid: { evaluator: evaluate.entityId, args: [SO.ENTITY_ID] },
        externalid: { evaluator: evaluate.entityExternalId, args: [RecordTypeEnum.CUSTOMER, SO.ENTITY_ID] }, // could do this in ComposeOptions instead
        companyname: { evaluator: customerEval.customerCompany, args: [SO.ENTITY_ID] },
        phone: { evaluator: evaluate.phone, args: [{ colName: SO.PHONE, minIndex: 0}] },
        altphone: { evaluator: evaluate.phone, args: [{ colName: SO.PHONE, minIndex: 1}] as Array<string | ColumnSliceOptions>  },
        email: { evaluator: evaluate.email, args: [{ colName: SO.EMAIL, minIndex: 0}] },
        altemail: { evaluator: evaluate.email, args: [{ colName: SO.EMAIL, minIndex: 1}] },
        fax: { evaluator: evaluate.phone, args: [{ colName: SO.FAX, minIndex: 0}] },
        salutation: { evaluator: evaluate.salutation, args: [undefined, ...NAME_COLUMNS] },
        firstname: { evaluator: evaluate.firstName, args: [undefined, ...NAME_COLUMNS] },
        middlename: { evaluator: evaluate.middleName, args: [undefined, ...NAME_COLUMNS] },
        lastname: { evaluator: evaluate.lastName, args: [undefined, ...NAME_COLUMNS] },
        taxable: { defaultValue: true },
        taxitem: { defaultValue: CustomerTaxItemEnum.YOUR_TAX_ITEM },
        entitystatus: { defaultValue: CustomerStatusEnum.CLOSED_WON }
    },
    sublistOptions: {
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
    }
}

export const SO_CUSTOMER_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    pruneFunc: prune.entity
}