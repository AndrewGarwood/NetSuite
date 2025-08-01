/**
 * @file src/utils/io/reading.ts
 */
import path from "node:path";
import fs from "fs";
import { Readable } from "stream";
import csv from "csv-parser";
import Excel from "xlsx";
import { RegExpFlagsEnum, StringCaseOptions, stringEndsWithAnyOf, 
    StringPadOptions, StringReplaceOptions, StringStripOptions, clean 
} from "../regex";
import { FileData, ParseOneToManyOptions,} from "./types/Io";
import { STOP_RUNNING } from "src/config/env";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, SUPPRESSED_LOGS as SUP } from "src/config/setupLog";
import { DelimiterCharacterEnum, ValueMapping, DelimitedFileTypeEnum, isValueMappingEntry, isFileData } from "./types";
import { isNonEmptyArray, anyNull, isNullLike as isNull, hasKeys, isNonEmptyString, 
    isEmptyArray } from "../typeValidation";
import * as validate from "../argumentValidation";
import { indentedStringify } from "./writing";

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
                    `requiredHeaders must be of type: Array<string>`,
                    `found array element of type: '${typeof header}' (skipping)`
                ].join(TAB));
                return true; // skip headers if they are not strings
            }
            return headerRow.includes(header)
        });
        if (!hasRequiredHeaders) {
            mlog.warn([`[isValidCsv()]: Required headers missing from headerRow`,
                `filePath: '${filePath}'`,
                `requiredHeaders: ${JSON.stringify(requiredHeaders)}`,
                ` csvFileHeaders: ${JSON.stringify(headerRow)}`
            ].join(TAB)); 
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
            mlog.warn([`[isValidCsv()]: Invalid row found: header.length !== rowValues.length`,
                `   header.length: ${headerRow.length},`,
                `rowValues.length: ${rowValues.length}`,
                ` -> Difference =  ${headerRow.length - rowValues.length}`,
                `   header: ${JSON.stringify(headerRow)}`,
                `rowValues: ${JSON.stringify(rowValues)}`,
                ` rowIndex: ${i},`,
                ` filePath: '${filePath}'`].join(TAB),
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
 * @returns **`jsonData`** — `Record<string, any>` 
 * - JSON data as an object
 */
export function readJsonFileAsObject(filePath: string): Record<string, any> {
    filePath = validateFileExtension(filePath, 'json');
    validate.existingPathArgument(`reading.readJsonFileAsObject`, {filePath});
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
    validate.multipleStringArguments(`reading.validateFileExtension`, {filePath, expectedExtension});
    expectedExtension = expectedExtension.replace(/\./, '');
    if (filePath.endsWith(`.${expectedExtension}`)) {
        return filePath
    } 
    return filePath + '.' + expectedExtension;
}

export function isDirectory(pathString: string): boolean {
    return fs.existsSync(pathString) && fs.statSync(pathString).isDirectory();
}

export function isFile(pathString: string): boolean {
    return fs.existsSync(pathString) && fs.statSync(pathString).isFile();
}


/**
 * - {@link getDirectoryFiles}
 * @param arg1 `Array<`{@link FileData}` | string> | string`
 * - `files:` {@link FileData}`[]`
 * - `filePaths:` `string[]`
 * - `dirPath:` `string`
 * @param sheetName `string`
 * @param requiredHeaders `string[]` `if` left `undefined`, 
 * `requiredHeaders` will be set to the headers of first non empty file from `arg1`
 * @param strictRequirement `boolean` 
 * - `Default` = `true`
 * - `if` `true`, then every `row` **must** have headers/keys exactly equal to `requiredHeaders`
 * - `else` `false`, then if a `row` is missing one or more `header` in `requiredHeaders`, 
 * for each missing `header`, set `row[header] = ''` (empty string), 
 * @param targetExtensions `string[]` try to read rows of all files whose type is in `targetExtensions`
 * @returns **`concatenatedRows`** `Promise<Record<string, any>[]>`
 */
export async function concatenateFiles(
    arg1: Array<FileData | string> | string,
    sheetName: string = 'Sheet1',
    requiredHeaders: string[] = [],
    strictRequirement: boolean = true,
    targetExtensions: string[] = ['.csv', '.tsv', '.xlsx']
): Promise<Record<string, any>[]> {
    const source = `[reading.concatenateDirectoryFiles()]`;
    validate.stringArgument(source, {sheetName});
    validate.arrayArgument(source, {targetExtensions}, 'string', isNonEmptyString);
    let files: Array<FileData | string>;
    if (isNonEmptyArray(arg1)) {
        files = arg1;
    } else if (isDirectory(arg1)) {
        files = getDirectoryFiles(arg1, ...targetExtensions);
    } else if (isFile(arg1) 
        && stringEndsWithAnyOf(arg1, targetExtensions, RegExpFlagsEnum.IGNORE_CASE)) {
        files = [arg1];
    } else {
        let message = [`${source} Invalid parameter: 'arg1'`,
            `Expected: arg1: (Array<FileData | string> | string) to be one of:`,
            `files: FileData[] | filePaths: string[] | filePath: string | dirPath: string`,
            `Received: ${typeof arg1}`
        ].join(TAB);
        mlog.error(message);
        throw new Error(message);
    }
    if (!isNonEmptyArray(files)) { // i.e. isEmptyArray.... shouldn't get here
        mlog.error(`${source} how did this happen, we're smarter than this`)
        return []
    } else if (files.length === 1) {
        return await getRows(files[0], sheetName);
    } // else if files.length > 1, need to make sure each file has same headers
    const concatenatedRows: Record<string, any>[] = [];
    let haveDefinedRequiredHeaders = (isNonEmptyArray(requiredHeaders) 
        && requiredHeaders.every(h => isNonEmptyString(h)) 
            ? true : false
    );
    for (const fileRepresentative of files) {
        const rows = await getRows(fileRepresentative, sheetName);
        if (!isNonEmptyArray(rows)) { continue }
        if (!haveDefinedRequiredHeaders) {
            let firstValidRow = rows.find(row => !isNull(row));
            if (!firstValidRow) { continue }
            requiredHeaders = Object.keys(firstValidRow);
            haveDefinedRequiredHeaders = true;
        }
        if (!isNonEmptyArray(requiredHeaders)) {
            mlog.warn(`${source} No requiredHeaders defined,`,
                `skipping file: '${isFileData(fileRepresentative) 
                    ? fileRepresentative.fileName : fileRepresentative
                }'`
            );
            continue;
        }
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!hasKeys(row, requiredHeaders)) {
                let missingHeaders = requiredHeaders.filter(h => !hasKeys(row, h));
                if (strictRequirement) {
                    let message = [`${source} Invalid row: missing required header(s)`,
                        `(strictRequirement === true)`,
                        `           file: '${isFileData(fileRepresentative) 
                            ? fileRepresentative.fileName : fileRepresentative
                        }'`,
                        `       rowIndex: ${i}`,
                        `requiredHeaders: ${JSON.stringify(requiredHeaders)}`,
                        ` missingHeaders: ${JSON.stringify(missingHeaders)}`
                    ].join(TAB);
                    mlog.error(message);
                    throw new Error(message);
                }
                for (const header of missingHeaders) {
                    row[header] = '';
                }
            }
            concatenatedRows.push(row);
        }
    }
    return concatenatedRows;
}


/**
 * @param arg1 {@link FileData}` | string` one of the following:
 * - `fileData:` {@link FileData} = `{ fileName: string; fileContent: string; }` 
 * - `filePath:` `string`
 * @param sheetName `string` `optional`
 * - defined/used `if` `arg1` pertains to an excel file and you want to specify which sheet to read
 * - `Default` = `'Sheet1'`
 * @returns **`rows`** `Promise<Record<string, any>[]>`
 */
export async function getRows(
    arg1: FileData | string,
    sheetName: string = 'Sheet1'
): Promise<Record<string, any>[]> {
    if (isFileData(arg1)) {
        const { fileName } = arg1 as FileData;
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            return getExcelRows(arg1, sheetName);
        }
        return getCsvRows(arg1);
    } else if (isNonEmptyString(arg1)) { // assume it's a file path
        if (arg1.endsWith('.xlsx') || arg1.endsWith('.xls')) {
            return getExcelRows(arg1, sheetName);
        }
        return getCsvRows(arg1);
    } else {
        throw new Error(
            `[reading.getRows()] Invalid argument: 'arg1' must be a FileData object or a string file path.`
        );
    }
}

export async function getExcelRows(
    arg1: FileData | string,
    sheetName: string = 'Sheet1'
): Promise<Record<string, any>[]> {
    const source = 'reading.getExcelRows';
    validate.stringArgument(source, {sheetName});
    let filePath: string;
    let fileContent: string | undefined;
    let buffer: Buffer | undefined;
    if (isFileData(arg1) && isNonEmptyString(arg1.fileName) 
        && stringEndsWithAnyOf(arg1.fileName, ['.xlsx', '.xls'])) {
        filePath = arg1.fileName;
        fileContent = arg1.fileContent;
        buffer = Buffer.from(fileContent, 'base64');
    } else if (isNonEmptyString(arg1) && stringEndsWithAnyOf(arg1, ['.xlsx', '.xls'])) {
        filePath = arg1;
        validate.existingPathArgument(`${source}.filePath`, {filePath});
        buffer = fs.readFileSync(filePath);
    } else {
        throw new Error([
            `[reading.getExcelRows()] Invalid argument: 'arg1' (FileData or filePath)`,
            `must be a FileData object or a string file path.`,
            `Received: ${JSON.stringify(arg1)}`
        ].join(TAB));
    }
    try {
        const workbook = Excel.read(buffer, { type: 'buffer' });
        sheetName = (workbook.SheetNames.includes(sheetName) 
            ? sheetName 
            : workbook.SheetNames[0]
        );
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, any>[] = Excel.utils.sheet_to_json(sheet);
        return jsonData;
    } catch (error) {
        mlog.error([
            `[reading.getExcelRows()] Error reading or parsing the Excel file.`,
            `Received arg1 = ${JSON.stringify(arg1)}, sheetName: '${sheetName}'`,
        ].join(TAB), JSON.stringify(error, null, 4));
        return [];
    }
    
}

/**
 * @param filePath `string`
 * @returns **`rows`** `Promise<Record<string, any>[]>` 
 * - an array of objects representing rows from a CSV file.
 */
export async function getCsvRows(
    arg1: FileData | string
): Promise<Record<string, any>[]> {
    const source = 'reading.getCsvRows';
    let filePath: string;
    let fileContent: string | undefined;
    let delimiter: DelimiterCharacterEnum | string = DelimiterCharacterEnum.COMMA;
    let buffer: Buffer | undefined;
    if (isFileData(arg1) && isNonEmptyString(arg1.fileName)
        && stringEndsWithAnyOf(arg1.fileName, ['.csv', '.tsv'])) {
        filePath = arg1.fileName;
        fileContent = arg1.fileContent;
        buffer = Buffer.from(fileContent, 'base64');
        delimiter = getDelimiterFromFilePath(filePath);
    } else if (isNonEmptyString(arg1) && stringEndsWithAnyOf(arg1, ['.csv', '.tsv'])) {
        filePath = arg1;
        validate.existingPathArgument(`${source}.filePath`, {filePath});
        try {
            buffer = fs.readFileSync(filePath);
        } catch (error) {
            throw new Error([
                `[${source}()] Error making buffer when reading file: '${filePath}'`,
                `Error: ${error instanceof Error ? error.message : String(error)}`
            ].join(TAB));
        }
        delimiter = getDelimiterFromFilePath(filePath);
    } else {
        throw new Error([
            `[reading.getCsvRows()] Invalid argument: 'arg1' (FileData or filePath)`,
            `must be a FileData object or a string file path.`,
            `Received: ${JSON.stringify(arg1)}`
        ].join(TAB));
    }
    const rows: Record<string, any>[] = [];
    if (!buffer) {
        throw new Error(`[${source}()] No buffer available to read`);
    }
    const stream = Readable.from(buffer.toString('utf8'));
    return new Promise((resolve, reject) => {
        stream
            .pipe(csv({ separator: delimiter }))
            .on('data', (row: Record<string, any>) => rows.push(row))
            .on('end', () => {
                SUP.push([`[${source}()] Successfully read CSV file.`,
                    `filePath: '${filePath}'`,
                    `Number of rows read: ${rows.length}`
                ].join(TAB));
                resolve(rows)
            })
            .on('error', (error) => {
                mlog.error(`[${source}()] Error reading CSV file:`, 
                    TAB+`filePath: '${filePath}'`, 
                    NL+`Error: ${JSON.stringify(error, null, 4)}`
                );
                reject(error);
            });
    })
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
    validate.multipleStringArguments(`reading.getOneToOneDictionary`, {keyColumn, valueColumn});
    let rows: Record<string, any>[] = await handleFileArgument(
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
    arg1: string | FileData | Record<string, any>[],
    columnName: string,
    allowDuplicates: boolean = false
): Promise<Array<string>> {
    validate.stringArgument(`reading.getColumnValues`, {columnName});
    validate.booleanArgument(`reading.getColumnValues`, {allowDuplicates});
    let rows: Record<string, any>[] = await handleFileArgument(
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

/**
 * @param arg1 `string | Record<string, any>[]` - the `filePath` to a CSV file or an array of rows.
 * @param columnName `string` - the column name whose values will be returned.
 * @returns **`indexedColumnValues`** `Promise<Record<string, number[]>>`
 */
export async function getIndexedColumnValues(
    arg1: string | FileData | Record<string, any>[],
    columnName: string,
): Promise<Record<string, number[]>> {
    validate.stringArgument(`reading.getIndexedColumnValues`, `columnName`, columnName);
    let rows: Record<string, any>[] = await handleFileArgument(
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
 * formerly `handleFilePathOrRowsArgument`
 * - {@link getRows}`(filePath: string)`
 * @param arg1 `string | FileData | Record<string, any>[]`
 * @param invocationSource `string`
 * @param requiredHeaders `string[]` `optional`
 * @returns **`rows`** `Promise<Record<string, any>[]>`
 */
export async function handleFileArgument(
    arg1: string | FileData | Record<string, any>[],
    invocationSource: string,
    requiredHeaders: string[] = []
): Promise<Record<string, any>[]> {
    const source = `reading.handleFileArgument`;
    validate.stringArgument(source, {invocationSource});
    validate.arrayArgument(source, {requiredHeaders}, 'string', isNonEmptyString, true);
    let rows: Record<string, any>[] = [];
    // Handle file path validation only for string inputs
    if (isNonEmptyString(arg1) && !isValidCsv(arg1, requiredHeaders)) {
        throw new Error([
            `[${source}()] Invalid CSV filePath provided: '${arg1}'`,
            `        Source:   ${invocationSource}`,
            `requiredHeaders ? ${isNonEmptyArray(requiredHeaders) 
                ? JSON.stringify(requiredHeaders) 
                : 'none'}`
        ].join(TAB));
    } 
    if (isNonEmptyString(arg1)) { // arg1 is file path string
        rows = await getRows(arg1);
    } else if (isFileData(arg1)) { // arg1 is FileData { fileName: string; fileContent: string; }
        rows = await getRows(arg1);
    } else if (isNonEmptyArray(arg1)) { // arg1 is already array of rows
        if (arg1.some(v => typeof v !== 'object')) {
            throw new Error([
                `[${source}()] Error: Invalid 'arg1' (Record<string, any>[]) param:`,
                `There exists an element in the param array that is not an object.`,
                `Source: ${invocationSource}`,
            ].join(TAB))
        }
        rows = arg1 as Record<string, any>[];
    } else {
        throw new Error([
            `[${source}()] Invalid parameter: 'arg1' (string | FileData | Record<string, any>[])`,
            `arg1 must be a file path string, FileData object, or an array of rows.`,
            `Source: ${invocationSource}`,
        ].join(TAB));
    }
    return rows;
}


/**
 * @param dir `string` path to target directory
 * @param targetExtensions `string[] optional` - array of file extensions to filter files by.
 * - `If` not provided, all files in the directory will be returned.
 * - `If` provided, only files with extensions matching the array will be returned.
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
    validate.multipleStringArguments(`reading.parseExcelForOneToMany`, {filePath, sheetName, keyColumn, valueColumn});
    try {
        const { 
            keyStripOptions, valueStripOptions, 
            keyCaseOptions, valueCaseOptions, 
            keyPadOptions, valuePadOptions 
        } = options;
        const workbook = Excel.readFile(filePath);
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, any>[] = Excel.utils.sheet_to_json(sheet);
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
    if (!originalValue || isNull(valueOverrides)) {
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