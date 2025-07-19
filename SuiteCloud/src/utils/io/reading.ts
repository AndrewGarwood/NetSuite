/**
 * @file src/utils/io/reading.ts
 */
import path from "node:path";
import fs from "fs";
import csv from "csv-parser";
import xlsx from "xlsx";
import { RegExpFlagsEnum, StringCaseOptions, stringEndsWithAnyOf, StringPadOptions, StringReplaceOptions, StringStripOptions } from "./regex/index";
import { ParseOneToManyOptions,} from "./types/Io";
import { applyStripOptions, clean, UNCONDITIONAL_STRIP_DOT_OPTIONS } from "./regex/index"
import { STOP_RUNNING } from "src/config/env";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "src/config/setupLog";
import { DelimiterCharacterEnum, ValueMapping, DelimitedFileTypeEnum, isValueMappingEntry } from "./types";
import { isNonEmptyArray, anyNull, isNullLike as isNull, hasKeys, isNonEmptyString, isEmptyArray } from "../typeValidation";
import * as validate from "../argumentValidation";

type FieldValue = Date | number | number[] | string | string[] | boolean | null;
/**
 * @consideration make requiredHeaders a rest parameter i.e. `...string[]`
 * @TODO handle csv where a value contains the delimiter character
 * @param filePath `string` - must be a string to an existing file, otherwise return `false`.
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
    validate.existingPathArgument(`reading.isValidCsv`, {filePath});
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
            if (!isNonEmptyString(header)) {
                mlog.warn([
                    `[reading.isValidCsv]: Invalid parameter: 'requiredHeaders`,
                    `requiredHeaders must be of type: Array<string>, but`,
                    `found array element of type: '${typeof header}' (skipping)`
                ].join(' '));
                return true; // skip headers if they are not strings
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
        // this is a naive way to check nested delims, 
        // should instead do it by iterating through string and identifying 
        // quotation mark start and end pairs
        // const nestedDelimiterPattern = new RegExp(
        //     `(?<=(^|${delimiter})".+)` + delimiter + `(?=.+"(${delimiter}|$))`, 
        //     "ig"
        // );
        const rowValues: string[] = (lines[i]
            // .replace(nestedDelimiterPattern, '_')
            .split(delimiter)
            .map(val => val.trim())
        );
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

/** paths to folders or files */
export async function validatePath(...paths: string[]): Promise<void> {
    for (const path of paths) {
        if (!fs.existsSync(path)) {
            throw new Error(`[ERROR reading.validatePath()]: path does not exist: ${path}`);
        }
    }
}


/**
 * @TODO implement overload that uses CleanStringOptions
 * @param filePath `string`
 * @param sheetName `string`
 * @param keyColumn `string`
 * @param valueColumn `string`
 * @param options - {@link ParseOneToManyOptions}
 * = `{ keyStripOptions`?: {@link StringStripOptions}, `valueStripOptions`?: {@link StringStripOptions}, keyCaseOptions`?: {@link StringCaseOptions}, `valueCaseOptions`?: {@link StringCaseOptions}, `keyPadOptions`?: {@link StringPadOptions}, `valuePadOptions`?: {@link StringPadOptions} `}`
 * - {@link StringStripOptions} = `{ char`: `string`, `escape`?: `boolean`, `stripLeftCondition`?: `(s: string, ...args: any[]) => boolean`, `leftArgs`?: `any[]`, `stripRightCondition`?: `(s: string, ...args: any[]) => boolean`, `rightArgs`?: `any[] }`
 * - {@link StringCaseOptions} = `{ toUpper`?: `boolean`, `toLower`?: `boolean`, `toTitle`?: `boolean }`
 * - {@link StringPadOptions} = `{ padLength`: `number`, `padChar`?: `string`, `padLeft`?: `boolean`, `padRight`?: `boolean }`
 * @returns **`dict`** `Record<string, Array<string>>` — key-value pairs where key is from `keyColumn` and value is an array of values from `valueColumn`
 */
export function parseExcelForOneToMany(
    filePath: string, 
    sheetName: string, 
    keyColumn: string, 
    valueColumn: string,
    options: ParseOneToManyOptions = {},
): Record<string, Array<string>> {
    filePath = validateFileExtension(filePath, 'xlsx');
    validate.stringArgument(`reading.parseExcelForOneToMany`, `filePath`, filePath);
    validate.stringArgument(`reading.parseExcelForOneToMany`, `sheetName`, sheetName);
    validate.stringArgument(`reading.parseExcelForOneToMany`, `keyColumn`, keyColumn);
    validate.stringArgument(`reading.parseExcelForOneToMany`, `valueColumn`, valueColumn);
    try {
        const { 
            keyStripOptions, valueStripOptions, 
            keyCaseOptions, valueCaseOptions, 
            keyPadOptions, valuePadOptions 
        } = options;
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, any>[] = xlsx.utils.sheet_to_json(sheet);
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
    filePath = validateFileExtension(filePath, 
        (delimiter === DelimiterCharacterEnum.TAB) ? 'tsv' : 'csv'
    );
    validate.stringArgument(`reading.parseCsvForOneToMany`, `filePath`, filePath);
    validate.stringArgument(`reading.parseCsvForOneToMany`, `keyColumn`, keyColumn);
    validate.stringArgument(`reading.parseCsvForOneToMany`, `valueColumn`, valueColumn);
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
        mlog.error('[readFileLinesIntoArray()] Error reading the file:', err);
    }
    return result;
}

/**
 * @param filePath `string`
 * @returns **`jsonData`** — `Record<string, any>` 
 * - JSON data as an object
 */
export function readJsonFileAsObject(filePath: string): Record<string, any> {
    filePath = validateFileExtension(filePath, 'json');
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        mlog.error('[readJsonFileAsObject()] Error reading or parsing the JSON file:',
            TAB+`Given filePath: '${filePath}'`
        );
        throw new Error(JSON.stringify(err))
    }
}


/**
 * @param filePath `string`
 * @param expectedExtension `string`
 * @returns **`validatedFilePath`** `string` 
 */
export function validateFileExtension(filePath: string, expectedExtension: string): string {
    validate.stringArgument(`reading.validateFileExtension`, `filePath`, filePath);
    validate.stringArgument(`reading.validateFileExtension`, `expectedExtension`, expectedExtension);
    expectedExtension = expectedExtension.replace(/\./, '');
    if (filePath.endsWith(`.${expectedExtension}`)) {
        return filePath
    } 
    return filePath + '.' + expectedExtension;
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
        || typeof valueOverrides !== 'object' || isEmptyArray(Object.keys(valueOverrides))
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

export async function getRows(
    filePath: string,
    sheetName: string = 'Sheet1'
): Promise<Record<string, any>[]> {
    validate.existingPathArgument(`reading.getRows`, {filePath});
    if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
        return getExcelRows(filePath, sheetName);
    }
    return getCsvRows(filePath);
}


export async function getExcelRows(
    filePath: string,
    sheetName: string = 'Sheet1'
): Promise<Record<string, any>[]> {
    validate.existingPathArgument(`reading.getExcelRows`, {filePath});
    const validatedFilePath = validateFileExtension(filePath, 'xlsx');
    try {
        const workbook = xlsx.readFile(validatedFilePath);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            mlog.error(`[getExcelRows()] Sheet '${sheetName}' not found in file: ${validatedFilePath}`);
            return [];
        }
        const jsonData: Record<string, any>[] = xlsx.utils.sheet_to_json(sheet);
        return jsonData;
    } catch (err) {
        mlog.error('Error reading or parsing the Excel file:', err, 
            TAB+`Given File Path: '${filePath}'`);
        return [];
    }
}

/**
 * @param filePath `string`
 * @returns **`rows`** `Promise<Record<string, any>[]>` 
 * - an array of objects representing rows from a CSV file.
 */
export async function getCsvRows(
    filePath: string
): Promise<Record<string, any>[]> {
    validate.existingPathArgument(`reading.getCsvRows`, {filePath});
    const delimiter = getDelimiterFromFilePath(filePath);
    if (!delimiter) {
        return []
    }
    const rows: Record<string, any>[] = []; 
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
 * @param arg1 `string | Record<string, any>[]` - the file path to a CSV file or an array of rows.
 * @param keyColumn `string` - the column name whose contents will be keys in the dictionary.
 * @param valueColumn `string` - the column name whose contents will be used as values in the dictionary.
 * @returns **`dict`** `Record<string, string>`
 */
export async function getOneToOneDictionary(
    arg1: string | Record<string, any>[],
    keyColumn: string,
    valueColumn: string,
): Promise<Record<string, string>> {
    validate.stringArgument(`reading.getOneToOneDictionary`, `keyColumn`, keyColumn);
    validate.stringArgument(`reading.getOneToOneDictionary`, `valueColumn`, valueColumn);
    let rows: Record<string, any>[] = await handleFilePathOrRowsArgument(
        arg1, getOneToOneDictionary.name, [keyColumn, valueColumn]
    );
    const dict: Record<string, string> = {};
    for (const row of rows) {
        if (!hasKeys(row, [keyColumn, valueColumn])) {
            mlog.error(`[getOneToOneDictionary()] Row missing keys: '${keyColumn}' or '${valueColumn}'`, 
            );
            throw new Error(`[getOneToOneDictionary()] Row missing keys: '${keyColumn}' or '${valueColumn}'`);
        }
        const key = String(row[keyColumn]).trim();
        const value = String(row[valueColumn]).trim();
        if (!key || !value) {
            mlog.warn(`[getOneToOneDictionary()] Row missing key or value.`, 
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

/**
 * @TODO add CleanStringOptions param to apply to column values
 * @param arg1 `string | Record<string, any>[]` - the `filePath` to a CSV file or an array of rows.
 * @param columnName `string` - the column name whose values will be returned.
 * @param allowDuplicates `boolean` - `optional` if `true`, allows duplicate values in the returned array, otherwise only unique values are returned.
 * - Defaults to `false`.
 * @returns **`values`** `Promise<Array<string>>` - sorted array of values (as strings) from the specified column.
 */
export async function getColumnValues(
    arg1: string | Record<string, any>[],
    columnName: string,
    allowDuplicates: boolean = false
): Promise<Array<string>> {
    validate.stringArgument(`reading.getColumnValues`, `columnName`, columnName);
    validate.booleanArgument(`reading.getColumnValues`, `allowDuplicates`, allowDuplicates);
    let rows: Record<string, any>[] = await handleFilePathOrRowsArgument(
        arg1, getColumnValues.name, [columnName]
    );
    const values: Array<string> = [];
    for (const row of rows) {
        if (!isNonEmptyString(String(row[columnName]))) continue;
        const value = String(row[columnName]).trim();
        if (allowDuplicates || !values.includes(value)) {
            values.push(value);
        }
    }
    return values.sort();
}
export async function getIndexedColumnValues(
    arg1: string | Record<string, any>[],
    columnName: string,
): Promise<Record<string, number[]>> {
    validate.stringArgument(`reading.getIndexedColumnValues`, `columnName`, columnName);
    let rows: Record<string, any>[] = await handleFilePathOrRowsArgument(
        arg1, getIndexedColumnValues.name, [columnName]
    );
    const valueDict: Record<string, number[]> = {}
    for (const rowIndex in rows) {
        const row = rows[rowIndex];
        if (!isNonEmptyString(String(row[columnName]))) continue;
        const value = String(row[columnName]).trim();
        if (!valueDict[value]) {
            valueDict[value] = [];
        }
        valueDict[value].push(Number(rowIndex));
    }
    return valueDict;
}

/**
 * - {@link getRows}`(filePath: string)`
 * @param arg1 `string | Record<string, any>[]`
 * @param invocationSource `string`
 * @param requiredHeaders `string[]`
 * @returns **`rows`** `Promise<Record<string, any>[]>`
 */
export async function handleFilePathOrRowsArgument(
    arg1: string | Record<string, any>[],
    invocationSource: string,
    requiredHeaders: string[] = []
): Promise<Record<string, any>[]> {
    let rows: Record<string, any>[] = [];
    if (isNonEmptyString(arg1) && !isValidCsv(arg1, requiredHeaders)) {
        throw new Error([
            `[reading.handleFilePathOrRowsArgument()] Invalid CSV filePath provided: '${arg1}'`,
            `        Source:   ${invocationSource}`,
            `requiredHeaders ? ${isNonEmptyArray(requiredHeaders) 
                ? JSON.stringify(requiredHeaders) 
                : 'none'
            }`
            ].join(TAB)
        );
    } 
    
    if (isNonEmptyString(arg1)) {
        rows = await getRows(arg1);
    } else if (isNonEmptyArray(arg1)) {
        if (arg1.some(v => typeof v !== 'object')) {
            throw new Error([
                `[reading.handleFilePathOrRowsArgument()] Error: Invalid 'arg1' (Record<string, any>[]) param:`,
                `There exists an element in the param array that is not an object.`,
                `Source: ${invocationSource}`,
            ].join(TAB))
        }
        rows = arg1 as Record<string, any>[];
    } else {
        throw new Error([
            `[reading.handleFilePathOrRowsArgument()] Invalid parameter: 'arg1' (string | Record<string, any>[])`,
            `arg1 must be a string or an array of rows.`,
            `Source: ${invocationSource}`,
        ].join(TAB));
    }
    return rows;
}


/**
 * @param dir `string` path to target directory
 * @param targetExtensions `string[] optional` - array of file extensions to filter files by.
 * - If not provided, all files in the directory will be returned.
 * - If provided, only files with extensions matching the array will be returned.
 * @returns **`targetFiles`** `string[]` array of full file paths
 */
export function getDirectoryFiles(
    dir: string,
    ...targetExtensions: string[]
): string[] {
    validate.existingPathArgument(`reading.getDirectoryFiles`, {dir});
    validate.arrayArgument(`reading.getDirectoryFiles`, 
        {targetExtensions}, 'string', isNonEmptyString, true
    );
    // ensure all target extensions start with period
    for (let i = 0; i < targetExtensions.length; i++) {
        const ext = targetExtensions[i];
        if (!ext.startsWith('.')) { 
            targetExtensions[i] = `.${ext}`;
        }
    }
    const targetFiles: string[] = fs.readdirSync(dir).filter(
        f => isNonEmptyArray(targetExtensions) 
            ? true // get all files in dir, regardless of extension
            : stringEndsWithAnyOf(f, targetExtensions, RegExpFlagsEnum.IGNORE_CASE)
        
    ).map(file => path.join(dir, file));
    return targetFiles;
}