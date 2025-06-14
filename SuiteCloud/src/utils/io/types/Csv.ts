/**
 * @file src/utils/io/types/Csv.ts
 */
import { 
    FieldValue,
} from "../../api/types/Api";

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

/**
 * @description The DelimitedFileTypeEnum enum defines the possible file types for delimited files.
 * @enum {string} **`DelimitedFileTypeEnum`**
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
 * @enum {string} **`DelimiterCharacterEnum`**
 * @property {string} TAB  `\t` - Tab character used as a delimiter.
 * @property {string} COMMA  `,` - Comma character used as a delimiter.
 * @description The DelimiterEnum enum defines the possible delimiters for CSV files.
 */
export enum DelimiterCharacterEnum {
    TAB = '\t',
    COMMA = ',',
}