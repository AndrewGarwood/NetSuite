/**
 * @file src/utils/io/types/ParseOptions.ts
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
export type ValidatedParseResults = {
    [recordType: string | RecordTypeEnum | EntityRecordTypeEnum]: {
        valid: PostRecordOptions[], 
        invalid: PostRecordOptions[]
    }
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
 * @property {number} [minIndex] - Accept values from col starting at this index of `matchResults RegExpArray` returned from `extractor(row[col])`
 */
export type ColumnSliceOptions = {
    /**The column name to extract a value from. */
    colName: string;
    /** *`(zero-based)`* Accept values from col starting at this index of `matchResults RegExpArray` returned from `extractor(row[col])` */
    minIndex?: number
};


/**
 * @description
 * - `keys` - an explicit value that you want to override
 * - `value` can be: 
 * - - a {@link FieldValue} -> override occurrences of `key` in any column it's found in with the `FieldValue`
 * - - a {@link ValueMappingEntry} -> override occurences of `key` only in specified columns (see {@link ValueMappingEntry.validColumns}) with {@link ValueMappingEntry.newValue}.
 */
export type ValueMapping = Record<string, FieldValue | ValueMappingEntry>;
