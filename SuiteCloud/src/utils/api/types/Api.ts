/**
 * @file src/utils/api/types/Api.ts
 * @module Api
 */

import { RecordTypeEnum } from '../../NS/Record/Record';

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

/**
 * @enum {string} **`LogTypeEnum`**
 * @readonly
 * @description Enum for NetSuite's log module types
 * @property {string} DEBUG - Debug log type
 * @property {string} ERROR - Error log type
 * @property {string} AUDIT - Audit log type
 * @property {string} EMERGENCY - Emergency log type
 */
export enum LogTypeEnum {
    DEBUG = 'debug',
    ERROR = 'error',
    AUDIT = 'audit',
    EMERGENCY = 'emergency',
};

/**
 * Definition of elements in the {@link logArray} array
 * @typedefn **`LogStatement`**
 * @property {string} timestamp - The timestamp of the log entry.
 * @property {LogTypeEnum} type - The type of log entry (see {@link LogTypeEnum}).
 * @property {string} title - The title of the log entry.
 * @property {any} details - The details of the log entry.
 * @property {string} [message] - The message of the log entry = concatenated string of details's contents (if details is an array).
 */
export type LogStatement = {
    timestamp: string;
    type: LogTypeEnum;
    title: string;
    details: any;
    message?: string;
};

/**
 * Fields organized by the fields' value type
 * @typedefn **`FieldDictionary`**
 * @property {Array<SetFieldValueOptions>} [valueFields] 
 * - `Array<`{@link SetFieldValueOptions}`>`= `Array<{ fieldId`: string, `value`: {@link FieldValue}` }>`. 
 * - For record fields: `record.setValue(fieldId, value)`
 * @property {Array<SetSubrecordOptions>} [subrecordFields]
 * - `Array<`{@link SetSubrecordOptions}`>`= `Array<{ parentSublistId`?: string, `line`?: number, fieldId: string, `subrecordType`: string, `fieldDict`: {@link FieldDictionary}, `sublistFieldDict`: {@link SublistFieldDictionary}` }>`.
 * - array of subrecord fields in the main record
 */
export type FieldDictionary = {
    valueFields?: SetFieldValueOptions[];
    subrecordFields?: SetSubrecordOptions[];
};

/**
 * Set a record's sublist's field values organized by field type
 * @typedefn **`SublistFieldDictionary`**
 * @property {Array<SetSublistValueOptions>} [valueFields]  
 * - `Array<`{@link SetSublistValueOptions}`>` = `Array<{ sublistId`: string, `fieldId`: string, `line`: number, `value`: {@link FieldValue}` }>`. 
 * - For record sublist fields: rec.setSublistValue(sublistId, fieldId, line, value)
 * @property {Array<SetSubrecordOptions>} [subrecordFields]
 * - `Array<`{@link SetSubrecordOptions}`>` = `Array<{ parentSublistId`?: string, `line`?: number, `fieldId`: string, `subrecordType`: string, `fieldDict`: {@link FieldDictionary}, `sublistFieldDict`: {@link SublistFieldDictionary}` }>`.
 * - array of subrecord fields in the main record's sublist
 */
export type SublistFieldDictionary = {
    valueFields?: SetSublistValueOptions[];
    subrecordFields?: SetSubrecordOptions[];
};


/**
 * @typedefn **`SublistDictionary`**
 * - a key in `SublistDictionary` is a `sublistId {string}` (e.g. 'addressbook', 'item', etc.)
 * - values are {@link SublistFieldDictionary} = { `priorityFields`: `Array<`{@link SetFieldValueOptions}`>`, `textFields`: `Array<`{@link SetSublistTextOptions}`>`, `valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`
 */
export type SublistDictionary = Record<string, SublistFieldDictionary>;

/**
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html}
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * The value type must correspond to the field type being set. For example:
 * - `Text` and `Radio` fields accept `string` values.
 * - `Select` fields accept `string` and `number` values.
 * - `Multi-Select` fields accept `arrays` of `string` or `number` values.
 * - `Checkbox` fields accept `boolean` values.
 * - `Date` and `DateTime` fields accept {@link Date} values.
 * - `Integer`, `Float`, `Currency` and `Percent` fields accept `number` values.
 * - `Inline HTML` fields accept `strings`. Strings containing HTML tags are represented as HTML entities in UI. {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html#:~:text=The%20following%20code%20sample%20shows%20the%20syntax%20for%20INLINEHTML%20fields%20and%20what%20is%20returned.}
 * @typedefn **`FieldValue`** 
 */
export type FieldValue = Date | number | number[] | string | string[] | boolean | null;

/**
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html}
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @interface **`SetFieldValueOptions`**
 * @property {string} fieldId - The `'internalid'` of a standard or custom field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the field to. 
 * - = `{Date | number | number[] | string | string[] | boolean | null}`
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */
export interface SetFieldValueOptions {
    fieldId: string;
    value: FieldValue;
    inputType?: FieldInputTypeEnum;
}


/**
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @interface **`SetSublistValueOptions`**
 * @property {string} sublistId - The `'internalid'` of the sublist.
 * @property {string} fieldId - The `'internalid'` of a standard or custom sublist field.
 * @property {number} [line] - The line number for the field.
 * @property {FieldValue} value - The {@link FieldValue} to set the sublist field to.
 * = `{Date | number | number[] | string | string[] | boolean | null}`
 * @property {FieldInputTypeEnum} [inputType] - The input type of the field. (see {@link FieldInputTypeEnum})
 */
export interface SetSublistValueOptions {
    sublistId: string;
    fieldId: string;
    line?: number;
    value: FieldValue;
    inputType?: FieldInputTypeEnum;
}

/**
 * @interface **`SetSubrecordOptions`**
 * @property {string} [parentSublistId] - (If setting subrecord of a sublist) The `'internalid'` of the parent record's sublist that contains a subrecord field. (e.g. 'addressbook')
 * @property {number} [line] - `The line number` for the field. (i.e. index of the sublist row) defaults to new line. (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {string} fieldId - The `'internalid'` of the field or sublistField that is a subrecord. (e.g. 'addressbookaddress'), 
 * - If the subrecord is on the main record, use getSubrecord({fieldId}) = getSubrecord(options: GetFieldOptions): Omit<Record, "save">;
 * - If the subrecord is in a sublist, use rec.getSublistSubrecord({sublistId, fieldId})
 * @property {string} subrecordType - The record type of the subrecord. (e.g. 'address', 'inventorydetail', etc.)
 * @property {FieldDictionary} [fieldDict] - {@link FieldDictionary} = { `valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`
 * @property {SublistFieldDictionary} [sublistDict] - {@link SublistFieldDictionary} =  { `valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`
 * - (if subrecord has own sublists) an object containing sublist IDs mapped to a dictionary of field IDs and values.
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4687606306.html}
 *  ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @description (`Option A` and `Option B` are mutually exclusive)
 * - `Option A:` sublistId is not provided, assume that the subrecord corresponds to a body field of the main record, `rec`. 
 *   - `1.` (maybe optional) verify rec.getFields().includes(fieldId) is true
 *   - `2.` (maybe optional) rec.hasSubrecord(fieldId) is true -> there is an existing subrecord for the fieldId
 *   - `3.` let subrec = rec.getSubrecord({ fieldId }) to get the subrecord.
 *   - `4.` if {@link hasNonTrivialKeys}(`subrecordOptions.fieldDict`),   set `subrec` = {@link processFieldDictionary}(`subrec`, `subrecordOptions.subrecordType`, `subrecordOptions.fieldDict`, {@link FieldDictTypeEnum.FIELD_DICT}) to set the subrecord's field values.
 *   - `5.` if {@link hasNonTrivialKeys}(`subrecordOptions.sublistFieldDict`), 
 *   - `6.` return rec
 * - `Option B:` assume that the subrecord pertains to a sublistField in one of the main record's sublists.
 *   - `1.` verify rec.getSublists().includes(sublistId) is true
 *   - `2.` (maybe optional) verify rec.getSublistFields({ sublistId }).includes(fieldId) is true
 *   - `3.` (maybe optional) rec.hasSublistSubrecord({ fieldId }) is true -> there is an existing subrecord for the sublist fieldId
 *   - `4.` validate that line index is valid for the sublistId i.e. within ( 0 <= line < rec.getLineCount(sublistId) ). 
 *     - call rec.insertLine({ sublistId, line: getLineCount-1 }) if necessary (insert new line at end of sublist).
 *   - `5.` let subrec =  rec.getSublistSubrecord({ sublistId, fieldId, line }) to get the subrecord.
 *   - `6.` if {@link hasNonTrivialKeys}(`subrecordOptions.fieldDict`),   set `subrec` =  {@link processFieldDictionary}(`subrec`, `subrecordOptions.subrecordType`, `subrecordOptions.sublistFieldDict`, {@link FieldDictTypeEnum.FIELD_DICT}) to set the subrecord's sublist field values.
 *   - `7.` if {@link hasNonTrivialKeys}(`subrecordOptions.sublistFieldDict`), 
 *   - `8.` return rec
 */  
export interface SetSubrecordOptions {
    parentSublistId?: string;
    line?: number;
    fieldId: string;
    subrecordType: string;
    fieldDict?: FieldDictionary;
    sublistDict?: SublistDictionary;
}

/** 
 * @enum {string} **`FieldInputTypeEnum`**
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html}
 * @property {string} TEXT `Text` fields accept `string` values. 
 * @property {string} RADIO `Radio` fields accept `string` values.
 * @property {string} SELECT `Select` fields accept `string` and `number` values.
 * @property {string} MULTISELECT `Multi-Select` fields accept `arrays` of `string` or `number` values.
 * @property {string} CHECKBOX `Checkbox` fields accept `boolean` values.
 * @property {string} DATE `Date` and `DateTime` fields accept {@link Date} values.
 * @property {string} INTEGER `Integer` fields accept `number` values.
 * @property {string} FLOAT `Float` fields accept `number` values.
 * @property {string} CURRENCY `Currency` fields accept `number` values.
 * @property {string} PERCENT `Percent` fields accept `number` values.
 * @property {string} INLINE_HTML `Inline HTML` fields accept `strings`. Strings containing HTML tags are represented as HTML entities in UI. {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html#:~:text=The%20following%20code%20sample%20shows%20the%20syntax%20for%20INLINEHTML%20fields%20and%20what%20is%20returned.}
 */
export enum FieldInputTypeEnum {
    /** `Text` fields accept `string` values. */
    TEXT = 'text',
    /** `Radio` fields accept `string` values. */
    RADIO = 'radio',
    /** `Select` fields accept `string` and `number` values. */
    SELECT = 'select',
    /** `Multi-Select` fields accept `arrays` of `string` or `number` values. */
    MULTISELECT = 'multiselect',
    /** `Checkbox` fields accept `boolean` values. */
    CHECKBOX = 'checkbox',
    /** `Date` and `DateTime` fields accept {@link Date} values. */
    DATE = 'date',
    /** `Integer` fields accept `number` values. */
    INTEGER = 'integer',
    /** `Float` fields accept `number` values. */
    FLOAT = 'float',
    /** `Currency` fields accept `number` values. */
    CURRENCY = 'currency',
    /** `Percent` fields accept `number` values. */
    PERCENT = 'percent',
    /** `Inline HTML` fields accept `strings`. Strings containing HTML tags are represented as HTML entities in UI. {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4273155868.html#:~:text=The%20following%20code%20sample%20shows%20the%20syntax%20for%20INLINEHTML%20fields%20and%20what%20is%20returned.} */
    INLINE_HTML = 'inlinehtml',
}