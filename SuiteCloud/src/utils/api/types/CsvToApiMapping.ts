/**
 * @file src/utils/api/types/CsvToApiMapping.ts
 * @module CsvToApiMapping
 */
import { RecordTypeEnum, EntityRecordTypeEnum, RecordOperatorEnum, SearchOperatorEnum, TextOperatorEnum, NumericOperatorEnum } from "../../ns";
import { ValueMapping, ValueMappingEntry } from "../../io/types";
import {
    idPropertyEnum,
    FieldDictionary,
    FieldValue,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistDictionary, 
    SublistFieldDictionary,
    SetSubrecordOptions
} from "./Api";
import { PostRecordOptions, idSearchOptions } from "./PostRequests";
/**@TODO make idParseOptions */
/**
 * @typedefn **`CloneOptions`**
 * @property {RecordTypeEnum | EntityRecordTypeEnum | string} donorType - {@link RecordTypeEnum} - The type of the NetSuite record to clone from.
 * @property {RecordTypeEnum | EntityRecordTypeEnum | string} recipientType - {@link RecordTypeEnum} - The type of the NetSuite record to clone to.
 * @property {idPropertyEnum} idProperty - {@link idPropertyEnum} - The property from the donor's {@link FieldDictionary.valueFields} used to join the donor and recipient records.
 * @property {Array<string>} fieldIds - `Array<string>` - `fieldIds` to clone from the donor's {@link FieldDictionary}'s ({@link PostRecordOptions}`.fieldDict.valueFields` 
 * and {@link PostRecordOptions}`.fieldDict.subrecordFields`) to the recipient's {@link FieldDictionary}'s `valueFields` and `subrecordFields`.
 * @property {Array<string>} sublistIds - `Array<string>` - `sublistIds` to clone from the donor's {@link SublistDictionary}
 */
export type CloneOptions = {
    donorType: RecordTypeEnum | EntityRecordTypeEnum | string;
    recipientType: RecordTypeEnum | EntityRecordTypeEnum | string;
    idProperty: idPropertyEnum;
    fieldIds?: string[];
    sublistIds?: string[];
}

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
 * @property {Array<ParseOptions>} this[recordType].invalidPostOptions - `Array<`{@link PostRecordOptions}`>` - array of pruned PostRecordOptions
 */
export type ParseResults = {
    [recordType: RecordTypeEnum | string]: {
        validPostOptions: PostRecordOptions[],
        invalidPostOptions: PostRecordOptions[],
    };
};

/**
 * @typedefn **`ParseOptions`**
 * @property {RecordTypeEnum} recordType - {@link RecordTypeEnum} The type of the NetSuite record.
 * @property {FieldDictionaryParseOptions} fieldDictParseOptions - {@link FieldDictionaryParseOptions} The field dictionary parse options for the record.
 * @property {SublistDictionaryParseOptions} sublistDictParseOptions - {@link SublistDictionaryParseOptions} The sublist dictionary parse options for the record.
 * @property {ValueMapping} valueOverrides - {@link ValueMapping} The value overrides for specific field values used in 
 * @property {CloneOptions} cloneOptions - {@link CloneOptions} = `{ donorType?: `{@link RecordTypeEnum}`, recipientType?: `{@link RecordTypeEnum}`, idProperty: `{@link idPropertyEnum}`, fieldIds?: string[], sublistIds?: string[] }`
 * @property {function} [pruneFunc] - `function` that takes a {@link PostRecordOptions} and returns either a {@link PostRecordOptions} or `null`.
 */
export type ParseOptions = {
    recordType: RecordTypeEnum;
    idParseOptions?: idSearchParseOptions[];
    fieldDictParseOptions: FieldDictionaryParseOptions;
    sublistDictParseOptions?: SublistDictionaryParseOptions;
    valueOverrides?: ValueMapping;
    /**can only use cloneOptions if this is not the first ParseOptions processed in parseCsvToRequestBody(), b/c cloning from result of previous ParseOptions */
    cloneOptions?: CloneOptions;
    /**
     * @property {function} [pruneFunc] - `function` that takes a {@link PostRecordOptions} and returns either a {@link PostRecordOptions} or `null`.
     */
    pruneFunc?: (options: PostRecordOptions) => PostRecordOptions | null;
}
/** {@link idSearchOptions} */
export type idSearchParseOptions = {
    idProp: idPropertyEnum;
    searchOperator: RecordOperatorEnum | SearchOperatorEnum | TextOperatorEnum | NumericOperatorEnum;
    idValueMapping: FieldValueMapping 
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
