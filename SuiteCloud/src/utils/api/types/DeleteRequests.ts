/**
 * @file src/utils/api/types/DeleteRequests.ts
 */

import { FieldValue, RecordTypeEnum, EntityRecordTypeEnum, LogStatement } from ".";

/**
 * @typedefn **`DeleteRecordByTypeRequest`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum} recordType - The type of the record to delete (see {@link RecordTypeEnum}).
 * @property {DeleteExcludeOptions} [excludeOptions] - The options ({@link DeleteExcludeOptions}) for excluding records from deletion.
 * @property {number} [maxDeletions] - The maximum number of records to delete. If omitted, all records of the specified type will be deleted.
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internal IDs.
 */
export type DeleteRecordByTypeRequest = {
    recordType: RecordTypeEnum | EntityRecordTypeEnum;
    excludeOptions?: DeleteExcludeOptions;
    maxDeletions?: number;
    responseProps?: string | string[];
};

/**
 * @typedefn **`DeleteExcludeOptions`**
 * @property {number | number[]} [excludeIds] - The internalId(s) of the record to exclude from deletion.
 * @property {{lowerBound?: number; upperBound?: number | undefined}} [idExcludeRange] - Do NOT delete record if `lowerBound <= record.internalId <= upperBound`. `idExclusionRange.lowerBound`.
 */
export type DeleteExcludeOptions = {
    excludeIds?: number | number[];
    idExcludeRange?: { lowerBound?: number; upperBound?: number | undefined };
};


/**
 * - {@link DeleteRecordByTypeResponse.results} - The internalIds of the deleted recrods and any additional properties specified in {@link DeleteRecordByTypeRequest.responseProps}.
 * @typedefn **`DeleteRecordByTypeResponse`**
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {DeleteRecordResult[]} results - The internalIds of the deleted recrods and any additional properties specified in {@link DeleteRecordByTypeRequest.responseProps}.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type DeleteRecordByTypeResponse = {
    success: boolean;
    message: string;
    results: DeleteRecordResult[];
    error?: string;
    logArray: LogStatement[];
};

/**
 * @typedefn **`DeleteRecordResult`**
 */
export type DeleteRecordResult = {
    recordType: RecordTypeEnum | string;
    internalId: number;
    [fieldId: string]: FieldValue;
};