/**
 * @file Api.ts
 * @module Api
 */

import { RecordTypeEnum } from '../NS/Record';

/**
 * Definition of Request body for the POST function in POST_BatchCreateRecord.js
 * @typedefn {Object} BatchCreateRecordRequest
 * @property {Array<CreateRecordOptions>} [createRecordArray] 
 * Array<{@link CreateRecordOptions}> to create records in NetSuite.
 * @property {{[K in RecordTypeEnum]?: Array<CreateRecordOptions>}} [createRecordDict] 
 * Dictionary<[K in {@link RecordTypeEnum}]?: Array<{@link CreateRecordOptions}>> to create records in NetSuite.
*/
export type BatchCreateRecordRequest = {
    createRecordArray?: CreateRecordOptions[];
    createRecordDict?: {[K in RecordTypeEnum]?: CreateRecordOptions[]};
};



/**
 * Definition of Response for the POST function in POST_BatchCreateRecord.js
 * @typedefn {Object} BatchCreateRecordResponse
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {number[]} recordIds - An array of record IDs created.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - An array of log entries generated during the request processing.
 */
export type BatchCreateRecordResponse = {
    success: boolean;
    message: string;
    recordIds: number[];
    error?: string;
    logArray: LogStatement[];
};

/**
 * @typedefn {Object} CreateRecordOptions
 * @property {RecordTypeEnum} recordType - The record type to create, see {@link RecordTypeEnum}
 * @property {boolean} [isDynamic=false] - Indicates if the record should be created in dynamic mode. (defaults to false)
 * @property {FieldDictionary} [fieldDict] 
 * - {@link FieldDictionary} = { priorityFields: Array<{@link SetFieldValueOptions}>, textFields: Array<{@link SetFieldTextOptions}>, valueFields: Array<{@link SetFieldValueOptions}>, subrecordFields: Array<{@link SetSubrecordOptions}> }.
 * - an object containing field IDs and their corresponding values.
 * @property {Record<[sublistId: string], SublistFieldDictionary>} [sublistDict] 
 * - Record<[sublistId: string], {@link SublistFieldDictionary}> = { sublistId: { priorityFields: Array<{@link SetFieldValueOptions}>, textFields: Array<{@link SetSublistTextOptions}>, valueFields: Array<{@link SetSublistValueOptions}>, subrecordFields: Array<{@link SetSubrecordOptions}> } }.
 * - an object containing sublist IDs and their corresponding field IDs and values.
 */
export type CreateRecordOptions = {
    recordType: RecordTypeEnum;
    isDynamic?: boolean;
    fieldDict?: FieldDictionary;
    sublistDict?: Record<string, SublistFieldDictionary>;
};


/**
 * @typedefn {Object} CreateRecordResponse
 * @property {boolean} success - Indicates if the record was created successfully.
 * @property {number} [recordId] - The ID of the created record. (does not exist if success is false)
 * @property {string} message - A message indicating the result of the operation.
 * @property {Array<LogStatement>} logArray - Array<{@link LogStatement}> generated during the POST requeset.
 */
export type CreateRecordResponse = {
    success: boolean;
    recordId?: number;
    message: string;
    logArray: Array<LogStatement>;
}

/**
 * @enum {string} LogTypeEnum
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
 * @typedefn {Object} LogStatement
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
 * @typedefn {Object} FieldDictionary
 * @property {Array\<SetFieldValueOptions>} [priorityFields]
 * - Array<{@link SetFieldValueOptions}> = Array<{fieldId: string, value: {@link FieldValue}}>. 
 * @property {Array\<SetFieldTextOptions>} [textFields] 
 * - Array<{@link SetFieldTextOptions}> = Array<{fieldId: string, text: string}>. 
 * - For record fields: record.setText(fieldId, text)
 * @property {Array\<SetFieldValueOptions>} [valueFields] 
 * - Array<{@link SetFieldValueOptions}> = Array<{fieldId: string, value: {@link FieldValue}}>. 
 * - For record fields: record.setValue(fieldId, value)
 * @property {Array\<SetSubrecordOptions>} [subrecordFields]
 * - Array<{@link SetSubrecordOptions}> = Array<{fieldId: string, subrecordType: string, fieldDict: {@link FieldDictionary}, sublistDict: {@link SublistDictionary}}>.
 * - array of subrecord fields in the main record
 */
export type FieldDictionary = {
    priorityFields?: SetFieldValueOptions[];
    textFields?: SetFieldTextOptions[];
    valueFields?: SetFieldValueOptions[];
    subrecordFields?: SetSubrecordOptions[];
};

/**
 * Set a record's sublist's field values organized by field type
 * @typedefn {Object} SublistFieldDictionary
 * @property {Array\<SetFieldValueOptions>} [priorityFields]
 * - Array<{@link SetFieldValueOptions}> = Array<{sublistId: string, fieldId: string, line: number, value: {@link FieldValue}}>.
 * @property {Array\<SetSublistTextOptions>} [textFields] 
 * - Array<{@link SetSublistTextOptions}> = Array<{sublistId: string, fieldId: string, line: number, text: string}>. 
 * - For record sublist fields: rec.setSublistText(sublistId, fieldId, line, text)
 * @property {Array\<SetSublistValueOptions>} [valueFields]  
 * - Array<{@link SetSublistValueOptions}> = Array<{sublistId: string, fieldId: string, line: number, value: {@link FieldValue}}>. 
 * - For record sublist fields: rec.setSublistValue(sublistId, fieldId, line, value)
 * * @property {Array\<SetSubrecordOptions>} [subrecordFields]
 * - Array<{@link SetSubrecordOptions}> = Array<{sublistId: string, fieldId: string, subrecordType: string, fieldDict: {@link FieldDictionary}, sublistDict: {@link SublistDictionary}}>.
 * - array of subrecord fields in the main record's sublist
 */
export type SublistFieldDictionary = {
    priorityFields?: SetFieldValueOptions[];
    textFields?: SetSublistTextOptions[];
    valueFields?: SetSublistValueOptions[];
    subrecordFields?: SetSubrecordOptions[];
};


/**
 * @typedefn {Object} SublistDictionary
 * - a key in SublistDictionary is a  {string} sublistId (e.g. 'addressbook', 'item', etc.)
 * - values are {@link SublistFieldDictionary} = { priorityFields: Array<{@link SetFieldValueOptions}>, textFields: Array<{@link SetSublistTextOptions}>, valueFields: Array<{@link SetSublistValueOptions}>, subrecordFields: Array<{@link SetSubrecordOptions}> }.
 */
export type SublistDictionary = Record<string, SublistFieldDictionary>;

/**
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * - The value type must correspond to the field type being set. For example:
 * - Text, Radio and Select fields accept string values.
 * - Checkbox fields accept Boolean values.
 * - Date and DateTime fields accept Date values.
 * - Integer, Float, Currency and Percent fields accept number values.
 * @typedefn {Date | number | number[] | string | string[] | boolean | null} FieldValue 
 */
export type FieldValue = Date | number | number[] | string | string[] | boolean | null;

/**
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @interface SetFieldValueOptions
 * @property {string} fieldId - The internal ID of a standard or custom field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the field to. 
 * - = {Date | number | number[] | string | string[] | boolean | null}
 */
export interface SetFieldValueOptions {
    fieldId: string;
    value: FieldValue;
}

/**
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @interface SetFieldTextOptions
 * @property {string} fieldId - The internal ID of a standard or custom field.
 * @property {string} text - The text to set the value to.
 */
export interface SetFieldTextOptions {
    fieldId: string;
    text: string;
}

/**
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @interface SetSublistTextOptions
 * @property {string} sublistId - The internal ID of the sublist.
 * @property {string} fieldId - (i.e. sublistFieldId) The internal ID of a standard or custom sublist field.
 * @property {number} [line] - The line number for the field.
 * @property {string} text - The text to set the value to.
 */
export interface SetSublistTextOptions {
    sublistId: string;
    fieldId: string;
    line?: number;
    text: string;
}

/**
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @interface SetSublistValueOptions
 * @property {string} sublistId - The internal ID of the sublist.
 * @property {string} fieldId - The internal ID of a standard or custom sublist field.
 * @property {number} [line] - The line number for the field.
 * @property {FieldValue} value - The {@link FieldValue} to set the sublist field to.
 * = {Date | number | number[] | string | string[] | boolean | null}
 */
export interface SetSublistValueOptions {
    sublistId: string;
    fieldId: string;
    line?: number;
    value: FieldValue;
}

/**
 * @interface SetSubrecordOptions
 * @property {string} [sublistId] - (If setting subrecord of a sublist) The internal ID of the parent record's sublist that contains a subrecord field. (e.g. 'addressbook')
 * @property {string} fieldId - The internal ID of the field or sublistField that is a subrecord. (e.g. 'addressbookaddress), 
 * - If the subrecord is on the main record, use getSubrecord({fieldId}) = getSubrecord(options: GetFieldOptions): Omit<Record, "save">;
 * - If the subrecord is in a sublist, use rec.getSublistSubrecord({sublistId, fieldId})
 * @property {string} subrecordType - The record type of the subrecord. (e.g. 'address', 'inventorydetail', etc.)
 * @property {number} [line] - The line number for the field. (i.e. index of the sublist row) defaults to new line. (can use record.getLineCount(sublistId) to get the number of lines in the sublist)
 * @property {FieldDictionary} [fieldDict] - {@link FieldDictionary} = { priorityFields: Array<{@link SetFieldValueOptions}>, textFields: Array<{@link SetFieldTextOptions}>, valueFields: Array<{@link SetFieldValueOptions}> }
 * @property {SublistDictionary} [sublistDict] - {@link SublistDictionary} = Record<[sublistId: string], {@link SublistFieldDictionary}> = { sublistId: { textFields: Array<{@link SetSublistTextOptions}>, valueFields: Array<{@link SetSublistValueOptions}> } }.
 * - (if subrecord has own sublists) an object containing sublist IDs mapped to a dictionary of field IDs and values.
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4687606306.html}
 *  ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @description
 * - (If it's a main record subrecord):
 *   1. validate fieldId in rec.getFields() 
 *   2. let subrec = rec.getSubrecord({fieldId}) where fieldId is a subrecord field
 *   3. subrec = processFieldDictionary(subrec, subrecordType, fieldDict, {@link FieldDictTypeEnum}.FIELD_DICT)
 *   4. subrec = processFieldDictionary(subrec, subrecordType, sublistDict, {@link FieldDictTypeEnum}.SUBLIST_FIELD_DICT)
 * - (If it's a sublist subrecord):
 *   1. validate sublistId in rec.getSublists()
 *   2. validate fieldId in rec.getSublistFields({sublistId}) 
 *   3. let subrec = rec.getSublistSubrecord({sublistId, fieldId, lineIndex}) where 0 <= lineIndex < rec.getLineCount({sublistId}) (@TODO: check if 0th indexing is used in sublists...)
 *   4. subrec = processFieldDictionary(subrec, subrecordType, fieldDict, {@link FieldDictTypeEnum}.FIELD_DICT)
 *   5. subrec = processFieldDictionary(subrec, subrecordType, sublistDict, {@link FieldDictTypeEnum}.SUBLIST_FIELD_DICT)
 *   6. rec.commitLine({sublistId}) (@TODO: see if this saves the subrecord to the parent record)
 */
export interface SetSubrecordOptions {
    sublistId?: string;
    fieldId: string;
    subrecordType: string;
    line?: number;
    fieldDict?: FieldDictionary;
    sublistDict?: SublistDictionary;
}

/**
 * @enum {string} FieldOptionsTypeEnum
 * @property {string} FIELD_TEXT - fieldText ({@link SetFieldTextOptions}) set text field of record
 * @property {string} FIELD_VALUE - fieldValue ({@link SetFieldValueOptions}) set value field of record
 * @property {string} SUBLIST_TEXT - sublistText ({@link SetSublistTextOptions}) set text field of record's sublist
 * @property {string} SUBLIST_VALUE - sublistValue ({@link SetSublistValueOptions}) set value field of record's sublist
 */
export enum FieldOptionsTypeEnum {
    FIELD_TEXT = 'fieldText',
    FIELD_VALUE = 'fieldValue',
    SUBLIST_TEXT = 'sublistText',
    SUBLIST_VALUE = 'sublistValue',
}

/**
 * @typedefn {Object} SetFieldOptionsArrayTypes 
 * */
export type SetFieldOptionsArrayTypes = SetFieldTextOptions | SetFieldValueOptions | SetSublistTextOptions | SetSublistValueOptions;

/**
 * @description Enum for the label of the field options array used in log statements.
 * @enum {string} OptionsArrayLabelEnum 
 * @property {string} PRIORITY - priorityFields are set first, then textFields and valueFields
 * @property {string} TEXT - textFields are set second, then valueFields
 * @property {string} VALUE - valueFields are set third
 * @property {string} DEFAULT_LABEL - default label for field options array
 */
export enum OptionsArrayLabelEnum {
    PRIORITY = 'priorityFields',
    TEXT = 'textFields',
    VALUE = 'valueFields',
    DEFAULT_LABEL = 'optionsArray',
}

/**
 * @enum {string} FieldDictTypeEnum
 * @property {string} FIELD_DICT - fieldDict
 * @property {string} SUBLIST_FIELD_DICT - sublistFieldDict
 */
export enum FieldDictTypeEnum {
    FIELD_DICT = 'fieldDict',
    SUBLIST_FIELD_DICT = 'sublistFieldDict',
}