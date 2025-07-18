/**
 * @file src/utils/io/types/Csv.ts
 */

/**
 * @description The DelimitedFileTypeEnum enum defines the possible file types for delimited files.
 * @enum {string} **`DelimitedFileTypeEnum`**
 * @property {string} CSV - Comma-separated values (CSV) file type.
 * @property {string} TSV - Tab-separated values (TSV) file type.
 * @property {string} AUTO - call {@link getDelimiterFromFilePath}`(filePath, fileType)` to detect file type based on file extension.
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