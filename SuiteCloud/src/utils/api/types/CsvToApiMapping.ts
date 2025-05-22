/**
 * @file src/utils/api/types/CsvToApiMapping.ts
 * @module CsvToApiMapping
 */
import { RecordTypeEnum } from "./NS";
import { ValueMapping, ValueMappingEntry } from "../../io/types";
import { 
    FieldDictionary,
    FieldValue,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistDictionary, 
    SublistFieldDictionary,
    SetSubrecordOptions  
} from "./Api";
import { CreateRecordOptions, PostRecordOptions } from "./PostRequests";

/**
 * @typedefn **`RecordParseOptions`**
 * @property {RecordTypeEnum | string } recordType - {@link RecordTypeEnum} The type of the NetSuite record.
 * @property {Array<ParseOptions>} this[recordType] - `Array<`{@link ParseOptions}`>` - The parse options for the record type.
 */
export type RecordParseOptions = {
    [recordType: RecordTypeEnum | string]: ParseOptions[];
}
/**
 * @typedefn **`ParseResults`**
 * @property {RecordTypeEnum | string } recordType - {@link RecordTypeEnum} The type of the NetSuite record.
 * @property {Array<PostRecordOptions>} this[recordType].validPostOptions - `Array<`{@link PostRecordOptions}`>` - The valid post options for the record type.
 * @property {Array<ParseOptions>} this[recordType].invalidParseOptions - `Array<`{@link ParseOptions}`>` - array of parse options that resulted in a PostRecordOptions being pruned after running the {@link ParseOptions.pruneFunc}
 */
export type ParseResults = {
    [recordType: RecordTypeEnum | string]: {
        validPostOptions: PostRecordOptions[],
        invalidParseOptions: ParseOptions[],
    };
};

/**
 * @typedefn **`ParseOptions`**
 * @property {RecordTypeEnum} recordType - {@link RecordTypeEnum} The type of the NetSuite record.
 * @property {FieldDictionaryParseOptions} fieldDictParseOptions - {@link FieldDictionaryParseOptions} The field dictionary parse options for the record.
 * @property {SublistDictionaryParseOptions} sublistDictParseOptions - {@link SublistDictionaryParseOptions} The sublist dictionary parse options for the record.
 * @property {ValueMapping} valueOverrides - {@link ValueMapping} The value overrides for specific field values used in 
 * @property {function} [pruneFunc] - A `function` that takes a {@link PostRecordOptions} object and returns either a {@link PostRecordOptions} object or `null`.
 */
export type ParseOptions = {
    recordType: RecordTypeEnum;
    fieldDictParseOptions: FieldDictionaryParseOptions;
    sublistDictParseOptions: SublistDictionaryParseOptions;
    valueOverrides?: ValueMapping;
    /**
     * @property {function} [pruneFunc] - A `function` that takes a {@link PostRecordOptions} object and returns either a {@link PostRecordOptions} or `null`.
     */
    pruneFunc?: (options: PostRecordOptions) => PostRecordOptions | null;
}

/**
 * @typedefn **`SetSubrecordOptions`**
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
 * @typedefn **`SublistSubrecordMapping`**
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
 * @typedefn **`FieldDictionaryParseOptions`**
 * @property {Array<FieldValueMapping>} fieldValueMapArray - `Array<`{@link FieldValueMapping}`>` - `keys` are `fieldIds` of body fields a NetSuite record, values are corresponding column names in the csv file
 * @property {Array<FieldSubrecordMapping>} [subrecordMapArray] - `Array<`{@link FieldSubrecordMapping}`>` - `keys` are `fieldIds` of body subrecord fields a NetSuite record
 */
export type FieldDictionaryParseOptions = {
    fieldValueMapArray: FieldValueMapping[]; // keys are fieldIds of body fields a NetSuite record, values are corresponding column names in the csv file
    subrecordMapArray?: FieldSubrecordMapping[];
}

/**
 * @typedefn **`SublistDictionaryParseOptions`**
 * = { [`sublistId`: string]: {@link SublistFieldDictionaryParseOptions} } 
 * = { [`sublistId`: string]: { `fieldValueMapArray`: `Array<`{@link SublistFieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link SublistSubrecordMapping}`>` } }
 */
export type SublistDictionaryParseOptions = {
    /** { [`sublistId`: string]: { `fieldValueMapArray`: `Array<`{@link SublistFieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link SublistSubrecordMapping}`>` } } */
    [sublistId: string] : SublistFieldDictionaryParseOptions;
};
/**
 * @typedefn **`SublistFieldDictionaryParseOptions`**
 * @property {Array<SublistFieldValueMapping>} fieldValueMapArray - `Array<`{@link SublistFieldValueMapping}`>` - `keys` are `fieldIds` of sublist fields a NetSuite record, values are corresponding column names in the csv file
 * @property {Array<SublistSubrecordMapping>} [subrecordMapArray] - `Array<`{@link SublistSubrecordMapping}`>` `keys` are `fieldIds` of a sublist's subrecord fields a NetSuite record
 */
export type SublistFieldDictionaryParseOptions = {
    fieldValueMapArray: SublistFieldValueMapping[];
    subrecordMapArray?: SublistSubrecordMapping[];
}

//@property {string | string[]} fieldId  string[] implies that the value in row[colName] should be mapped to all fieldIds in the array.

/**
 * `evaluator` and `colName` are mutually exclusive.
 * @typedefn **`FieldValueMapping`**
 * @property {string} fieldId - The `fieldId` of a body field of the NetSuite record.
 * @property {FieldValue} [defaultValue] - The default value to set if `row[colName]` or `evaluator(row)` is `undefined`.
 * @property {string} [colName] - The column name in the CSV file containing the value for the body field.
 * @property {function} [evaluator] - A function that takes a `row` object and returns the value for the `fieldId`. This is used when the value is not in the CSV file or is determined by the contents/context of the `row`.
 * @property {Array<any>} [args] - An optional array of arguments to pass to the `evaluator` function.
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
    | { defaultValue?: FieldValue; colName?: string; evaluator?: never; args?: never; }
    | { defaultValue?: FieldValue; colName?: never; evaluator?: (row: Record<string, any>, ...args: any[]) => FieldValue; args?: any[]; }
);

/**
 * `evaluator` and `colName` are mutually exclusive.
 * @typedefn **`SublistFieldValueMapping`**
 * @property {string} sublistId - The `sublistId` of a sublist in a NetSuite record.
 * @property {number} line - The `line number` of the sublist.
 * @property {string} fieldId - The `fieldId` of the sublist field.
 * @property {FieldValue} [defaultValue] - The default value to set if `row[colName]` or `evaluator(row)` is `undefined`.
 * @property {string} [colName] - The column name in the CSV file containing the value for the sublist field.
 * @property {function} [evaluator] - A function that takes a `row` object and returns the value for the `fieldId`. This is used when the value is not in the CSV file or is determined by the contents/context of the `row`.
 * @property {Array<any>} [args] - An optional array of arguments to pass to the `evaluator` function.
 * @description Associates a NetSuite record's sublist's `fieldId` with a column name in a csv file.
 * so that the value, `row[colName]` in the csv file can be mapped to the `sublistFieldId` of the NetSuite record in a {@link SetSublistValueOptions} object. 
 */
export type SublistFieldValueMapping = {
    sublistId: string;
    line: number;
    fieldId: string;
} & (
    | { defaultValue?: FieldValue; colName?: string; evaluator?: never; args?: never; }
    | { defaultValue?: FieldValue; colName?: never; evaluator?: (row: Record<string, any>, ...args: any[]) => FieldValue; args?: any[]; }
);

/**
 * @enum {string} **`FieldParentTypeEnum`**
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
