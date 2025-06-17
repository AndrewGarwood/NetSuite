/**
 * @file src/utils/api/types/PostRequests.ts
 */
import { 
    EntityRecordTypeEnum, FieldDictionary, FieldValue, idPropertyEnum, 
    idSearchOptions, 
    LogStatement, NumericOperatorEnum, RecordOperatorEnum, RecordResponseOptions, RecordResult, RecordTypeEnum, 
    SearchOperatorEnum, SublistDictionary, SublistLine, SubrecordValue, TextOperatorEnum 
} from '.';

/**
 * @typedefn **`PostRecordRequest`**
 * @property {PostRecordOptions | Array<PostRecordOptions>} postOptions = {@link PostRecordOptions} | `Array<`{@link PostRecordOptions}`>`
 * - {@link PostRecordOptions} = `{ recordType: `{@link RecordTypeEnum}`, isDynamic?: boolean, idOptions?: `{@link idSearchOptions}`[], fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
 * @property {PostResponseOptions} [responseOptions] = {@link RecordResponseOptions} = `{ responseFields: string | string[], responseSublists: Record<string, string | string[]> }`
 */
export type PostRecordRequest = {
    postOptions: PostRecordOptions | Array<PostRecordOptions>;
    responseOptions?: RecordResponseOptions;
}

/**
 * @typedefn **`PostRecordResponse`**
 * @property {string | number} status - Indicates status of the request.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} [results] - an `Array<`{@link RecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {PostRecordOptions[]} [rejects] - an `Array<`{@link PostRecordOptions}`>` containing the record options that were not successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type PostRecordResponse = {
    status: string | number;
    message: string;
    results?: RecordResult[];
    rejects?: PostRecordOptions[];
    error?: string;
    logArray: LogStatement[];
}



/**
 * @typedefn **`PostRecordOptions`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum} recordType - The record type to post, see {@link RecordTypeEnum}
 * @property {boolean} [isDynamic=false] - Indicates if the record should be created/loaded in dynamic mode. (defaults to false)
 * @property {idSearchOptions[]} [idOptions] - = `Array<`{@link idSearchOptions}`>` 
 * - = `{ idProp`: {@link idPropertyEnum}, `idValue`: string | number, `searchOperator`: {@link RecordOperatorEnum}` }[]`
 * - options specifying how to search for an existing record.
 */
export type PostRecordOptions = {
    recordType: RecordTypeEnum | EntityRecordTypeEnum;
    isDynamic?: boolean;
    idOptions?: idSearchOptions[];
    fields?: FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue };
    sublists?: SublistDictionary | { [sublistId: string]: Array<SublistLine> | Array<{[sublistFieldId: string]: FieldValue | SubrecordValue}> };
}


