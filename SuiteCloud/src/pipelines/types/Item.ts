import { RecordResponseOptions } from "@api/types";
import { ParseOptions } from "@utils/io/types/ParseOptions";
import { ProcessParseResultsOptions } from "@utils/io/types/PostProcessing";



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
    parseOptions: ParseOptions;
    postProcessingOptions?: ProcessParseResultsOptions;
    /** `RecordResponseOptions` for the item put request */
    responseOptions?: RecordResponseOptions;
    clearLogFiles?: string[];
    /**
     * if `outputDir` is a valid directory, 
     * `entityProcessor` will write output data from stages in `stagesToWrite` here. 
     * */
    outputDir?: string;
    /** specify at which stage(s) that data being processed should be written to `outputDir` */
    stagesToWrite?: ItemPipelineStageEnum[];
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: ItemPipelineStageEnum;
}