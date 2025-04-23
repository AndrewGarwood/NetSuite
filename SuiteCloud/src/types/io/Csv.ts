/**
 * @file src/types/io/Csv.ts
 * @description Types and Enums for handling CSV files, including column mappings and delimiters.
 * @module Csv
 */

import { FieldValue } from "../api/";
/** 
 * Mapping of original column names to NetSuite column names
 * - Record<string, string>, an entry = [originalKey, newKey] 
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
 * @description Checks if the given value is a ValueMappingEntry.
 * @param value - The value to check.
 */
export function isValueMappingEntry(value: any): value is ValueMappingEntry {
    return typeof value === 'object' && 'newValue' in value && 'validColumns' in value;
}



export type ValueMapping = Record<string, FieldValue | ValueMappingEntry>;
/**
 * @description The MappedRow type remaps the keys of the input 
 * type T (a {@link ColumnMapping}) to its values, and assigns the type string to all 
 * the new keys
 * @Notes
 * - `T extends ColumnMapping` - ensures that T is an object with string keys and string values, see {@link ColumnMapping}
 * Mapped Type Syntax: `{ [K in keyof T as T[K]]: string }`
 * - ` [K in keyof T` - iterates over the keys of T using "keyof T" and creates a new object type. 
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
 * @enum {string} DelimiterEnum
 * @property {string} TAB  `\t` - Tab character used as a delimiter.
 * @property {string} COMMA  `,` - Comma character used as a delimiter.
 * @description The DelimiterEnum enum defines the possible delimiters for CSV files.
 */
export enum DelimiterEnum {
    TAB = '\t',
    COMMA = ',',
}


/*
~\node_modules\csv-parser\index.d.ts
 * interface Options // CSV parser.
 * @property {string} separator - {@link separator} Specifies a single-character string to use as the column separator for each row.
 * @property {string} escape - {@link escape} A single-character string used to specify the character used to escape strings in a CSV row.
 * @property {ReadonlyArray<string> | boolean} headers - {@link headers} Specifies the headers to use. Headers define the property key for each value in a CSV row. If no `headers` option is provided, `csv-parser` will use the first line in a CSV file as the header specification.
 * @property {(args: { header: string; index: number }): string | null} mapHeaders - {@link mapHeaders} A function that can be used to modify the values of each header. Return `null` to remove the header, and it's column, from the results.
 * @property {(args: { header: string; index: number; value: any }): any} mapValues - {@link mapValues} A function that can be used to modify the value of each column value.
 * @property {string} newline - {@link newline} Specifies a single-character string to denote the end of a line in a CSV file.
 * @property {string} quote - {@link quote} Specifies a single-character string to denote a quoted string.
 * @property {boolean} raw - {@link raw} If `true`, instructs the parser not to decode UTF-8 strings.
 * @property {boolean} skipComments - {@link skipComments} Instructs the parser to ignore lines which represent comments in a CSV file.
 * @property {number} skipLines - {@link skipLines} Specifies the number of lines at the beginning of a data file that the parser should skip over, prior to parsing headers.
 * @property {Number.MAX_SAFE_INTEGER} maxRowBytes - {@link maxRowBytes} Maximum number of bytes per row. An error is thrown if a line exceeds this value.
 * @property {boolean} strict - {@link strict} If `true`, instructs the parser that the number of columns in each row must match the number of `headers` specified.
 * @property {boolean} outputByteOffset - {@link outputByteOffset} If `true`, instructs the parser to emit each row with a `byteOffset` property.
 */