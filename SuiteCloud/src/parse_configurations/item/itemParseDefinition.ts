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
    RecordPostProcessingOptions,
    ComposeOptions
} from "../../utils/io";
import { getAccountDictionary } from "../../config/dataLoader";
import { ItemColumnEnum as C } from "./itemConstants";
import * as evaluate from "../evaluators";
import { RecordTypeEnum, AccountTypeEnum, AccountDictionary } from "../../utils/ns";
import { RecordOptions } from "../../api/types/RecordEndpoint";
import { hasKeys, isNonEmptyString, isNullLike } from "../../utils/typeValidation";
import { FieldDictionary } from "../../api";

enum LocationEnum {
    HQ = 1,
    A = 2,
    C = 3,
}
enum TaxScheduleEnum {
    DEFAULT = 2
}
enum PriceLevelEnum {
    BASE_PRICE = 1
}
const ITEM_ID_ARGS: any[] = [C.ITEM_ID, evaluate.CLEAN_ITEM_ID_OPTIONS];

export const INVENTORY_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, 
            args: [RecordTypeEnum.INVENTORY_ITEM, evaluate.itemId, ...ITEM_ID_ARGS] 
        },
        itemid: { evaluator: evaluate.itemId, args: ITEM_ID_ARGS },
        displayname: { evaluator: evaluate.displayName, args: [C.DESCRIPTION, ...ITEM_ID_ARGS] },
        salesdescription: { evaluator: evaluate.description, args: [C.DESCRIPTION] },
        purchasedescription: { evaluator: evaluate.description, args: [C.PURCHASE_DESCRIPTION] },
        cost: { colName: C.COST },
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
        price1: [
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
        price1: [
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

export const inventoryItemComposer = async (
    record: RecordOptions,
    fields: FieldDictionary
): Promise<FieldDictionary> => {
    let acctDict = await getAccountDictionary() as AccountDictionary;
    let cogsDict = acctDict["Cost of Goods Sold"] ?? {};
    let assetDict = acctDict["Other Current Asset"] ?? {}
    if (isNullLike(fields.cogsaccount)) {
        fields.cogsaccount = Number(cogsDict["Cost of Goods Sold"]);
    }
    if (isNullLike(fields.assetaccount)) {
        fields.assetaccount = Number(assetDict["Inventory Part"]);
    }
    // mlog.debug([`[itemParseDefinition.composeAccounts()] comparing acct values`,
    //     ` fields.cogsaccount: '${fields.cogsaccount}'`,
    //     `fields.assetaccount: '${fields.assetaccount}'`,
    //     `fields.incomeaccunt: '${fields.incomeaccount}'`
    // ].join(TAB));
    // if (fields.cogsaccount === fields.assetaccount 
    //     || fields.cogsaccount === fields.incomeaccount 
    //     || fields.asseteaccount === fields.incomeaccount) {
    //         throw new Error(`ummmm might be an issue here, there are same account vals for diff fields`)
    // }
    return fields;
}

/** check `hasKeys(options.fields, accounts, requireAll)` */
export const item = async (
    options: RecordOptions,
    accounts: string | string[],
    requireAll: boolean = false
): Promise<RecordOptions | null> => {
    if (!options || !options.fields) {
        return null;
    }
    if (!hasKeys(options.fields, accounts, requireAll)) {
        mlog.warn([
            `[prune.item()] options.fields is missing account field`,
            `  accounts: ${JSON.stringify(accounts)}`,
            `requireAll: ${requireAll}`
        ].join(TAB));
        return null;
    }
    return options;
}

export const SERVICE_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    pruneFunc: item,
    pruneArgs: [['expenseaccount', 'incomeaccount'], false]
}

export const INVENTORY_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    composeOptions: {
        recordType: RecordTypeEnum.INVENTORY_ITEM,
        fields: { composer: inventoryItemComposer }
    } as ComposeOptions,
    pruneFunc: item,
    pruneArgs: [['cogsaccount', 'assetaccount'], true]
}
export const NON_INVENTORY_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    composeOptions: {
        recordType: RecordTypeEnum.NON_INVENTORY_ITEM,
        fields: { composer: nonInventoryItemComposer }
    } as ComposeOptions,
    pruneFunc: item,
    pruneArgs: [['incomeaccount'], true]
}