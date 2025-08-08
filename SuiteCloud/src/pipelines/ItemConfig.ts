/**
 * @file src/pipelines/ItemConfig
 */
import path from "node:path";
import { RecordTypeEnum } from "../api";
import { CLOUD_LOG_DIR } from "../config/env";
import { 
    CHARGE_ITEM_PARSE_OPTIONS, SERVICE_ITEM_POST_PROCESSING_OPTIONS, 
    SERVICE_ITEM_PARSE_OPTIONS, SUBTOTAL_ITEM_PARSE_OPTIONS, 
    INVENTORY_ITEM_PARSE_OPTIONS, INVENTORY_ITEM_POST_PROCESSING_OPTIONS,
    NON_INVENTORY_ITEM_PARSE_OPTIONS,
    NON_INVENTORY_ITEM_POST_PROCESSING_OPTIONS
} from "../parse_configurations/item/itemParseDefinition";
import { ItemPipelineOptions, ItemPipelineStageEnum } from "./ItemPipeline";

export const DEFAULT_ITEM_STAGES_TO_WRITE = [
    ItemPipelineStageEnum.PUT_ITEMS
];

export const ALL_ITEM_STAGES = Object.values(ItemPipelineStageEnum);

export const INVENTORY_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.INVENTORY_ITEM]: INVENTORY_ITEM_PARSE_OPTIONS },
    postProcessingOptions: { [RecordTypeEnum.INVENTORY_ITEM]: INVENTORY_ITEM_POST_PROCESSING_OPTIONS },
    clearLogFiles: [],
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}

export const NON_INVENTORY_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.NON_INVENTORY_ITEM]: NON_INVENTORY_ITEM_PARSE_OPTIONS },
    postProcessingOptions: { [RecordTypeEnum.NON_INVENTORY_ITEM]: NON_INVENTORY_ITEM_POST_PROCESSING_OPTIONS },
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
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
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
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
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}

export const SUBTOTAL_ITEM_PIPELINE_CONFIG: ItemPipelineOptions = {
    parseOptions: { [RecordTypeEnum.SUBTOTAL_ITEM]: SUBTOTAL_ITEM_PARSE_OPTIONS },
    clearLogFiles: [],
    outputDir: path.join(CLOUD_LOG_DIR, 'items'),
    stagesToWrite: [
        // ItemPipelineStageEnum.VALIDATE, 
        ItemPipelineStageEnum.PUT_ITEMS
    ],
    stopAfter: ItemPipelineStageEnum.END
}