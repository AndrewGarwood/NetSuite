/**
 * @file src/utils/api/types/PostRequests.ts
 */
import { 
    EntityRecordTypeEnum, FieldDictionary, FieldValue, idPropertyEnum, 
    LogStatement, NumericOperatorEnum, RecordOperatorEnum, RecordTypeEnum, 
    SearchOperatorEnum, SublistDictionary, SublistLine, SubrecordValue, TextOperatorEnum 
} from '.';

/**Type: PostRecordRequest {@link PostRecordRequest} */
/**
 * @typedefn **`PostRecordRequest`**
 * @property {PostRecordOptions | Array<PostRecordOptions>} postOptions = {@link PostRecordOptions} | `Array<`{@link PostRecordOptions}`>`
 * - {@link PostRecordOptions} = `{ recordType: `{@link RecordTypeEnum}`, isDynamic?: boolean, idOptions?: `{@link idSearchOptions}`[], fields?: `{@link FieldDictionary}`, sublists?: `{@link SublistDictionary}` }`
 * @property {PostResponseOptions} [responseOptions] = {@link PostResponseOptions} = `{ responseFields: string | string[], responseSublists: Record<string, string | string[]> }`
 */
export type PostRecordRequest = {
    postOptions: PostRecordOptions | Array<PostRecordOptions>;
    responseOptions?: PostResponseOptions;
}

/**
 * @typedefn **`PostRecordResponse`**
 * @property {string | number} status - Indicates status of the request.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} [results] - an `Array<`{@link PostRecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {PostRecordOptions[]} [rejects] - an `Array<`{@link PostRecordOptions}`>` containing the record options that were not successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type PostRecordResponse = {
    status: string | number;
    message: string;
    results?: PostRecordResult[];
    rejects?: PostRecordOptions[];
    error?: string;
    logArray: LogStatement[];
}

/**
 * @typedefn **`PostResponseOptions`**
 * @property {string | string[]} [responseFields] - `fieldId(s)` of the main record to return in the response.
 * @property {Record<string, string | string[]>} [responseSublists] `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response.
 */
export type PostResponseOptions = {
    /** `fieldId(s)` of the main record to return in the response. */
    responseFields?: string | string[];
    /** `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response. */
    responseSublists?: Record<string, string | string[]>;
}

/**
 * @typedefn **`PostRecordResult`**
 * @property {number} internalid
 * @property {string | RecordTypeEnum} recordType
 * @property {FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue } } fields
 * @property {SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> } } sublists
 */
export type PostRecordResult = { 
    internalid: number;
    recordType: RecordTypeEnum | string; 
    fields?: FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue };
    sublists?: SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> }; 
};


// PostRecordOptions
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
    sublists?: SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> };
}

/**
 * @typedefn **`idSearchOptions`**
 * @property {idPropertyEnum} idProp - The property to search for. See {@link idPropertyEnum}
 * @property {RecordOperatorEnum} searchOperator - The operator to use for the search. See {@link RecordOperatorEnum}
 * @property {string | number | string[] | number[]} idValue - The value(s) of the property to search for.
 */
export type idSearchOptions = {
    idProp: idPropertyEnum;
    searchOperator: RecordOperatorEnum | SearchOperatorEnum | TextOperatorEnum | NumericOperatorEnum;
    idValue: string | number | string[] | number[];
}


