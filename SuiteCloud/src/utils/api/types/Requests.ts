/**
 * @file src/utils/api/types/Requests.ts
 * @description types that can be used across multiple request types (e.g. `GET`, `POST`, `DELETE`).
 * General types used to interact with NetSuite's internal API.
 */

import { FieldValue } from "./InternalApi";
import { NumericOperatorEnum, RecordOperatorEnum, RecordTypeEnum, SearchOperatorEnum, TextOperatorEnum } from "src/utils/ns";

/**
 * @typedefn **`FieldDictionary`**
 */
export type FieldDictionary = {
    [fieldId: string]: FieldValue | SubrecordValue
};

/**
 * either the subrecord itself or the options to set a subrecord
 * @typedefn **`SubrecordValue`** 
 * */
export type SubrecordValue = ({
    subrecordType?: string;
} & {
    [subrecordFieldId: string]: FieldValue; 
}) | ((SetFieldSubrecordOptions | SetSublistSubrecordOptions) & {
    [key: string]: any;
});
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
    /**`string` - the `'sublistFieldId'` of the list entry with defined value at `SublistLine[sublistFieldId]` that you want to use to search for existing lines */
    lineIdProp?: string;
}

/** Type: **`SubrecordDictionary`** {@link SubrecordDictionary} */
/**
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
 * @typedefn **`SetFieldSubrecordOptions`**
 * @property {string} fieldId The `'internalid'` of the main record field that is a subrecord.
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


/**
 * @typedefn **`PostResponseOptions`**
 * @property {string | string[]} [responseFields] - `fieldId(s)` of the main record to return in the response.
 * @property {Record<string, string | string[]>} [responseSublists] `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response.
 */
export type RecordResponseOptions = {
    /** `fieldId(s)` of the main record to return in the response. */
    responseFields?: string | string[];
    /** `sublistId(s)` mapped to `sublistFieldId(s)` to return in the response. */
    responseSublists?: Record<string, string | string[]>;
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
 * @property {RecordOperatorEnum} searchOperator - The operator to use for the search. See {@link RecordOperatorEnum}
 * @property {string | number | string[] | number[]} idValue - The value(s) of the property to search for.
 */
export type idSearchOptions = {
    idProp: idPropertyEnum;
    searchOperator: RecordOperatorEnum | SearchOperatorEnum | TextOperatorEnum | NumericOperatorEnum;
    idValue: string | number | string[] | number[];
}

/**
 * @enum {string} **`idPropertyEnum`**
 * @property {string} INTERNAL_ID - The `'internalid'` (for all records).
 * @property {string} EXTERNAL_ID - The `'externalid'` (for all records).
 * @property {string} ENTITY_ID - The `'entityid'` (for relationship records). appears on vendor records.
 * @property {string} ITEM_ID - The `'itemid'` (for inventory records)
 * @readonly
 */
export enum idPropertyEnum {
    INTERNAL_ID = 'internalid',
    EXTERNAL_ID = 'externalid',
    ENTITY_ID = 'entityid',
    ITEM_ID = 'itemid'
}