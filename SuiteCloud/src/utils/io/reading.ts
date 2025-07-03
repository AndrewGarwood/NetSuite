/**
 * @file src/utils/io/reading.ts
 */
import fs from 'fs';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { StringCaseOptions, StringPadOptions, StringReplaceOptions, StringStripOptions } from './regex/index';
import { ParseOneToManyOptions,} from './types/Reading';
import { applyStripOptions, clean, UNCONDITIONAL_STRIP_DOT_OPTIONS } from './regex/index'
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from 'src/config/setupLog';
import { DelimiterCharacterEnum, ValueMapping, DelimitedFileTypeEnum } from './types';
import { FieldValue } from '../api/types/InternalApi';
import { isNonEmptyArray, isValueMappingEntry, anyNull } from '../typeValidation';


/**
 * @param filePath `string`
 * @param requiredHeaders `string[]` - `optional` array of headers that must be present in the CSV file.
 * - If provided, the function checks if all required headers are present in the CSV header row
 * @returns **`isValidCsv`** `boolean`
 * - **`true`** `if` the CSV file at `filePath` is valid (all rows have the same number of columns as the header),
 * - **`false`** `otherwise`. 
 */
export function isValidCsv(
    filePath: string,
    requiredHeaders?: string[]
): boolean {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        mlog.error(`[ERROR isValidCsv()]: path does not exist: ${filePath}`);
        return false;
    }
    const delimiter = getDelimiterFromFilePath(filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    if (lines.length < 2) {
        mlog.error(`[ERROR isValidCsv()]: file has less than 2 lines: ${filePath}`);
        return false;
    }
    const headerRow: string[] = lines[0].split(delimiter).map(col => col.trim());
    if (headerRow.length < 1) {
        mlog.error(`[ERROR isValidCsv()]: no header found in file: ${filePath}`);
        return false;
    }
    if (isNonEmptyArray(requiredHeaders)) {
        const hasRequiredHeaders = requiredHeaders.every(header => {
            if (!header || typeof header !== 'string') {
                throw new Error([
                    `[reading.isValidCsv]: Invalid parameter: 'requiredHeaders`,
                    `requiredHeaders must be of type: Array<string>, but`,
                    `found array element of type: '${typeof header}'`
                ].join(' '))
            }
            return headerRow.includes(header)
        });
        if (!hasRequiredHeaders) {
            mlog.warn(`[isValidCsv()]: Required headers missing from headerRow`,
                TAB+`filePath: '${filePath}'`,
                TAB+`requiredHeaders: ${JSON.stringify(requiredHeaders)}`,
                TAB+` csvFileHeaders: ${JSON.stringify(headerRow)}`
            ) 
            return false; 
        }
    }
    // Check if all rows have the same number of columns as the header
    for (let i = 1; i < lines.length; i++) {
        const rowValues: string[] = lines[i].split(delimiter).map(col => col.trim());
        if (headerRow.length !== rowValues.length 
            && i !== lines.length-1 // allow for empty last row in files.
        ) {
            mlog.warn(`[isValidCsv()]: Invalid row found: header.length !== rowValues.length`,
                TAB+`   header.length: ${headerRow.length},`,
                TAB+`rowValues.length: ${rowValues.length}`,
                TAB+` -> Difference =  ${headerRow.length - rowValues.length}`,
                TAB+`   header: ${JSON.stringify(headerRow)}`,
                TAB+`rowValues: ${JSON.stringify(rowValues)}`,
                TAB+` rowIndex: ${i},`,
                TAB+` filePath: '${filePath}'`,
                NL+`returning false...`
            );
            return false;
        }
    }
    return true;
}
/**
 * @param filePath `string`
 * @param sheetName `string`
 * @param keyColumn `string`
 * @param valueColumn `string`
 * @param options - {@link ParseOneToManyOptions}
 * = `{ keyStripOptions`?: {@link StringStripOptions}, `valueStripOptions`?: {@link StringStripOptions}, keyCaseOptions`?: {@link StringCaseOptions}, `valueCaseOptions`?: {@link StringCaseOptions}, `keyPadOptions`?: {@link StringPadOptions}, `valuePadOptions`?: {@link StringPadOptions} `}`
 * - {@link StringStripOptions} = `{ char`: `string`, `escape`?: `boolean`, `stripLeftCondition`?: `(s: string, ...args: any[]) => boolean`, `leftArgs`?: `any[]`, `stripRightCondition`?: `(s: string, ...args: any[]) => boolean`, `rightArgs`?: `any[] }`
 * - {@link StringCaseOptions} = `{ toUpper`?: `boolean`, `toLower`?: `boolean`, `toTitle`?: `boolean }`
 * - {@link StringPadOptions} = `{ padLength`: `number`, `padChar`?: `string`, `padLeft`?: `boolean`, `padRight`?: `boolean }`
 * @returns {Record<string, Array<string>>} `dict`: `Record<string, Array<string>>` — key-value pairs where key is from `keyColumn` and value is an array of values from `valueColumn`
 */
export function parseExcelForOneToMany(
    filePath: string, 
    sheetName: string, 
    keyColumn: string, 
    valueColumn: string,
    options: ParseOneToManyOptions = {},
): Record<string, Array<string>> {
    filePath = validateFileExtension(
        filePath, 
        'xlsx'
    ).validatedFilePath;
    try {
        const { 
            keyStripOptions, valueStripOptions, 
            keyCaseOptions, valueCaseOptions, 
            keyPadOptions, valuePadOptions 
        } = options;
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = xlsx.utils.sheet_to_json(sheet);
        const dict: Record<string, Array<string>> = {};
        jsonData.forEach(row => {
            let key: string = clean(
                String(row[keyColumn]), 
                keyStripOptions, 
                keyCaseOptions, 
                keyPadOptions
            ).trim().replace(/\.$/, '');
            let val: string = clean(
                String(row[valueColumn]),
                valueStripOptions, 
                valueCaseOptions, 
                valuePadOptions
            ).trim().replace(/\.$/, '');
            if (!dict[key]) {
                dict[key] = [];
            }
            if (!dict[key].includes(val)) {
                dict[key].push(val);
            }
        });
        return dict;
    } catch (err) {
        mlog.error('Error reading or parsing the Excel file:', err, 
            TAB+'Given File Path:', '"' + filePath + '"');
        return {} as Record<string, Array<string>>;
    }
}

/**
 * @param filePath `string`
 * @param keyColumn `string`
 * @param valueColumn `string`
 * @param delimiter {@link DelimiterCharacters} | `string`
 * @param options {@link ParseOneToManyOptions}
 * = `{ keyCaseOptions`?: {@link StringCaseOptions}, `valueCaseOptions`?: {@link StringCaseOptions}, `keyPadOptions`?: {@link StringPadOptions}, `valuePadOptions`?: {@link StringPadOptions} `}`
 * - {@link StringCaseOptions} = `{ toUpper`?: `boolean`, `toLower`?: `boolean`, `toTitle`?: `boolean }`
 * - {@link StringPadOptions} = `{ padLength`: `number`, `padChar`?: `string`, `padLeft`?: `boolean`, `padRight`?: `boolean }`
 * @returns `Record<string, Array<string>>` - key-value pairs where key is from `keyColumn` and value is an array of values from `valueColumn`
 */
export function parseCsvForOneToMany(
    filePath: string,
    keyColumn: string,
    valueColumn: string,
    delimiter: DelimiterCharacterEnum | string = DelimiterCharacterEnum.COMMA,
    options: ParseOneToManyOptions = {},
): Record<string, Array<string>> {
    try {
        const { 
            keyStripOptions, valueStripOptions, 
            keyCaseOptions, valueCaseOptions, 
            keyPadOptions, valuePadOptions 
        } = options;
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');
        const dict: Record<string, Array<string>> = {};
        const header = lines[0].split(delimiter).map(col => col.trim());
        const keyIndex = header.indexOf(keyColumn);
        const valueIndex = header.indexOf(valueColumn);
        if (keyIndex === -1 || valueIndex === -1) {
            throw new Error(`Key or value column not found in CSV file.`);
        }
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].split(delimiter).map(col => col.trim());
            if (line.length > 1) {
                let key = clean(
                    line[keyIndex],
                    keyStripOptions, 
                    keyCaseOptions, 
                    keyPadOptions
                );
                let val = clean(
                    line[valueIndex],
                    valueStripOptions,
                    valueCaseOptions, 
                    valuePadOptions
                );
                if (!dict[key]) {
                    dict[key] = [];
                }
                if (!dict[key].includes(val)) {
                    dict[key].push(val);
                }
            }
        }
        return dict;
    } catch (err) {
        mlog.error('Error reading or parsing the CSV file:', err, 
            TAB+'Given File Path:', '"' + filePath + '"');
        return {} as Record<string, Array<string>>;
    }
}


/**
 * Determines the proper delimiter based on file type or extension
 * @param filePath `string` Path to the file
 * @param fileType Explicit file type or `'auto'` for detection
 * @returns **`delimiter`** `{`{@link DelimiterCharacterEnum}` | string}` The delimiter character
 * @throws an error if the file extension is unsupported
 */
export function getDelimiterFromFilePath(
    filePath: string, 
    fileType?: DelimitedFileTypeEnum
): DelimiterCharacterEnum | string {
    if (fileType && fileType === DelimitedFileTypeEnum.CSV) return DelimiterCharacterEnum.COMMA;
    if (fileType && fileType === DelimitedFileTypeEnum.TSV) return DelimiterCharacterEnum.TAB;
    
    // Auto-detect based on file extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension === DelimitedFileTypeEnum.CSV) {
        return DelimiterCharacterEnum.COMMA;
    } else if (extension === DelimitedFileTypeEnum.TSV) {
        return DelimiterCharacterEnum.TAB;
    } else {
        throw new Error(`[reading.getDelimiterFromFilePath()] Unsupported file extension: ${extension}`);
    }
}

/**
 * @param filePath `string`
 * @returns **`jsonData`** — `Array<string>`
 */
export function readFileLinesIntoArray(filePath: string): Array<string> {
    const result: string[] = [];
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                result.push(line.trim());
            }
        }
    } catch (err) {
        mlog.error('Error reading the file:', err);
    }
    return result;
}

/**
 * @param filePath `string`
 * @returns **`jsonData`** — `Record<string, any> | null` - JSON data as an object or null if an error occurs
 */
export function readJsonFileAsObject(filePath: string): Record<string, any> | null {
    filePath = validateFileExtension(filePath, 'json').validatedFilePath;
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        mlog.error('Error reading or parsing the JSON file:', err, 
            TAB+'Given File Path:', '"' + filePath + '"');
        return null;
    }
}


/**
 * @param filePath `string`
 * @param expectedExtension `string`
 * @returns **`result`** = `{ isValid`: `boolean`, `validatedFilePath`: `string }`
 */
export function validateFileExtension(filePath: string, expectedExtension: string): {isValid: boolean, validatedFilePath: string} {
    let isValid = false;
    let validatedFilePath = filePath;
    if (filePath && filePath.endsWith(`.${expectedExtension}`)) {
        isValid = true;
    } else {
        validatedFilePath = `${filePath}.${applyStripOptions(expectedExtension, UNCONDITIONAL_STRIP_DOT_OPTIONS)}`;
    }
    return { isValid, validatedFilePath };
}

/**
 * @param originalValue - the initial value to check if it should be overwritten
 * @param originalKey - the original column header (`key`) of the value being transformed
 * @param valueOverrides see {@link ValueMapping}
 * @returns **`mappedValue?.newValue`**: {@link FieldValue} if `originalValue` satisfies `valueOverrides`, otherwise returns `initialValue`
 */
export function checkForOverride(
    originalValue: string, 
    originalKey: string, 
    valueOverrides: ValueMapping
): FieldValue {
    if (!originalValue || !valueOverrides 
        || typeof valueOverrides !== 'object' || Object.keys(valueOverrides).length === 0
    ) {
        return originalValue;
    }   
    if (Object.keys(valueOverrides).includes(originalValue)) {
        let mappedValue = valueOverrides[originalValue as keyof typeof valueOverrides];
        if (isValueMappingEntry(mappedValue) && mappedValue.validColumns) {
            const validColumns = Array.isArray(mappedValue.validColumns) 
                ? mappedValue.validColumns 
                : [mappedValue.validColumns];
            if (validColumns.includes(originalKey)) {
                return mappedValue.newValue as FieldValue;
            }
        } else {
            return mappedValue as FieldValue;
        }
    }
    return originalValue;
}


/**
 * @param filePath `string`
 * @returns **`rows`** `Promise<Array<Record<string, any>>>` 
 * - an array of objects representing rows from a CSV file.
 */
export async function getCsvRows(
    filePath: string
): Promise<Array<Record<string, any>>> {
    const delimiter = getDelimiterFromFilePath(filePath);
    if (!delimiter || !isValidCsv(filePath)) {
        return []
    }
    const rows: Array<Record<string, any>> = []; 
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv({ separator: delimiter }))
            .on('data', async (row: Record<string, any>) => {
                rows.push(row);
            })
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}


/**
 * @param rows `Record<string, any>[]` - array of objects representing rows from a csv file. 
 * @param keyColumn `string` - the column name whose contents will be keys in the dictionary.
 * @param valueColumn `string` - the column name whose contents will be used as values in the dictionary.
 * @returns **`dict`** `Record<string, string>`
 */
export function getOneToOneDictionary(
    rows: Record<string, any>[],
    keyColumn: string,
    valueColumn: string,
): Record<string, string> {
    if (!isNonEmptyArray(rows) || !keyColumn || !valueColumn) {
        throw new Error(`[getOneToOneDictionary()] Invalid parameters: rows, keyColumn, valueColumn`);
    }
    const dict: Record<string, string> = {};
    for (const row of rows) {
        const key = String(row[keyColumn]).trim();
        const value = String(row[valueColumn]).trim();
        if (!key || !value) {
            mlog.warn(`[getOneToOneDictionary()] Row missing key or value column:`, 
                TAB+`keyColumn: '${keyColumn}', valueColumn: '${valueColumn}'`
            );
            continue;
        }
        if (dict[key]) {
            mlog.warn(`[getOneToOneDictionary()] Duplicate key found: '${key}'`,
                TAB+`overwriting value '${dict[key]}' with '${value}'`
            );
        }
        dict[key] = value;
    }
    return dict;
}
