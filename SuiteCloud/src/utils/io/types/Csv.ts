/**
 * @file src/types/io/Csv.ts
 * @description Types and Enums for handling CSV files, including column mappings and delimiters.
 * @module Csv
 */
import { 
    FieldValue,
} from "../../api/types/Api";
import { parseDelimitedFileWithMapping } from "src/utils/io/reading";
// --------------------------------------------------------------------
/** types for the {@link parseDelimitedFileWithMapping}`()` function */

/** 
 * Mapping of original column names to NetSuite column names
 * - Record<string, string>, entry = [originalKey, newKey(s)] 
 */
export type ColumnMapping = Record<string, string | string[]>;

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

/**
 * @description The MappedRow type remaps the keys of the input 
 * type T (a {@link ColumnMapping}) to its values, and assigns the type string to all 
 * the new keys
 * @Notes
 * - `T extends ColumnMapping` - ensures that T is an object with string keys and string values, see {@link ColumnMapping}
 * Mapped Type Syntax: `{ [K in keyof T as T[K]]: string }`
 * - ` [K in keyof T` - iterates over the keys of T using `keyof T` and creates a new object type. 
 *   - For each key K in T, the ` as T[K]` clause renames the key in the resulting type to the value of T[K]
 *   - ` as T[K]]}` transforms the keys of the resulting type. Instead of keeping the original keys from T, it uses the values of T as the new keys
 * - `: string`- specifies that the value type of the new object is always a string.
 */
export type MappedRow<T extends ColumnMapping> = {
    [K in keyof T as 
        T[K] extends string 
            ? T[K] 
            : T[K] extends Array<string> 
                ? T[K][number] 
                : never
    ]: FieldValue;
};
// 
// type MappedRow<T extends ColumnMapping> = { [K in keyof T as T[K]]: string};

/**
 * @description The DelimitedFileTypeEnum enum defines the possible file types for delimited files.
 * @enum {string} DelimitedFileTypeEnum
 * @property {string} CSV - Comma-separated values (CSV) file type.
 * @property {string} TSV - Tab-separated values (TSV) file type.
 * @property {string} AUTO - call {@link getDelimiterFromFilePath}(filePath, fileType) to detect file type based on file extension.
 */
export enum DelimitedFileTypeEnum {
    CSV = 'csv',
    TSV = 'tsv',
    AUTO = 'auto'
}

/**
 * @enum {string} `DelimiterCharacterEnum`
 * @property {string} TAB  `\t` - Tab character used as a delimiter.
 * @property {string} COMMA  `,` - Comma character used as a delimiter.
 * @description The DelimiterEnum enum defines the possible delimiters for CSV files.
 */
export enum DelimiterCharacterEnum {
    TAB = '\t',
    COMMA = ',',
}