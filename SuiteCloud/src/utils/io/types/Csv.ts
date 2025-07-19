/**
 * @file src/utils/io/types/Csv.ts
 */

/**
 * @keys `string` `filePath` to csv file
 * @values `number[]` - array of csv row indices
 */
export type RowSourceMetaData = {
    [filePath: string]: number[]
}

/**
 * @enum {string} **`DelimitedFileTypeEnum`**
 * @property {string} CSV = `'csv'` Comma-separated values -> `.csv` file.
 * @property {string} TSV = `'tsv'` Tab-separated values -> `.tsv` file.
 * @property {string} AUTO = `'auto'`- call {@link getDelimiterFromFilePath}(filePath, fileType) to detect file type based on file extension.
 */
export enum DelimitedFileTypeEnum {
    CSV = 'csv',
    TSV = 'tsv',
    AUTO = 'auto'
}

/**
 * @enum {string} **`DelimiterCharacterEnum`**
 * @property {string} TAB = `'\t'` - Tab character used as a delimiter.
 * @property {string} COMMA = `','` - Comma character used as a delimiter.
 * @description The DelimiterEnum enum defines the possible delimiters for CSV files.
 */
export enum DelimiterCharacterEnum {
    TAB = '\t',
    COMMA = ',',
}