/**
 * @file src/api/types/RecordEndpoint.ts
 */
import { 
    NumericOperatorEnum, RecordOperatorEnum, SearchOperatorEnum, TextOperatorEnum 
} from "../../utils/ns/Enums";
import { 
    FieldValue, 
    LogStatement, 
    SubrecordValue, 
} from ".";
import { EntityRecordTypeEnum, RecordTypeEnum } from "../../utils/ns/record/Record";
import { RowSourceMetaData } from "typeshi:utils/io";
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
 * @typedefn **`SingleRecordRequest`**
 */
export type SingleRecordRequest = {
    recordType: string | RecordTypeEnum;
    idOptions: idSearchOptions[];
    responseOptions?: RecordResponseOptions;
};
/**
 * @typedefn **`RecordResponse`**
 * @property {string | number} status - Indicates status of the request.
 * @property {string} message - A message indicating the result of the request.
 * @property {RecordResult[]} results - `Array<`{@link RecordResult}`>` containing the record ids and any additional properties specified in the request for all the records successfully upserted.
 * @property {RecordOptions[]} rejects - `Array<`{@link RecordOptions}`>` containing the record options that were not successfully upserted.
 * @property {string} [error] - error message if the request was not successful.
 * @property {LogStatement[]} logArray - `Array<`{@link LogStatement}`>` generated during the request processing.
 */
export type RecordResponse = {
    status: string | number;
    message: string;
    results?: RecordResult[];
    rejects?: any[] | RecordOptions[];
    error?: string; 
    logs: LogStatement[];
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

export type RelatedRecordRequest = {
    parentRecordType: string | RecordTypeEnum;
    idOptions: idSearchOptions[];
    childOptions: ChildSearchOptions[];
}

export type ChildSearchOptions = {
    childRecordType: string | RecordTypeEnum;
    fieldId: string;
    sublistId?: string;
    responseOptions?: RecordResponseOptions
}

/**
 * @enum {string} **`SourceTypeEnum`**
 */
export enum SourceTypeEnum {
    LOCAL_FILE = 'LOCAL_FILE',
    /** 
     * `if` `sourceType === ROW_ARRAY` and `dataSource === number[]`, and know corresponding `filePath`,
     * then subsequently indexing `await getRows(filePath)` with numbers from `dataSource` will be accurate
     */
    ROW_ARRAY = 'ROW_ARRAY',
    ROW_SUBSET_ARRAY = 'ROW_SUBSET_ARRAY',
    /** assume `base64` encoded `string` */
    ENCODED_FILE_CONTENT_STRING = 'ENCODED_FILE_CONTENT_STRING',
    /** the {@link Buffer} object created from `Buffer.from(ENCODED_FILE_CONTENT_STRING, 'base64')` or `fs.readFileSync(filePath)` */
    BUFFER = 'BUFFER',
}

/**
 * @typedefn **`RecordResponseOptions`**
 * @property {string | string[]} fields - `fieldId(s)` of the main record to return in the response.
 * @property {Record<string, string | string[]>} sublists `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response.
 */
export type RecordResponseOptions = {
    /** `fieldId(s)` of the main record to return in the response. */
    fields?: string | string[];
    /** `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response. */
    sublists?: Record<string, string | string[]>;
}

/**
 * @typedefn **`RecordResult`**
 * @property {number} internalid
 * @property {string | RecordTypeEnum} recordType
 * @property {FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue } } fields
 * @property {SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> } } sublists
 */
export type RecordResult = { 
    internalid: number;
    recordType: RecordTypeEnum | string; 
    fields?: FieldDictionary | { [fieldId: string]: FieldValue | SubrecordValue };
    sublists?: SublistDictionary | { [sublistId: string]: Array<SublistLine | {[sublistFieldId: string]: FieldValue | SubrecordValue}> }; 
};


/**
 * @typedefn **`idSearchOptions`**
 * @property {idPropertyEnum} idProp - The property to search for. See {@link idPropertyEnum}
 * @property {string | number | string[] | number[]} idValue - The value(s) of the property to search for.
 * @property {RecordOperatorEnum} searchOperator - The operator to use for the search. See {@link RecordOperatorEnum}
 */
export type idSearchOptions = {
    idProp: idPropertyEnum;
    idValue: string | number | string[] | number[];
    searchOperator: RecordOperatorEnum | SearchOperatorEnum | TextOperatorEnum | NumericOperatorEnum;
}

/**
 * @enum {string} **`idPropertyEnum`**
 * @property {string} INTERNAL_ID - `'internalid'` (for all records).
 * @property {string} EXTERNAL_ID - `'externalid'` (for all records).
 * @property {string} ENTITY_ID - `'entityid'` (for relationship records). appears on EntityTypeEnum records.
 * @property {string} ITEM_ID - `'itemid'` (for inventory records)
 * @property {string} TRANSACTION_ID - `'tranid'` (for transaction records)
 * @readonly
 */
export enum idPropertyEnum {
    /**`'internalid'` (for all records) */
    INTERNAL_ID = 'internalid',
    /** `'externalid'` (for all records) */
    EXTERNAL_ID = 'externalid',
    /**`'entityid'` (for relationship records) */
    ENTITY_ID = 'entityid',
    /**`'itemid'` (for inventory records) */
    ITEM_ID = 'itemid',
    /** `'tranid'` (for transaction records) */
    TRANSACTION_ID = 'tranid',
}

/** Type: **`SubrecordDictionary`** {@link SubrecordDictionary} */
/**
 * @deprecated
 * - each key in SubrecordDictionary is the fieldId (`body` or `sublist`) of a field that holds a subrecord object
 * - distinguish between body subrecords and sublist subrecords by checking if the mapped object has property `'sublistId'`
 * - - i.e. `mappedObject = SubrecordDictionary[fieldId]; `
 * - - `if 'sublistId' in mappedObject.keys()`, `then` it's a `sublist` subrecord and vice versa
 * - {@link SetFieldSubrecordOptions} for body subrecords
 * - {@link SetSublistSubrecordOptions} for sublist subrecords
 * @typedefn **`SubrecordDictionary`**
 */
export type SubrecordDictionary = {
    [fieldId: string]: SetFieldSubrecordOptions | SetSublistSubrecordOptions;
};


/**
 * @typedefn **`FieldDictionary`**
 */
export type FieldDictionary = {
    [fieldId: string]: FieldValue | SubrecordValue
};

/**
 * @typedefn **`SublistDictionary`**
 */
export type SublistDictionary = {
    [sublistId: string]: Array<SublistLine> | Array<{[sublistFieldId: string]: FieldValue | SubrecordValue}>
};

/**
 * @confirmed `'id'` is a prop of record sublists. e.g. for the `addressbook` sublist, TFAE
 * - `rec.getSublistValue({sublistId: 'addressbook', fieldId: 'addressid', line: 0})` (type = string)
 * - `rec.getSublistValue({sublistId: 'addressbook', fieldId: 'internalid', line: 0})` (type = number)
 * - `rec.getSublistValue({sublistId: 'addressbook', fieldId: 'id', line: 0})` (type = number)
 * - (returns the `'internalid'` of the addressbook entry.)
 */
/**
 * @typedefn **`SublistLine`**
 */
export type SublistLine = {
    [sublistFieldId: string]: FieldValue | SubrecordValue;
} & {
    line?: number;
    /**`string` - the `'sublistFieldId'` of the list entry with defined value at `SublistLine[sublistFieldId]` 
     * that you want to use to search for existing lines */
    lineIdProp?: string;
}

/**
 * @typedefn **`SetFieldSubrecordOptions`**
 * @property {string} fieldId `'internalid'` of the main record field that is a subrecord.
 * -  use `rec.getSubrecord({fieldId})` = `getSubrecord(options: GetFieldOptions): Omit<Record, 'save'>`;
 * @property {FieldDictionary} [fields] {@link FieldDictionary}
 * @property {SublistDictionary} [sublists] {@link SublistDictionary}
 * @property {string} subrecordType - The record type of the subrecord.
 */
export type SetFieldSubrecordOptions = {
    subrecordType: string;
    fieldId: string;
    fields?: FieldDictionary;
    sublists?: SublistDictionary;
}

/**
 * @typedefn **`SetSublistSubrecordOptions`**
 * @property {string} sublistId `string` the `parentSublistId` (The `internalid` of the main record's sublist)
 * @property {string} fieldId (i.e. `parentFieldId`) The `internalid` of the sublist field that holds a subrecord
 * - use `rec.getSublistSubrecord({sublistId, fieldId})`
 * @property {FieldDictionary} [fields] {@link FieldDictionary}
 * @property {SublistDictionary} [sublists] {@link SublistDictionary}
 * @property {string} subrecordType - The record type of the subrecord.
 */
export type SetSublistSubrecordOptions = {
    subrecordType: string;
    sublistId: string;
    fieldId: string;
    fields?: FieldDictionary;
    sublists?: SublistDictionary;
}


