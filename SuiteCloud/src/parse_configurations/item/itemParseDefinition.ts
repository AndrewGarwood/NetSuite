/**
 * @file src/parse_configurations/item/itemParseDefinition.ts
 */

import { 
    FieldParseOptions,
    FieldDictionaryParseOptions,
    SublistDictionaryParseOptions,
    SublistLineParseOptions,
    RecordParseOptions, 
    RecordPostProcessingOptions
} from "../../utils/io";
import { ItemColumnEnum as C } from "./itemConstants";
import * as evaluate from "../evaluators";
import { RecordTypeEnum, AccountTypeEnum } from "../../utils/ns";
import { RecordOptions } from "src/api/types/RecordEndpoint";

// seemingly unnecessary enums, but can scale up
enum LocationEnum {
    HQ = 1
}
enum TaxScheduleEnum {
    DEFAULT = 2
}
enum PriceLevelEnum {
    BASE_PRICE = 1
}
const ITEM_ID_ARGS: any[] = [C.ITEM_ID, evaluate.CLEAN_ITEM_ID_OPTIONS];
const EXTERNAL_ID_ARGS: any[] = [RecordTypeEnum.SERVICE_ITEM, evaluate.itemId, ...ITEM_ID_ARGS];

export const SERVICE_ITEM_PARSE_OPTIONS: RecordParseOptions = {
    keyColumn: C.ITEM_ID,
    fieldOptions: {
        externalid: { evaluator: evaluate.externalId, args: EXTERNAL_ID_ARGS },
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
            args: [C.INCOME_ACCOUNT, AccountTypeEnum.INCOME, AccountTypeEnum.OTHER_INCOME] 
        }
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

export const SERVICE_ITEM_POST_PROCESSING_OPTIONS: RecordPostProcessingOptions = {
    pruneFunc: (options: RecordOptions): RecordOptions => { return options } // temporary
}