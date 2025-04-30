/**
 * @file src/utils/io/reading.ts
 */
import fs from 'fs';
import xlsx from 'xlsx';
import csv from 'csv-parser'; // ~\node_modules\csv-parser\index.d.ts
import { Options as CsvOptions } from "csv-parser"; 
import { Transform, pipeline, TransformOptions } from 'stream';
import { FileExtensionResult } from '../../types/io/Reading';
import { FieldValue } from 'src/types/api/Api';
import {ValueMapping, ColumnMapping, isValueMappingEntry, DelimitedFileTypeEnum, MappedRow, DelimiterEnum } from '../../types/io/CsvMapping';
import { stripChar } from './regex';

/**
 * 
 * @param {string} filePath string
 * @returns {Array<string>} jsonData — Array\<string>
 */
export function readFileLinesIntoArray(filePath: string): Array<string> {
    const result = [];
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                result.push(line.trim());
            }
        }
    } catch (err) {
        console.error('Error reading the file:', err);
    }
    return result;
}

/**
 * 
 * @param {string} filePath string
 * @returns {Object.<string, any> | null} jsonData — Object.<string, any>
 */
export function readJsonFileAsObject(filePath: string): { [s: string]: any; } | null {
    filePath = validateFileExtension(filePath, 'json').validatedFilePath;
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        console.error('Error reading or parsing the JSON file:', err);
        console.error('\tGiven File Path:', '"' + filePath + '"');
        return null;
    }
}


/**
 * @param {string} filePath string
 * @param {string} expectedExtension string
 * @returns {FileExtensionResult} .{@link FileExtensionResult} = { isValid: boolean, validatedFilePath: string }
 */
export function validateFileExtension(filePath: string, expectedExtension: string): FileExtensionResult {
    let isValid = false;
    let validatedFilePath = filePath;
    if (filePath && filePath.endsWith(`.${expectedExtension}`)) {
        isValid = true;
    } else {
        validatedFilePath = `${filePath}.${stripChar(expectedExtension, '.', true)}`;
    }
    return { isValid, validatedFilePath };
}

/**
 * @param {string} filePath string
 * @param {string} sheetName string
 * @param {string} keyColumn string
 * @param {string} valueColumn string
 * @returns {Object.<string, Array<string>>} dict: Object.<string, Array\<string>> — key-value pairs where key is from keyColumn and value is an array of values from valueColumn
 */
export function parseExcelForOneToMany(filePath: string, sheetName: string, keyColumn: string, valueColumn: string): { [s: string]: Array<string>; } {
    filePath = validateFileExtension(
        filePath, 
        'xlsx'
    ).validatedFilePath;
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[] = xlsx.utils.sheet_to_json(sheet);
    /**@type {Object.<string, Array<string>>} */
    const dict: { [s: string]: Array<string>; } = {};
    jsonData.forEach(row => {
        let key = row[keyColumn];
        key = `${key}`.trim().replace(/\.$/, '');
        let val = row[valueColumn];
        val = `${val}`.trim().replace(/\.$/, '').padStart(5, '0');
        if (!dict[key]) {
            dict[key] = [];
        }
        if (!dict[key].includes(val)) {
            dict[key].push(val);
        }
    });
    return dict;
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
        // Helper function to parse and transform values
        // Create transform stream for mapping columns
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
                                console.log(`parseDelimitedFileWithMapping(), mappedRow = Object.entries(columnMapping).reduce(...) Overwriting existing field: ${newKey}`);
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
 * 
 * @param {string} originalValue - The original value to be transformed with valueMapping or default operaitons
 * @param {string} originalKey  - The original column header (key) of the value being transformed
 * @param {ValueMapping} [valueMapping] {@link ValueMapping}
 * @returns transformedValue {@link FieldValue}
 */
export function transformValue(
    originalValue: string, 
    originalKey: string, 
    valueMapping?: ValueMapping
): FieldValue {
    const trimmedValue = originalValue.trim();
    if (valueMapping && trimmedValue in valueMapping) {
        const mapping = valueMapping[trimmedValue];
        if (isValueMappingEntry(mapping)) {
            const validColumns = Array.isArray(mapping.validColumns) 
                ? mapping.validColumns 
                : [mapping.validColumns];
                
            if (validColumns.includes(originalKey)) {
                return mapping.newValue;
            }
        } else {
            // Handle simple value mapping (applies to all columns)
            return mapping;
        }
    }
    const BOOLEAN_TRUE_VALUES = ['true', 'yes', 'y'];
    const BOOLEAN_FALSE_VALUES = ['false', 'no', 'n'];
    // Fallback to automatic type conversion
    try {
        if (BOOLEAN_TRUE_VALUES.includes(trimmedValue.toLowerCase())) return true;
        if (BOOLEAN_FALSE_VALUES.includes(trimmedValue.toLowerCase())) return false;
        
        const parsedDate = new Date(trimmedValue);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
        
        return trimmedValue;
    } catch (error) {
        console.warn(`Could not parse value: ${trimmedValue}`);
        return trimmedValue;
    }
}



/**
 * Determines the proper delimiter based on file type or extension
 * @param filePath Path to the file
 * @param fileType Explicit file type or 'auto' for detection
 * @returns `extension` `{`{@link DelimiterEnum}` | string}` The delimiter character
 */
export function getDelimiterFromFilePath(filePath: string, fileType?: DelimitedFileTypeEnum): DelimiterEnum | string {
    if (fileType && fileType === DelimitedFileTypeEnum.CSV) return DelimiterEnum.COMMA;
    if (fileType && fileType === DelimitedFileTypeEnum.TSV) return DelimiterEnum.TAB;
    
    // Auto-detect based on file extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension === DelimitedFileTypeEnum.CSV) {
        return DelimiterEnum.COMMA;
    } else if (extension === DelimitedFileTypeEnum.TSV) {
        return DelimiterEnum.TAB;
    } else {
        throw new Error(`Unsupported file extension: ${extension}`);
    }
}