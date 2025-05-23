/**
 * @file src/utils/api/types/PostRequests.ts
 */
import { FieldDictionary, FieldValue, LogStatement, SublistDictionary } from '.';
import { RecordTypeEnum, EntityRecordTypeEnum } from '../../NS';


/**
 * @typedefn **`PostRecordResult`**
 * @property {number} internalId - The `'internalid'` of the posted record.
 * @property {RecordTypeEnum | string} recordType - The type of the record posted to.
 * @property {FieldValue} [fieldId] - `(optional)` optionally include other `fieldId(s)` of the record's body that you want included in the response.
 */
export type PostRecordResult = { 
    internalId: number;
    recordType: RecordTypeEnum | string; 
    [fieldId: string]: FieldValue; 
};

/**
 * Definition of Request body for the {@link post} function in POST_BatchUpsertRecord.js
 * @typedefn **`BatchPostRecordRequest`**
 * @property {Array<PostRecordOptions>} [upsertRecordArray] 
 * - `Array<`{@link PostRecordOptions}`>` to post records in NetSuite.
 * @property {{[K in RecordTypeEnum]?: Array<PostRecordOptions>}} [upsertRecordDict] 
 * - `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link PostRecordOptions}`>>` to post records in NetSuite.
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internalids.
 */
export type BatchPostRecordRequest = {
    /** `Array<`{@link PostRecordOptions}`>` to post records in NetSuite. */
    upsertRecordArray?: PostRecordOptions[];
    /** `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link PostRecordOptions}`>>` to post records in NetSuite. */
    upsertRecordDict?: { [K in RecordTypeEnum]?: PostRecordOptions[] };
    /** `string | string[]` - The properties to include in the response in addition to the records' internal IDs. */
    responseProps?: string | string[];
}

/**
 * Definition of Response for the post function in POST_BatchUpsertRecord.js
 * @typedefn **`BatchPostRecordResponse`**
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} [results] - an `Array<`{@link PostRecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type BatchPostRecordResponse = {
    success: boolean;
    message: string;
    results?: PostRecordResult[];
    error?: string;
    logArray: LogStatement[];
}

// PostRecordOptions
/**
 * @typedefn **`PostRecordOptions`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum} recordType - The record type to post, see {@link RecordTypeEnum}
 * @property {FieldDictionary} [fieldDict] a dictionary of field IDs and values.
 * - {@link FieldDictionary} = `{ valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`.
 * @property {SublistDictionary} [sublistDict] an object containing sublist IDs mapped to a dictionary of field IDs and values.
 * - {@link SublistDictionary} = `Record<[sublistId: string]`, {@link SublistFieldDictionary}`>` 
 * - - = `{ sublistId`: `{ valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> } }`.
 */
export type PostRecordOptions = {
    recordType: RecordTypeEnum | EntityRecordTypeEnum;
    fieldDict?: Omit<FieldDictionary, 'priorityFields' | 'textFields'>;
    sublistDict?: SublistDictionary;
}


/**
 * @deprecated
 * - `createRecordArray` and `createRecordDict` are mutually exclusive
 * - Definition of Request body for the POST function in POST_BatchCreateRecord.js - Can create record in batches by defining the request's body, reqBody, in two ways. 
 * @typedefn `BatchCreateRecordRequest`
 * @property {Array<CreateRecordOptions>} [createRecordArray]
 * `Array<`{@link CreateRecordOptions}`>` = `{ recordType`: {@link RecordTypeEnum}, `isDynamic`?: boolean=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }[]`
 * @property {{[K in RecordTypeEnum]?: Array<CreateRecordOptions>}} [createRecordDict] 
     * `{` [K in {@link RecordTypeEnum}]?: `Array<`{@link CreateRecordOptions}`> }`
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internal IDs.
*/
export type BatchCreateRecordRequest = {
    /** = `Array<`{@link CreateRecordOptions}`>` = `{ recordType`: {@link RecordTypeEnum}, `isDynamic`?: boolean=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }[]` */
    createRecordArray?: CreateRecordOptions[];
    /** = `{` [K in {@link RecordTypeEnum}]?: `Array<`{@link CreateRecordOptions}`> }` */
    createRecordDict?: { [K in RecordTypeEnum]?: CreateRecordOptions[] };
    /** = `string | string[]` - The properties to include in the response in addition to the records' internal IDs. */
    responseProps?: string | string[];
}


/**
 * @deprecated
 * Definition of the request body for the POST function in POST_CreateRecord.js
 * @typedefn `CreateRecordRequest`
 * @property {CreateRecordOptions} options - The options for creating the record. {@link CreateRecordOptions} = { `recordType`: {@link RecordTypeEnum}, `isDynamic`?: boolean=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary} }.
 * @property {string | string[]} [responseProps] - The properties to include in the response in addition to the record's `'internalid'`.
 */
export type CreateRecordRequest = {
    options: CreateRecordOptions;
    responseProps?: string | string[];
}

/**
 * @deprecated
 * @typedefn `CreateRecordResponse`
 * @property {boolean} success - Indicates if the record was created successfully.
 * @property {PostRecordResult} result - The result of the record creation, including the `'internalid'` and any other properties specified in {@link CreateRecordRequest.responseProps}.
 * @property {string} message - A message indicating the result of the operation.
 * @property {Array<LogStatement>} logArray - `Array<`{@link LogStatement}`>` generated by logs written during the POST requeset.
 */
export type CreateRecordResponse = {
    success: boolean;
    result: PostRecordResult;
    message: string;
    logArray: Array<LogStatement>;
}


/**
 * @deprecated
 * Definition of Response for the POST function in POST_BatchCreateRecord.js
 * @typedefn `BatchCreateRecordResponse`
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} results - an `Array<`{@link PostRecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully created.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type BatchCreateRecordResponse = {
    success: boolean;
    message: string;
    results: PostRecordResult[];
    error?: string;
    logArray: LogStatement[];
};

/**
 * @deprecated
 * @typedefn `CreateRecordOptions`
 * @property {RecordTypeEnum} recordType - The record type to create, see {@link RecordTypeEnum}
 * @property {boolean} [isDynamic=false] - Indicates if the record should be created in dynamic mode. (defaults to false)
 * @property {FieldDictionary} [fieldDict] 
 * - {@link FieldDictionary} = { `priorityFields`: Array<{@link SetFieldValueOptions}>, `textFields`: Array<{@link SetFieldTextOptions}>, `valueFields`: Array<{@link SetFieldValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> }.
 * - an object containing field IDs and their corresponding values.
 * @property {SublistDictionary} [sublistDict] 
 * - {@link SublistDictionary} = Record<[`sublistId`: string], {@link SublistFieldDictionary}> = { `sublistId`: { `priorityFields`: Array<{@link SetFieldValueOptions}>, `textFields`: Array<{@link SetSublistTextOptions}>, `valueFields`: Array<{@link SetSublistValueOptions}>, `subrecordFields`: Array<{@link SetSubrecordOptions}> } }.
 * - an object containing sublist IDs and their corresponding field IDs and values.
 */
export type CreateRecordOptions = {
    recordType: RecordTypeEnum;
    isDynamic?: boolean;
    fieldDict?: FieldDictionary;
    sublistDict?: SublistDictionary;
};