/**
 * @file src/parse_configurations/item/itemParseDefinition.ts
 */
import { mainLogger as mlog, INDENT_LOG_LINE as TAB } from "../../config/setupLog";
import { 
    FieldParseOptions,
    FieldDictionaryParseOptions,
    SublistDictionaryParseOptions,
    SublistLineParseOptions,
    RecordParseOptions, 
} from "../../services/parse/types/index";
import {
    RecordPostProcessingOptions,
    ComposeOptions,
} from "../../services/post_process/types/PostProcessing";
import { getAccountDictionary, getWarehouseRows } from "../../config/dataLoader";
import { ItemColumnEnum as C } from "./itemConstants";
import * as evaluate from "../evaluators";
import * as prune from "../pruneFunctions";
import { RecordTypeEnum, AccountTypeEnum, AccountDictionary } from "../../utils/ns";
import { RecordOptions } from "../../api/types/RecordEndpoint";
import { hasKeys, isNonEmptyString, isNullLike } from "typeshi/dist/utils/typeValidation";
import { FieldDictionary, SublistDictionary } from "../../api";
import { WarehouseColumnEnum, WarehouseRow } from "src/pipelines/types/Warehouse";
import { getIndexedColumnValues } from "typeshi/dist/utils/io/";

enum LocationEnum {
    HQ = 1,
    A = 2,
    B = 3,
    C = 4,
}
enum TaxScheduleEnum {
    DEFAULT = 2
}
enum PriceLevelEnum {
    BASE_PRICE = 1
}
const ITEM_ID_ARGS: any[] = [C.ITEM_ID, evaluate.CLEAN_ITEM_ID_OPTIONS];

export const LN_INVENTORY_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, 
            args: [RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM, evaluate.itemId, ...ITEM_ID_ARGS] 
        },
        itemid: { evaluator: evaluate.itemId, args: ITEM_ID_ARGS },
        displayname: { evaluator: evaluate.displayName, args: [C.DESCRIPTION, ...ITEM_ID_ARGS] },
        salesdescription: { evaluator: evaluate.description, args: [C.DESCRIPTION] },
        purchasedescription: { evaluator: evaluate.description, args: [C.PURCHASE_DESCRIPTION] },
        costingmethod: { defaultValue: 'FIFO' },
        cost: { colName: C.COST },
        usebins: { defaultValue: true },
        location: { defaultValue: LocationEnum.HQ },
        taxschedule: { defaultValue: TaxScheduleEnum.DEFAULT },
        gainlossaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ACCOUNT, AccountTypeEnum.INCOME, AccountTypeEnum.OTHER_INCOME, 
                AccountTypeEnum.EXPENSE, AccountTypeEnum.OTHER_EXPENSE
            ] 
        },
        cogsaccount: { evaluator: evaluate.accountInternalId, 
            args: [
                C.ACCOUNT, AccountTypeEnum.COST_OF_GOODS_SOLD,
            ] 
        },
        assetaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ASSET_ACCOUNT,AccountTypeEnum.FIXED_ASSET, AccountTypeEnum.OTHER_ASSET, 
                AccountTypeEnum.OTHER_CURRENT_ASSET
            ]
        },
        mpn: { colName: C.MPN }
    } as FieldDictionaryParseOptions,
    sublistOptions: {
        price1: [
            {
                pricelevel: { defaultValue: PriceLevelEnum.BASE_PRICE },
                price: { colName: C.PRICE } as FieldParseOptions
            }
        ] as SublistLineParseOptions[]
    } as SublistDictionaryParseOptions
}

export const NON_INVENTORY_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, 
            args: [RecordTypeEnum.NON_INVENTORY_ITEM, evaluate.itemId, ...ITEM_ID_ARGS] 
        },
        itemid: { evaluator: evaluate.itemId, args: ITEM_ID_ARGS },
        displayname: { evaluator: evaluate.displayName, args: [C.DESCRIPTION, ...ITEM_ID_ARGS] },
        salesdescription: { evaluator: evaluate.description, args: [C.DESCRIPTION] },
        purchasedescription: { evaluator: evaluate.description, args: [C.PURCHASE_DESCRIPTION] },
        cost: { colName: C.COST },
        location: { defaultValue: LocationEnum.HQ },
        taxschedule: { defaultValue: TaxScheduleEnum.DEFAULT },
        incomeaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ACCOUNT, AccountTypeEnum.INCOME, AccountTypeEnum.OTHER_INCOME] 
        },
        mpn: { colName: C.MPN }
    } as FieldDictionaryParseOptions,
    sublistOptions: {
        price: [
            {
                pricelevel: { defaultValue: PriceLevelEnum.BASE_PRICE },
                price: { colName: C.PRICE } as FieldParseOptions
            }
        ] as SublistLineParseOptions[]
    } as SublistDictionaryParseOptions
}

export const SERVICE_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, args: [RecordTypeEnum.SERVICE_ITEM, evaluate.itemId, ...ITEM_ID_ARGS] },
        itemid: { evaluator: evaluate.itemId, args: ITEM_ID_ARGS },
        displayname: { evaluator: evaluate.displayName, args: [C.DESCRIPTION, ...ITEM_ID_ARGS] },
        salesdescription: {evaluator: evaluate.description, 
            args: [C.DESCRIPTION, C.PURCHASE_DESCRIPTION] 
        },
        cost: { colName: C.COST },
        // class: {},
        location: { defaultValue: LocationEnum.HQ },
        taxschedule: { defaultValue: TaxScheduleEnum.DEFAULT },
        incomeaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ACCOUNT, AccountTypeEnum.INCOME, AccountTypeEnum.OTHER_INCOME] 
        },
        expenseaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ACCOUNT, AccountTypeEnum.EXPENSE, AccountTypeEnum.OTHER_EXPENSE] 
        },
    } as FieldDictionaryParseOptions,
    sublistOptions: {
        price: [
            {
                pricelevel: { defaultValue: PriceLevelEnum.BASE_PRICE },
                price: { colName: C.PRICE } as FieldParseOptions
            }
        ] as SublistLineParseOptions[]
    } as SublistDictionaryParseOptions
}

export const CHARGE_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, 
            args: [RecordTypeEnum.OTHER_CHARGE_ITEM, evaluate.itemId, ...ITEM_ID_ARGS] 
        },
        itemid: { evaluator: evaluate.itemId, args: ITEM_ID_ARGS },
        displayname: { evaluator: evaluate.displayName, args: [C.DESCRIPTION, ...ITEM_ID_ARGS] },
        salesdescription: {evaluator: evaluate.description, 
            args: [C.DESCRIPTION, C.PURCHASE_DESCRIPTION] 
        },
        cost: { colName: C.COST },
        location: { defaultValue: LocationEnum.HQ },
        taxschedule: { defaultValue: TaxScheduleEnum.DEFAULT },
        incomeaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ACCOUNT, AccountTypeEnum.INCOME, AccountTypeEnum.OTHER_INCOME] 
        },
        expenseaccount: { evaluator: evaluate.accountInternalId, 
            args: [C.ACCOUNT, AccountTypeEnum.EXPENSE, AccountTypeEnum.OTHER_EXPENSE] 
        },
    } as FieldDictionaryParseOptions,
    sublistOptions: {
        price1: [
            {
                pricelevel: { defaultValue: PriceLevelEnum.BASE_PRICE },
                price: { colName: C.PRICE } as FieldParseOptions
            }
        ] as SublistLineParseOptions[]
    } as SublistDictionaryParseOptions
}

export const SUBTOTAL_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, 
            args: [RecordTypeEnum.OTHER_CHARGE_ITEM, evaluate.itemId, ...ITEM_ID_ARGS] 
        },
        itemid: { evaluator: evaluate.itemId, args: ITEM_ID_ARGS },
        displayname: { evaluator: evaluate.displayName, args: [C.DESCRIPTION, ...ITEM_ID_ARGS] },
        description: {evaluator: evaluate.description, 
            args: [C.DESCRIPTION, C.PURCHASE_DESCRIPTION] 
        },
        location: { defaultValue: LocationEnum.HQ },
    } as FieldDictionaryParseOptions,
}


export const nonInventoryItemComposer = async (
    record: RecordOptions,
    fields: FieldDictionary
): Promise<FieldDictionary> => {
    let acctDict = await getAccountDictionary() as AccountDictionary;
    let incomeDict = acctDict.Income ?? {};
    if (isNullLike(fields.incomeaccount)) {
        fields.incomeaccount = Number(incomeDict["Product Sales"]);
    }
    return fields;
}

let wItems: Record<string, number[]> | null = null;

export const inventoryItemFieldComposer = async (
    record: RecordOptions,
    fields: FieldDictionary
): Promise<FieldDictionary> => {
    const source = `[inventoryItemFieldComposer()]`
    let acctDict = await getAccountDictionary() as AccountDictionary;
    let cogsDict = acctDict["Cost of Goods Sold"] ?? {};
    let assetDict = acctDict["Other Current Asset"] ?? {}
    if (isNullLike(fields.cogsaccount)) {
        fields.cogsaccount = Number(cogsDict["Cost of Goods Sold"]);
    }
    if (isNullLike(fields.assetaccount)) {
        fields.assetaccount = Number(assetDict["Inventory Part"]);
    }
    const itemId = fields.itemid as string;
    if (!isNonEmptyString(itemId)) {
        throw new Error(`${source} Invalid RecordOptions: fields.itemid is undefined`);
    }
    const wRows = await getWarehouseRows() as WarehouseRow[];
    if (!wItems) wItems = await getIndexedColumnValues(wRows, WarehouseColumnEnum.ITEM_ID);
    const indexedWarehouseItems = wItems;
    if (hasKeys(indexedWarehouseItems, itemId)) {
        let rowIndex = indexedWarehouseItems[itemId][0];
        let loc = Number(wRows[rowIndex][WarehouseColumnEnum.LOCATION_INTERNAL_ID]);
        if (Number.isInteger(loc)) fields.location = loc;
    }
    return fields;
}

export const inventoryItemSublistComposer = async (
    record: RecordOptions,
    sublists: SublistDictionary
): Promise<SublistDictionary> => {
    const source = `[inventoryItemSublistComposer()]`;
    const fields = record.fields ?? {} as FieldDictionary;
    const itemId = fields.itemid as string;
    if (!isNonEmptyString(itemId)) {
        throw new Error(`${source} Invalid RecordOptions: fields.itemid is undefined`);
    }
    const wRows = await getWarehouseRows() as WarehouseRow[];
    if (!wItems) wItems = await getIndexedColumnValues(wRows, WarehouseColumnEnum.ITEM_ID);
    const indexedWarehouseItems = wItems;
    if (hasKeys(indexedWarehouseItems, itemId)) {
        let rowIndex = indexedWarehouseItems[itemId][0];
        // let loc = Number(wRows[rowIndex][WarehouseColumnEnum.LOCATION_INTERNAL_ID]);
        let bin = Number(wRows[rowIndex][WarehouseColumnEnum.BIN_INTERNAL_ID]);
        // if (Number.isInteger(loc)) sublists.locations = [{location: loc}];
        if (Number.isInteger(bin)) sublists.binnumber = [{binnumber: bin}];
    }
    return sublists;
}


export const SERVICE_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    pruneFunc: prune.item,
    pruneArgs: [['expenseaccount', 'incomeaccount'], false]
}

/** `recordType: RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM` */
export const LN_INVENTORY_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    composeOptions: {
        recordType: RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM,
        fields: { composer: inventoryItemFieldComposer },
        sublists: { composer: inventoryItemSublistComposer }
    } as ComposeOptions,
    pruneFunc: prune.item,
    pruneArgs: [['cogsaccount', 'assetaccount'], true]
}
export const NON_INVENTORY_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    composeOptions: {
        recordType: RecordTypeEnum.NON_INVENTORY_ITEM,
        fields: { composer: nonInventoryItemComposer }
    } as ComposeOptions,
    pruneFunc: prune.item,
    pruneArgs: [['incomeaccount'], true]
}