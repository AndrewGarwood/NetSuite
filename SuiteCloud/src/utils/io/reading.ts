/**
 * @file src/utils/io/reading.ts
 */
import fs from 'fs';
import xlsx from 'xlsx';
import csv from 'csv-parser'; // ~\node_modules\csv-parser\index.d.ts
import { Options as CsvOptions } from "csv-parser"; 
import { Transform, pipeline, TransformOptions } from 'stream';
import { FileExtensionResult, ParseOneToManyOptions } from './types/Reading';
import { FieldValue } from 'src/utils/api/types/Api';
import {ValueMapping, ColumnMapping, isValueMappingEntry, DelimitedFileTypeEnum, MappedRow, DelimiterCharacterEnum } from './types/Csv';
import { stripCharFromString, cleanString, UNCONDITIONAL_STRIP_DOT_OPTIONS } from './regex';
import { BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES } from '../typeValidation';
import { mainLogger as log } from 'src/config/setupLog';



/**
 * @param {string} filePath `string`
 * @param {string} sheetName `string`
 * @param {string} keyColumn `string`
 * @param {string} valueColumn `string`
 * @param {ParseOneToManyOptions} options - {@link ParseOneToManyOptions}
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
        log.error('Error reading or parsing the Excel file:', err, 
            '\n\t Given File Path:', '"' + filePath + '"');
        return {} as Record<string, Array<string>>;
    }
}

/**
 * 
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
    filePath = validateFileExtension(
        filePath, 
        DelimitedFileTypeEnum.CSV
    ).validatedFilePath;
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
        log.error('Error reading or parsing the CSV file:', err, 
            '\n\t Given File Path:', '"' + filePath + '"');
        return {} as Record<string, Array<string>>;
    }
}


/**
 * Parses a delimited text file (CSV/TSV) and maps columns to new names
 * @param filePath Path to the file
 * @param columnMapping Dictionary for column name mapping {@link ColumnMapping}
 * @param valueMapping Optional mapping for specific values {@link ValueMapping}
 * @returns {Promise<MappedRow<T>[]>} Promise with array of mapped objects {@link MappedRow}
 * @param fileType File type ('csv', 'tsv', or 'auto' for detection) {@link DelimitedFileTypeEnum}
 * @throws Error if file reading or parsing fails
 * @example
 * const filePath = 'path/to/file.csv';
 * const columnMapping = {
 *     'First Name': 'firstname',
 *     'Last Name': 'lastname',
 *     'Email Address': 'email',
 * };
 * const csvData = await parseDelimitedFileWithMapping(filePath, columnMapping, DelimitedFileTypeEnum.CSV);
 * console.log(csvData); // prints the mapped data below
 * // [
 * //    { firstname: 'John', lastname: 'Doe', email: 'john@example.com' },
 * //    { firstname: 'Jane', lastname: 'Smith', email: 'jane@example.com' },
 * // ]
 */
export async function parseDelimitedFileWithMapping<T extends ColumnMapping>(
    filePath: string,
    columnMapping: T,
    valueMapping?: ValueMapping,
    fileType: DelimitedFileTypeEnum = DelimitedFileTypeEnum.AUTO,
): Promise<MappedRow<T>[]> {
    return new Promise((resolve, reject) => {
        const results: MappedRow<T>[] = [];
        const mapper = new Transform({
            objectMode: true,
            transform(row: Record<string, string>, _, callback) {
                try {
                    /**
                     * construct mappedRow by processing each [ originalKey: string, newKeys: string|string[] ] entry in columnMapping
                     */
                    const mappedRow = Object.entries(columnMapping).reduce((
                        acc, // accumulator object for mapped row
                        [originalKey, newKeys]
                    ) => {
                        const rawValue = row[originalKey]?.trim() || '';
                        let transformedValue = transformValue(rawValue, originalKey, valueMapping) || '';
                        transformedValue = typeof transformedValue === 'string' 
                            ? transformedValue.replace(/(\s{2,})/g, ' ').replace(/(\.{2,})/g, '.')
                            : transformedValue; 
                        /** mappedRow[d] = transformedValue for d in destinations */
                        const destinations = Array.isArray(newKeys) ? newKeys : [newKeys];
                        
                        for (const newKey of destinations) {
                            if (newKey in acc) {
                                log.debug(`parseDelimitedFileWithMapping(), mappedRow = Object.entries(columnMapping).reduce(...) Overwriting existing field: ${newKey}`);
                            }
                            acc[newKey] = transformedValue;
                        }             
                        return acc;
                    },
                    {} as Record<string, FieldValue>);
                    this.push(mappedRow);
                    callback();
                } catch (error) {
                    callback(error as Error);
                }
            },
        });
        const delimiter = getDelimiterFromFilePath(filePath, fileType);
        /**{@link CsvOptions} */
        // let csvParserOptions: CsvOptions = { separator: delimiter };
        pipeline(
            fs.createReadStream(filePath),
            csv(
                { separator: delimiter }
            ),
            mapper,
            (error) => error && reject(error)
        );
        mapper
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

/**
 * @deprecated
 * @param {string} originalValue - The original value to be transformed with valueMapping or default operaitons
 * @param {string} originalKey  - The original column header (`key`) of the value being transformed
 * @param {ValueMapping} [valueMapping] {@link ValueMapping}
 * @returns `transformedValue` {@link FieldValue}
 */
export function transformValue(
    originalValue: string, 
    originalKey: string, 
    valueMapping?: ValueMapping
): FieldValue {
    let trimmedValue = originalValue.trim();
    if (valueMapping && trimmedValue in valueMapping) {
        return checkForOverride(trimmedValue, originalKey, valueMapping);
    }

    // Fallback to automatic type conversion
    try {
        if (BOOLEAN_TRUE_VALUES.includes(trimmedValue.toLowerCase())) return true;
        if (BOOLEAN_FALSE_VALUES.includes(trimmedValue.toLowerCase())) return false;
        
        // const parsedDate = new Date(trimmedVal`ue);
        // if (!isNaN(parsedDate.getTime())) return parsedDate;
        
        return trimmedValue;
    } catch (error) {
        log.warn(`Could not parse value: ${trimmedValue}`);
        return trimmedValue;
    }
}
/**
 * 
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
 * 
 * @param {string} filePath `string`
 * @returns {Array<string>} `jsonData` — `Array<string>`
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
        log.error('Error reading the file:', err);
    }
    return result;
}

/**
 * 
 * @param {string} filePath `string`
 * @returns {Record<string, any> | null} `jsonData` — `Record<string, any> | null` - JSON data as an object or null if an error occurs
 */
export function readJsonFileAsObject(filePath: string): Record<string, any> | null {
    filePath = validateFileExtension(filePath, 'json').validatedFilePath;
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        log.error('Error reading or parsing the JSON file:', err, 
            '\n\t Given File Path:', '"' + filePath + '"');
        return null;
    }
}


/**
 * @param {string} filePath `string`
 * @param {string} expectedExtension `string`
 * @returns `result`: {@link FileExtensionResult} = `{ isValid`: `boolean`, `validatedFilePath`: `string }`
 */
export function validateFileExtension(filePath: string, expectedExtension: string): FileExtensionResult {
    let isValid = false;
    let validatedFilePath = filePath;
    if (filePath && filePath.endsWith(`.${expectedExtension}`)) {
        isValid = true;
    } else {
        validatedFilePath = `${filePath}.${stripCharFromString(expectedExtension, UNCONDITIONAL_STRIP_DOT_OPTIONS)}`;
    }
    return { isValid, validatedFilePath };
}


