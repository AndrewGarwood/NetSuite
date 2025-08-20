/**
 * @file src/pipelines/TransactionConfig.ts
 */

import path from "node:path";
import { EntityRecordTypeEnum, RecordResponseOptions, RecordTypeEnum } from "../api";
import { DATA_DIR } from "../config/env";
import * as soConstants from "../parse_configurations/salesorder/salesOrderConstants";
import { SALES_ORDER_POST_PROCESSING_OPTIONS, SALES_ORDER_PARSE_OPTIONS } from "../parse_configurations/salesorder/salesOrderParseDefinition";
import { 
    LocalFileMatchOptions, MatchSourceEnum, 
    TransactionEntityMatchOptions, TransactionMainPipelineOptions, 
    TransactionMainPipelineStageEnum 
} from "./types";
import { ParseDictionary } from "src/services/parse/types/index";
import { PostProcessDictionary } from "src/services/post_process/types/PostProcessing";


/** 
 * `responseFields`: `[
 * 'tranid', 'trandate', 'entity', 'externalid', 
 * 'otherrefnum', 'orderstatus', 'total'
 * ]` 
 * */
export const DEFAULT_SALES_ORDER_RESPONSE_OPTIONS: RecordResponseOptions = {
    fields: [
        'tranid', 'trandate', 'entity', 'externalid', 'otherrefnum', 
        'orderstatus', 'total'
    ]
};
export const DEFAULT_TRANSACTION_STAGES_TO_WRITE = [
    TransactionMainPipelineStageEnum.PUT_SALES_ORDERS
];
export const ALL_TRANSACTION_STAGES = Object.values(TransactionMainPipelineStageEnum);

// not used since we are matching with api
export const DEFAULT_LOCAL_FILE_OPTIONS: LocalFileMatchOptions = { 
    filePath: path.join(DATA_DIR, 'uploaded', 'customer.tsv'),
    targetValueColumn: 'Name',
    internalIdColumn: 'Internal ID'
} as LocalFileMatchOptions

export const DEFAULT_MATCH_OPTIONS: TransactionEntityMatchOptions = {
    entityType: EntityRecordTypeEnum.CUSTOMER,
    entityFieldId: 'entity',
    matchMethod: MatchSourceEnum.API,
};

export const SALES_ORDER_PIPELINE_CONFIG: TransactionMainPipelineOptions = {
    parseOptions: { 
        [RecordTypeEnum.SALES_ORDER]: SALES_ORDER_PARSE_OPTIONS 
    } as ParseDictionary,
    postProcessingOptions: { 
        [RecordTypeEnum.SALES_ORDER]: SALES_ORDER_POST_PROCESSING_OPTIONS 
    } as PostProcessDictionary,
    matchOptions: DEFAULT_MATCH_OPTIONS,
    generateMissingEntities: true,
    outputDir: soConstants.SALES_ORDER_LOG_DIR,
    stagesToWrite: [
        // TransactionPipelineStageEnum.PARSE,
        TransactionMainPipelineStageEnum.PUT_SALES_ORDERS
    ],
    stopAfter: TransactionMainPipelineStageEnum.END
}