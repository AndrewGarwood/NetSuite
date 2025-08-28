/**
 * @file src/pipelines/types/Item.ts
 */

import { RecordResponseOptions } from "../../api/types";
import { ParseDictionary } from "src/services/parse/types/index";
import { PostProcessDictionary } from "src/services/post_process/types/PostProcessing";



/**
 * @enum {string} **`ItemPipelineStageEnum`**
 * @property **`PARSE`** = `'PARSE'`
 * @property **`VALIDATE`** = `'VALIDATE'`
 * @property **`PUT_ITEMS`** = `'PUT_ITEMS'`
 * @property **`END`** = `'END'`
 */
export enum ItemPipelineStageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    PUT_ITEMS = 'PUT_ITEMS',
    END = 'END'
}

export type ItemPipelineOptions = {
    parseOptions: ParseDictionary;
    postProcessingOptions?: PostProcessDictionary;
    /** `RecordResponseOptions` for the item put request */
    responseOptions?: RecordResponseOptions;
    clearLogFiles?: string[];
    /**
     * if `outDir` is a valid directory, 
     * `entityProcessor` will write output data from stages in `stagesToWrite` here. 
     * */
    outDir?: string;
    /** specify at which stage(s) that data being processed should be written to `outDir` */
    stagesToWrite?: ItemPipelineStageEnum[];
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: ItemPipelineStageEnum;
}