/**
 * @file src/api/types/RecordApi.ts
 */
import { 
    FieldDictionary, 
    FieldValue, 
    idPropertyEnum, 
    idSearchOptions, 
    LogStatement, 
    RecordResponseOptions, 
    RecordResult, 
    SublistDictionary, 
    SublistLine, 
    SubrecordValue, 
} from '.';
import { EntityRecordTypeEnum, RecordTypeEnum } from '../../utils/ns/record/Record';
import { RowSourceMetaData } from 'src/utils/io';
/**
 * @typedefn **`RecordRequest`**
 * @property {RecordOptions | Array<RecordOptions>} recordOptions = {@link RecordOptions} | `Array<`{@link RecordOptions}`>`
 * - {@link RecordOptions} = `{ recordType: `{@link RecordTypeEnum}`, isDynamic?: boolean, idOptions?: `{@link idSearchOptions}`[], fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
 * @property {RecordResponseOptions} [responseOptions] = {@link RecordResponseOptions} = `{ responseFields: string | string[], responseSublists: Record<string, string | string[]> }`
 */
export type RecordRequest = {
    recordOptions: RecordOptions | Array<RecordOptions>;
    responseOptions?: RecordResponseOptions;
}

/**
 * @typedefn **`RecordResponse`**
 * @property {string | number} status - Indicates status of the request.
 * @property {string} message - A message indicating the result of the request.
 * @property {RecordResult[]} [results] - an `Array<`{@link RecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {RecordOptions[]} [rejects] - an `Array<`{@link RecordOptions}`>` containing the record options that were not successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type RecordResponse = {
    status: string | number;
    message: string;
    results?: RecordResult[];
    rejects?: RecordOptions[];
    error?: string;
    logArray: LogStatement[];
}



/**
 * @typedefn **`RecordOptions`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum} recordType - The record type to post, see {@link RecordTypeEnum}
 * @property {boolean} [isDynamic=false] - Indicates if the record should be created/loaded in dynamic mode. (defaults to false)
 * @property {idSearchOptions[]} [idOptions] - = `Array<`{@link idSearchOptions}`>` 
 * - = `{ idProp`: {@link idPropertyEnum}, `idValue`: string | number, `searchOperator`: {@link RecordOperatorEnum}` }[]`
 * - options specifying how to search for an existing record.
 */
export type RecordOptions = {
    recordType: RecordTypeEnum | EntityRecordTypeEnum;
    isDynamic?: boolean;
    idOptions?: idSearchOptions[];
    fields?: FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue };
    sublists?: SublistDictionary | { 
        [sublistId: string]: Array<SublistLine> 
            | Array<{[sublistFieldId: string]: FieldValue | SubrecordValue}> 
    };
    meta?: {
        /** 
         * info about what generated this RecordOptions object
         * e.g. {@link RowSourceMetaData} 
         * */
        dataSource: RowSourceMetaData | any;
        sourceType: string;
        [key: string]: any
    }
}

export enum SourceTypeEnum {
    FILE = 'FILE',
    /** 
     * `if` `sourceType === ROW_ARRAY` and `dataSource === number[]`, and know corresponding `filePath`,
     * then indexing `await getRows(filePath)` with numbers from `dataSource` will be accurate
     */
    ROW_ARRAY = 'ROW_ARRAY',
    ROW_SUBSET_ARRAY = 'ROW_SUBSET_ARRAY'
}


