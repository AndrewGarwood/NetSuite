/**
 * @file src/utils/io/reading.ts
 */
import fs from 'fs';
import xlsx from 'xlsx';
import { ParseOneToManyOptions } from './types/Reading';
import { stripCharFromString, cleanString, UNCONDITIONAL_STRIP_DOT_OPTIONS } from './regex';
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from 'src/config/setupLog';
import { DelimiterCharacterEnum, ValueMapping, DelimitedFileTypeEnum } from './types';
import { FieldValue } from '../api/types/InternalApi';
import { isValueMappingEntry } from '../typeValidation';


/**
 * @param filePath `string`
 * @param delimiter `string` {@link DelimiterCharacterEnum}
 * @returns **`isValidCsv`** `boolean`
 * - `true` if the CSV file at `filePath` is valid (all rows have the same number of columns as the header),
 * - `false` `otherwise`. 
 */
export function isValidCsv(
    filePath: string, 
    delimiter: DelimiterCharacterEnum | string,
): boolean {
    if (!filePath || !fs.existsSync(filePath)) {
        mlog.error(`ERROR isValidCsv(): path does not exist: ${filePath}`);
        return false;
    }
    if (!delimiter || delimiter.length === 0) {
        mlog.error(`ERROR isValidCsv(): invalid delimiter: ${delimiter}`);
        return false;
    }   
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    if (lines.length < 2) {
        mlog.error(`ERROR isValidCsv(): file has less than 2 lines: ${filePath}`);
        return false;
    }
    const header: string[] = lines[0].split(delimiter).map(col => col.trim());
    if (header.length < 1) {
        mlog.error(`ERROR isValidCsv(): no header found in file: ${filePath}`);
        return false;
    }
    // Check if all rows have the same number of columns as the header
    for (let i = 1; i < lines.length; i++) {
        const rowValues: string[] = lines[i].split(delimiter).map(col => col.trim());
        if (header.length !== rowValues.length 
            && i !== lines.length-1 // allow for empty last row in files.
        ) {
            mlog.warn(`isValidCsv(): Invalid row found: header.length !== rowValues.length`,
                TAB+`   header.length: ${header.length},`,
                TAB+`rowValues.length: ${rowValues.length}`,
                TAB+` -> Difference =  ${header.length - rowValues.length}`,
                TAB+`   header: ${JSON.stringify(header)}`,
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
            let key: string = cleanString(
                String(row[keyColumn]), 
                keyStripOptions, 
                keyCaseOptions, 
                keyPadOptions
            ).trim().replace(/\.$/, '');
            let val: string = cleanString(
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
                let key = cleanString(
                    line[keyIndex],
                    keyStripOptions, 
                    keyCaseOptions, 
                    keyPadOptions
                );
                let val = cleanString(
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
 * Determines the proper delimiter based on file type or extension
 * @param filePath Path to the file
 * @param fileType Explicit file type or `'auto'` for detection
 * @returns `extension` `{`{@link DelimiterCharacterEnum}` | string}` The delimiter character
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
        throw new Error(`Unsupported file extension: ${extension}`);
    }
}

/**
 * @param filePath `string`
 * @returns {Array<string>} **`jsonData`** — `Array<string>`
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
 * 
 * @param filePath `string`
 * @returns {Record<string, any> | null} **`jsonData`** — `Record<string, any> | null` - JSON data as an object or null if an error occurs
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
        validatedFilePath = `${filePath}.${stripCharFromString(expectedExtension, UNCONDITIONAL_STRIP_DOT_OPTIONS)}`;
    }
    return { isValid, validatedFilePath };
}


