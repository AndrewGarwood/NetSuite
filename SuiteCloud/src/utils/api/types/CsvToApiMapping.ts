/**
 * @file src/utils/api/types/CsvToApiMapping.ts
 * @module CsvToApiMapping
 */
import { RecordTypeEnum } from "./NS";
import { ValueMapping, ValueMappingEntry } from "../../io/types";
import { 
    CreateRecordOptions, 
    FieldDictionary,
    FieldValue,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistDictionary, 
    SublistFieldDictionary,  
    BatchCreateRecordRequest,  
    SetSubrecordOptions  
} from "./Api";


/**
 * @interface ParseOptions
 * @property {RecordTypeEnum} recordType - {@link RecordTypeEnum} The type of the NetSuite record.
 * @property {FieldDictionaryParseOptions} fieldDictParseOptions - {@link FieldDictionaryParseOptions} The field dictionary parse options for the record.
 * @property {SublistDictionaryParseOptions} sublistDictParseOptions - {@link SublistDictionaryParseOptions} The sublist dictionary parse options for the record.
 * @property {ValueMapping} valueOverrides - {@link ValueMapping} The value overrides for specific field values used in 
 * @property {function} [pruneFunc] - A `function` that takes a {@link CreateRecordOptions} object and returns either a {@link CreateRecordOptions} object or `null`.
 */
export interface ParseOptions {
    recordType: RecordTypeEnum;
    fieldDictParseOptions: FieldDictionaryParseOptions;
    sublistDictParseOptions: SublistDictionaryParseOptions;
    valueOverrides?: ValueMapping;
    /**
     * @property {function} [pruneFunc] - A `function` that takes a {@link CreateRecordOptions} object and returns either a {@link CreateRecordOptions} or `null`.
     */
    pruneFunc?: (options: CreateRecordOptions, label?: string) => CreateRecordOptions | null;
}

/**
 * @typedefn `{object}` `SetSubrecordOptions`
 * @property {string} fieldId - The fieldId of the body subrecord in the parent record.
 * @property {string} subrecordType - The type of the subrecord.
 * @property {FieldDictionaryParseOptions} fieldDictOptions - {@link FieldDictionaryParseOptions} - The field dictionary parse options for the subrecord.
 * @property {SublistDictionaryParseOptions} sublistDictOptions - {@link SublistDictionaryParseOptions} - The sublist dictionary parse options for the subrecord.
 */
export type FieldSubrecordMapping = {
    fieldId: string;
    subrecordType: string;
    fieldDictOptions?: FieldDictionaryParseOptions;
    sublistDictOptions?: SublistDictionaryParseOptions;
}
/**
 * @typedefn `{object}` `SublistSubrecordMapping`
 * @property {string} parentSublistId - The id of the sublist in the parent record containing a subrecord field.
 * @property {number} line - The line number (index) of the sublist in the parent record containing a subrecord field.
 * @property {string} fieldId - The fieldId of the subrecord in the sublist of the parent record.
 * @property {string} subrecordType - The type of the subrecord.
 * @property {FieldDictionaryParseOptions} fieldDictOptions - {@link FieldDictionaryParseOptions} - The field dictionary parse options for the subrecord.
 * @property {SublistDictionaryParseOptions} sublistDictOptions - {@link SublistDictionaryParseOptions} - The sublist dictionary parse options for the subrecord.
 */
export type SublistSubrecordMapping = {
    parentSublistId: string;
    line: number;
    fieldId: string;
    subrecordType: string;
    fieldDictParseOptions?: FieldDictionaryParseOptions;
    sublistDictParseOptions?: SublistDictionaryParseOptions;
}

/**
 * @typedefn `{object}` `FieldDictionaryParseOptions`
 * @property {Array\<FieldValueMapping>} fieldValueMapArray - `Array<`{@link FieldValueMapping}`>` - `keys` are `fieldIds` of body fields a NetSuite record, values are corresponding column names in the csv file
 * @property {Array\<FieldSubrecordMapping>} [subrecordMapArray] - `Array<`{@link FieldSubrecordMapping}`>` - `keys` are `fieldIds` of body subrecord fields a NetSuite record
 */
export type FieldDictionaryParseOptions = {
    fieldValueMapArray: FieldValueMapping[]; // keys are fieldIds of body fields a NetSuite record, values are corresponding column names in the csv file
    subrecordMapArray?: FieldSubrecordMapping[];
}

/**
 * @typedefn `{object}` `SublistDictionaryParseOptions`
 * = { [`sublistId`: string]: {@link SublistFieldDictionaryParseOptions} } 
 * = { [`sublistId`: string]: { `fieldValueMapArray`: `Array<`{@link SublistFieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link SublistSubrecordMapping}`>` } }
 */
export type SublistDictionaryParseOptions = {
    /** { [`sublistId`: string]: { `fieldValueMapArray`: `Array<`{@link SublistFieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link SublistSubrecordMapping}`>` } } */
    [sublistId: string] : SublistFieldDictionaryParseOptions;
};
/**
 * @typedefn {object} SublistFieldDictionaryParseOptions
 * @property {Array\<SublistFieldValueMapping>} fieldValueMapArray - `Array<`{@link SublistFieldValueMapping}`>` - `keys` are `fieldIds` of sublist fields a NetSuite record, values are corresponding column names in the csv file
 * @property {Array\<SublistSubrecordMapping>} [subrecordMapArray] - `Array<`{@link SublistSubrecordMapping}`>` `keys` are `fieldIds` of a sublist's subrecord fields a NetSuite record
 */
export type SublistFieldDictionaryParseOptions = {
    fieldValueMapArray: SublistFieldValueMapping[];
    subrecordMapArray?: SublistSubrecordMapping[];
}

/**
 * `rowEvaluator` and `colName` are mutually exclusive.
 * @typedefn `{object}` `FieldValueMapping`
 * @property {string} fieldId - The `fieldId` of a body field of the NetSuite record.
 * @property {FieldValue} [defaultValue] - The default value to set if `row[colName]` or `rowEvaluator(row)` is `undefined`.
 * @property {string} [colName] - The column name in the CSV file containing the value for the body field.
 * @property {function} [rowEvaluator] - A function that takes a `row` object and returns the value for the `fieldId`. This is used when the value is not in the CSV file or is determined by the contents/context of the `row`.
 * @property {Array<any>} [rowEvaluatorArgs] - An optional array of arguments to pass to the `rowEvaluator` function.
 * @description Associates a NetSuite record's `fieldId` with a column name in a csv file. 
 * so that the value, `row[colName]` in the csv file can be mapped to the `fieldId` of the NetSuite record in a {@link SetFieldValueOptions} object.
 * @example
 * const row = { Vendor: 'coolVendor', ... };
 * const fieldValueMap = { fieldId: 'companyname', colName: 'Vendor' };
 * const fieldValueOptions = { fieldId: fieldValueMap.fieldId, value: row[fieldValueMap.colName] };
 */
export type FieldValueMapping = {
    fieldId: string;
} & (
    | { defaultValue?: FieldValue; colName?: string; rowEvaluator?: never; rowEvaluatorArgs?: never; }
    | { defaultValue?: FieldValue; colName?: never; rowEvaluator?: (row: Record<string, any>, ...args: any[]) => FieldValue; rowEvaluatorArgs?: any[]; }
);

/**
 * `rowEvaluator` and `colName` are mutually exclusive.
 * @typedefn `{object}` `SublistFieldValueMapping`
 * @property {string} sublistId - The `sublistId` of a sublist in a NetSuite record.
 * @property {number} line - The `line number` of the sublist.
 * @property {string} fieldId - The `fieldId` of the sublist field.
 * @property {FieldValue} [defaultValue] - The default value to set if `row[colName]` or `rowEvaluator(row)` is `undefined`.
 * @property {string} [colName] - The column name in the CSV file containing the value for the sublist field.
 * @property {function} [rowEvaluator] - A function that takes a `row` object and returns the value for the `fieldId`. This is used when the value is not in the CSV file or is determined by the contents/context of the `row`.
 * @property {Array<any>} [rowEvaluatorArgs] - An optional array of arguments to pass to the `rowEvaluator` function.
 * @description Associates a NetSuite record's sublist's `fieldId` with a column name in a csv file.
 * so that the value, `row[colName]` in the csv file can be mapped to the `sublistFieldId` of the NetSuite record in a {@link SetSublistValueOptions} object. 
 */
export type SublistFieldValueMapping = {
    sublistId: string;
    line: number;
    fieldId: string;
} & (
    | { defaultValue?: FieldValue; colName?: string; rowEvaluator?: never; rowEvaluatorArgs?: never; }
    | { defaultValue?: FieldValue; colName?: never; rowEvaluator?: (row: Record<string, any>, ...args: any[]) => FieldValue; rowEvaluatorArgs?: any[]; }
);

/**
 * @enum {string} `FieldParentTypeEnum`
 * @description Enum for the parent type of a subrecord. Used to determine if the subrecord is a body field or a sublist field.
 * @property {string} SUBLIST - The subrecord corresponds to a sublist field in its parent record.
 * @property {string} BODY - The subrecord corresponds to a body field in its parent record.
 */
export enum FieldParentTypeEnum {
    /**The subrecord corresponds to a sublist field in its parent record. */
    SUBLIST = 'sublist',
    /**The subrecord corresponds to a body field in its parent record. */
    BODY = 'body',
}
