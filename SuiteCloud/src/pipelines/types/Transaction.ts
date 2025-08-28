/**
 * @file src/pipelines/types/Transaction.ts
 */

import { RecordResponseOptions } from "../../api/types";
import { LocalFileMatchOptions, MatchSourceEnum } from "./Pipeline";
import { EntityRecordTypeEnum } from "../../utils/ns/Enums";
import { ParseDictionary } from "src/services/parse/types/index";
import { PostProcessDictionary } from "src/services/post_process/types/PostProcessing";



/**
 * @enum **`TransactionProcessorStageEnum`** `string`
 * @property **`PARSE`** = `'PARSE'`
 * @property **`VALIDATE`** = `'VALIDATE'`
 * @property **`MATCH_ENTITY`** = `'MATCH_ENTITY'`
 * @property **`PUT_SALES_ORDERS`** = `'PUT_SALES_ORDERS'`
 * @property **`END`** = `'END'`
 */
export enum TransactionMainPipelineStageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    /** use this as value for `stopAfter` to see output of `matchTransactionEntity()` */
    MATCH_ENTITY = 'MATCH_ENTITY',
    PUT_SALES_ORDERS = 'PUT_SALES_ORDERS',
    END = 'END'
}

export type TransactionEntityMatchOptions = {
    entityType: EntityRecordTypeEnum | string;
    entityFieldId: string;
    matchMethod: MatchSourceEnum;
    localFileOptions?: LocalFileMatchOptions;
}

export type TransactionMainPipelineOptions = {
    parseOptions: ParseDictionary;
    postProcessingOptions?: PostProcessDictionary;
    /** 
     * {@link TransactionEntityMatchOptions} = `{ 
     * entityType: EntityRecordTypeEnum | string; entityFieldId: string; 
     * matchMethod: MatchSourceEnum; localFileOptions?: LocalFileMatchOptions; }` 
     * */
    matchOptions?: TransactionEntityMatchOptions;
    generateMissingEntities?: boolean;
    /** `RecordResponseOptions` for the transaction put request */
    responseOptions?: RecordResponseOptions;
    clearLogFiles?: string[];
    /**
     * if `outDir` is a valid directory, 
     * `entityProcessor` will write output data from stages in `stagesToWrite` here. 
     * */
    outDir?: string;
    /** specify at which stage(s) that data being processed should be written to `outDir` */
    stagesToWrite?: TransactionMainPipelineStageEnum[];
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: TransactionMainPipelineStageEnum;
}