/**
 * @file src/utils/api/types/GetRequests.ts
 */
import { 
    idPropertyEnum, idSearchOptions, LogStatement, RecordResponseOptions, 
    RecordResult, RecordTypeEnum 
} from ".";

/**
 * @typedefn **`GetRecordRequest`**
 * @property {string | RecordTypeEnum} recordType - The record type to get, see {@link RecordTypeEnum}.
 * @property {idSearchOptions[]} [idOptions] {@link idSearchOptions}`[]`
 * @property {RecordResponseOptions} [responseOptions] {@link RecordResponseOptions} = `{ responseFields?: string | string[], responseSublists?: Record<string, string | string[]> }`
 */
export type GetRecordRequest = {
    recordType: string | RecordTypeEnum;
    idOptions: idSearchOptions[];
    responseOptions?: RecordResponseOptions;
};
/**
 * @typedefn **`GetRecordResponse`**
 */
export type GetRecordResponse = {
    status: number;
    message: string;
    error?: string;
    logArray: LogStatement[];
    records?: RecordResult[];
};