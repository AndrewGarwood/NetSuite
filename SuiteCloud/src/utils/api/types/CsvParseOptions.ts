/**
 * @file src/utils/api/types/CsvParseOptions.ts
 */

import { PostRecordOptions } from ".";
import { RecordOperatorEnum, SearchOperatorEnum, TextOperatorEnum, NumericOperatorEnum, RecordTypeEnum, EntityRecordTypeEnum } from "../../ns";
import { idPropertyEnum, FieldValue } from "./Api";

// newRecordCondition

/**
 * @typedefn **`FieldDictionaryParseOptions`**
 */
export type FieldDictionaryParseOptions = {
    [fieldId: string]: FieldParseOptions | SubrecordParseOptions;
}

/**
 * @typedefn **`SublistDictionaryParseOptions`**
 */
export type SublistDictionaryParseOptions = {
    [sublistId: string] : {
        [sublistFieldId: string]: FieldParseOptions | SubrecordParseOptions
    };
};


// /**
//  * @typedefn **`SublistFieldDictionaryParseOptions`**
//  */
// export type SublistLineParseOptions = { 
    
// }


/**
 * `evaluator` and `colName` are mutually exclusive.
 * @typedefn **`FieldValueParseOptions`**
 * @property {FieldValue} [defaultValue] - The default value to set if `row[colName]` or `evaluator(row)` is `undefined`.
 * @property {string} [colName] - The column name in the CSV file containing the value for the body field.
 * @property {function} [evaluator] - A function that takes a `row` object and returns the value for the `fieldId`. This is used when the value is not in the CSV file or is determined by the contents/context of the `row`.
 * @property {Array<any>} [args] - An optional array of arguments to pass to the `evaluator` function.
 */
export type FieldParseOptions =  {
    defaultValue?: FieldValue; 
    colName?: string; 
    evaluator?: never; 
    args?: never; 
} | { 
    defaultValue?: FieldValue; 
    colName?: never; 
    evaluator?: (row: Record<string, any>, ...args: any[]) => FieldValue; 
    args?: any[]; 
};

/**
 * @typedefn **`FieldSubrecordParseOptions`**
 * @property {string} subrecordType - The type of the subrecord.
 * @property {FieldDictionaryParseOptions} fieldOptions - {@link FieldDictionaryParseOptions} - The field dictionary parse options for the subrecord.
 * @property {SublistDictionaryParseOptions} sublistOptions - {@link SublistDictionaryParseOptions} - The sublist dictionary parse options for the subrecord.
 */
export type SubrecordParseOptions = {
    subrecordType: string;
    fieldDictionaryOptions?: FieldDictionaryParseOptions;
    sublistDictionaryOptions?: SublistDictionaryParseOptions;
}


/** options for parsing a csv to extract an {@link idSearchOptions} object */
export type idSearchParseOptions = {
    idProp: idPropertyEnum;
    searchOperator: RecordOperatorEnum | SearchOperatorEnum | TextOperatorEnum | NumericOperatorEnum;
    idValueMapping: FieldParseOptions 
}


export type ParsePostProcessingOptions = {
    recordType: RecordTypeEnum;
    cloneOptions?: CloneOptions;
    pruneFunc?: (options: PostRecordOptions) => PostRecordOptions | null;
}

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
 * @deprecated
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
