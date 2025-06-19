/**
 * @file src/utils/io/types/CsvParseOptions.ts
 */

import { 
    RecordOperatorEnum, SearchOperatorEnum, TextOperatorEnum, NumericOperatorEnum, 
    RecordTypeEnum, EntityRecordTypeEnum 
} from "../../ns";
import { FieldValue, PostRecordOptions, idPropertyEnum } from '../../api/types';

export type ParseOptions = {
    [recordType: RecordTypeEnum | string]: RecordParseOptions | {
        keyColumn: string,
        fieldOptions?: FieldDictionaryParseOptions,
        sublistOptions?: SublistDictionaryParseOptions,
    };
}

export type RecordParseOptions = {
    keyColumn: string;
    fieldOptions?: FieldDictionaryParseOptions;
    sublistOptions?: SublistDictionaryParseOptions;
}

export type IntermediateParseResults = {
    [recordType: RecordTypeEnum | string]: {
        [recordId: string]: PostRecordOptions
    }
};
export type ParseResults = {
    [recordType: RecordTypeEnum | string]: PostRecordOptions[]
};

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
    [sublistId: string] : Array<SublistLineParseOptions>;
};


/**
 * @typedefn **`SublistLineParseOptions`**
 */
export type SublistLineParseOptions = { 
    [sublistFieldId: string]: FieldParseOptions | SubrecordParseOptions
}
/*
 * @property {string} sublistLineKeyColumn - If there is a column name that uniquely identifies a sublist line,
 * - e.g. distinguish entries for the `'addressbook'` sublist if the csv has a column the concatenates all `'addressbookaddress'` values 

{sublistLineKeyColumn?: string} & 
*/

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
    fieldOptions?: FieldDictionaryParseOptions;
    sublistOptions?: SublistDictionaryParseOptions;
}


/** 
 * options for parsing a csv to extract an {@link idSearchOptions} object 
 * */
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


/**
 * only set oldValue to newValue if the column name is in validColumns
 * @property {FieldValue} newValue - The new value to set for the column.
 * @property {string | string[]} validColumns - The column names that this mapping applies to. Can be a single string or an array of strings.
 */
export type ValueMappingEntry = {
    newValue: FieldValue;
    validColumns: string | string[];
};

/**
 * @description use when row[columnName] might contain multiple values e.g. `row[columnName] = "email1; email2; email3"`
 * @property {string} col - The column name to extract a value from.
 * @property {number} [minIndex] - Accept values from col starting at this index of regex matchResults returned from extractor(row[col])
 */
export type ColumnSliceOptions = {
    /**The column name to extract a value from. */
    colName: string;
    /**Accept values from col starting at this index of regex matchResults returned from extractor(row[col]) */
    minIndex?: number
};

/**
 * @description Checks if the given value is a {@link ValueMappingEntry} = `{ newValue`: {@link FieldValue}, `validColumns`: `string | string[] }`.
 * @param value - The value to check.
 */
export function isValueMappingEntry(value: any): value is ValueMappingEntry {
    return typeof value === 'object' && 'newValue' in value && 'validColumns' in value;
}


/**
 * @description
 * - `keys` - an explicit value that you want to override
 * - `value` can be: 
 * - - a {@link FieldValue} -> override occurrences of `key` in any column it's found in with the `FieldValue`
 * - - a {@link ValueMappingEntry} -> override occurences of `key` only in specified columns (see {@link ValueMappingEntry.validColumns}) with {@link ValueMappingEntry.newValue}.
 */
export type ValueMapping = Record<string, FieldValue | ValueMappingEntry>;

