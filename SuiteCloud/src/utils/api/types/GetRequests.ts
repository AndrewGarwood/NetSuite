/**
 * @file src/utils/api/types/GetRequests.ts
 */
import { idPropertyEnum, RecordTypeEnum } from ".";


/**
 * @typedefn **`RetrieveRecordByIdRequest`**
 * @property {RecordTypeEnum} recordType - The type of the record to retrieve. see {@link RecordTypeEnum}
 * @property {idPropertyEnum} idProperty - The property to search for the record. see {@link idPropertyEnum}
 * @property {string} searchTerm - The name of the record to search for.
 */
export type RetrieveRecordByIdRequest = {
    recordType: RecordTypeEnum;
    idProperty: idPropertyEnum;
    searchTerm: string;
};


/**
 * @typedefn **`RetrieveRecordByIdResponse`**
 * @property {boolean} success - Whether the record was found or not.
 * @property {string} message - The message to return.
 * @property {string | number} [internalId] - The internal ID of the record, if found.
 */
export type RetrieveRecordByIdResponse ={
    success: boolean;
    message: string;
    internalId?: string | number;
};