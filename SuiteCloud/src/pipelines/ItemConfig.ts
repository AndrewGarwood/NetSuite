/**
 * @file src/pipelines/ItemConfig.ts
 */
import path from "node:path";
import { RecordResponseOptions, RecordTypeEnum } from "../api";
import { 
    CHARGE_ITEM_PARSE_OPTIONS, SERVICE_ITEM_POST_PROCESSING_OPTIONS, 
    SERVICE_ITEM_PARSE_OPTIONS, SUBTOTAL_ITEM_PARSE_OPTIONS, 
    LN_INVENTORY_ITEM_PARSE_OPTIONS, LN_INVENTORY_ITEM_POST_PROCESSING_OPTIONS,
    NON_INVENTORY_ITEM_PARSE_OPTIONS,
    NON_INVENTORY_ITEM_POST_PROCESSING_OPTIONS
} from "../parse_configurations/item/itemParseDefinition";
import { ItemPipelineOptions, ItemPipelineStageEnum } from "./types";

export const DEFAULT_ITEM_RESPONSE_OPTIONS: RecordResponseOptions = {
    fields: [
        'itemid', 'externalid', 'displayname'
    ],
    sublists: {
        price: ['pricelevel', 'price']
    }
}


export const BIN_RESPONSE_OPTIONS: RecordResponseOptions = {
    fields: ['binnumber', 'location', 'externalid']
}

export const DEFAULT_ITEM_STAGES_TO_WRITE = [
    ItemPipelineStageEnum.PUT_ITEMS
];

export const ALL_ITEM_STAGES = Object.values(ItemPipelineStageEnum);

/** `recordType: 'RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM'`*/
export const LN_INVENTORY_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { 
        [RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM]: LN_INVENTORY_ITEM_PARSE_OPTIONS 
    },
    postProcessingOptions: { 
        [RecordTypeEnum.LOT_NUMBERED_INVENTORY_ITEM]: LN_INVENTORY_ITEM_POST_PROCESSING_OPTIONS 
    },
    responseOptions: DEFAULT_ITEM_RESPONSE_OPTIONS,
    clearLogFiles: [],
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}

export const NON_INVENTORY_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.NON_INVENTORY_ITEM]: NON_INVENTORY_ITEM_PARSE_OPTIONS },
    postProcessingOptions: { [RecordTypeEnum.NON_INVENTORY_ITEM]: NON_INVENTORY_ITEM_POST_PROCESSING_OPTIONS },
    // outDir: path.join(CLOUD_LOG_DIR, 'items'),
    responseOptions: DEFAULT_ITEM_RESPONSE_OPTIONS,
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}

export const SERVICE_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.SERVICE_ITEM]: SERVICE_ITEM_PARSE_OPTIONS },
    postProcessingOptions: { [RecordTypeEnum.SERVICE_ITEM]: SERVICE_ITEM_POST_PROCESSING_OPTIONS },
    clearLogFiles: [],
    // outDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}

export const CHARGE_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.OTHER_CHARGE_ITEM]: CHARGE_ITEM_PARSE_OPTIONS },
    postProcessingOptions: { [RecordTypeEnum.OTHER_CHARGE_ITEM]: SERVICE_ITEM_POST_PROCESSING_OPTIONS },
    clearLogFiles: [],
    // outDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}

export const SUBTOTAL_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { 
        [RecordTypeEnum.SUBTOTAL_ITEM]: SUBTOTAL_ITEM_PARSE_OPTIONS 
    },
    clearLogFiles: [],
    // outDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}