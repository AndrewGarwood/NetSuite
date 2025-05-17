/**
 * @file src/utils/api/types/PostRequests.ts
 */
import { FieldDictionary, FieldValue, LogStatement, SublistDictionary } from '.';
import { RecordTypeEnum } from './NS/Record/Record';


/**
 * @typedefn **`PostRecordResult`**
 * @property {number} internalId - The internal ID of the created record.
 * @property {RecordTypeEnum | string} recordType - The type of the record created.
 * @property {FieldValue} [fieldId] - (optional) optionally include other fields of the record's body that you want included in the response.
 */
export type PostRecordResult = { 
    internalId: number;
    recordType: RecordTypeEnum | string; 
    [fieldId: string]: FieldValue; 
};

/**
 * Definition of Request body for the {@link post} function in POST_BatchUpsertRecord.js
 * @typedefn **`BatchUpsertRecordRequest`**
 * @property {Array<UpsertRecordOptions>} [upsertRecordArray] 
 * - `Array<`{@link UpsertRecordOptions}`>` to create records in NetSuite.
 * @property {{[K in RecordTypeEnum]?: Array<UpsertRecordOptions>}} [upsertRecordDict] 
 * - `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link UpsertRecordOptions}`>>` to create records in NetSuite.
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internalids.
 */
export type BatchUpsertRecordRequest = {
    /** `Array<`{@link UpsertRecordOptions}`>` to create records in NetSuite. */
    upsertRecordArray?: UpsertRecordOptions[];
    /** `Record<`[K in {@link RecordTypeEnum}]?: `Array<`{@link UpsertRecordOptions}`>>` to create records in NetSuite. */
    upsertRecordDict?: { [K in RecordTypeEnum]?: UpsertRecordOptions[] };
    /** `string | string[]` - The properties to include in the response in addition to the records' internal IDs. */
    responseProps?: string | string[];
}

/**
 * Definition of Response for the post function in POST_BatchUpsertRecord.js
 * @typedefn **`BatchUpsertRecordResponse`**
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {PostRecordResult[]} [results] - an `Array<`{@link PostRecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type BatchUpsertRecordResponse = {
    success: boolean;
    message: string;
    results?: PostRecordResult[];
    error?: string;
    logArray: LogStatement[];
}

// UpsertRecordOptions
/**
 * @typedefn **`UpsertRecordOptions`**
 * @property {RecordTypeEnum} recordType - The record type to create, see {@link RecordTypeEnum}
 * @property {FieldDictionary} [fieldDict] a dictionary of field IDs and values.
 * - {@link FieldDictionary} = `{ valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`.
 * @property {SublistDictionary} [sublistDict] an object containing sublist IDs mapped to a dictionary of field IDs and values.
 * - {@link SublistDictionary} = `Record<[sublistId: string]`, {@link SublistFieldDictionary}`>` 
 * - - = `{ sublistId`: `{ valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> } }`.
 */
export type UpsertRecordOptions = {
    recordType: RecordTypeEnum;
    fieldDict?: Omit<FieldDictionary, 'priorityFields' | 'textFields'>;
    sublistDict?: SublistDictionary;
}


/**
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
 * Definition of the request body for the POST function in POST_CreateRecord.js
 * @typedefn `CreateRecordRequest`
 * @property {CreateRecordOptions} options - The options for creating the record. {@link CreateRecordOptions} = { `recordType`: {@link RecordTypeEnum}, `isDynamic`?: boolean=false, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary} }.
 * @property {string | string[]} [responseProps] - The properties to include in the response in addition to the record's internal ID.
 */
export type CreateRecordRequest = {
    options: CreateRecordOptions;
    responseProps?: string | string[];
}

/**
 * @typedefn `CreateRecordResponse`
 * @property {boolean} success - Indicates if the record was created successfully.
 * @property {PostRecordResult} result - The result of the record creation, including the internal ID and any other properties specified in {@link CreateRecordRequest.responseProps}.
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