/**
 * @file src/utils/api/types/Api.ts
 * @description Types specific to NetSuite's internal API (copies, analogs, or extensions of NetSuite's `N/record` module types).
 */

import { hasKeys, isPrimitiveValue } from "src/utils/typeValidation";
import { SetFieldSubrecordOptions, SetSublistSubrecordOptions } from "./Requests";

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

