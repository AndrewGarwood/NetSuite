/**
 * @file src/utils/io/writing.ts
 */
import * as fs from "fs";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config/setupLog";
import { coerceFileExtension, getDelimiterFromFilePath } from "./reading";
import { DelimiterCharacterEnum, isWriteJsonOptions, WriteJsonOptions } from "./types";
import { hasKeys, isEmptyArray, isNonEmptyString, TypeOfEnum, } from "../typeValidation";
import * as validate from "../argumentValidation";
import { existsSync, writeFileSync } from "fs";

/**
 * Output JSON data to a file with `fs.writeFileSync` or `fs.appendFileSync`.
 * @param options {@link WriteJsonOptions}
 * @param options.data `Record<string, any> | string` - JSON data to write to file.
 * - If `data` is a string, it will be parsed to JSON. If `data` is an object, it will be converted to JSON.
 * @param options.filePath `string` - the complete path or the path to the directory where the file will be saved. If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
 * @param options.indent `number` - `optional`, default=`4`
 * @param options.enableOverwrite `boolean` - `optional`, default=`true` If `enableOverwrite` is `true`, the file will be overwritten. If `false`, the `data` will be appended to the file.
 * @returns {void}
 */
export function writeObjectToJson(options: WriteJsonOptions): void

/**
 * Output JSON data to a file with `fs.writeFileSync` or `fs.appendFileSync`.
 * @param data `Record<string, any> | string` - JSON data to write to file
 * - If `data` is a string, it will be parsed to JSON. If `data` is an object, it will be converted to JSON.
 * @param filePath `string` - the complete path or the path to the directory where the file will be saved. If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
 * @param indent `number` - `optional`, default=`4`
 * @param enableOverwrite `boolean` - `optional`, default=`true` If `enableOverwrite` is `true`, the file will be overwritten. If `false`, the `data` will be appended to the file.
 * @returns {void}
 */
export function writeObjectToJson(
    data: Record<string, any> | string, 
    filePath: string,
    indent?: number,
    enableOverwrite?: boolean
): void

export function writeObjectToJson(
    /** {@link WriteJsonOptions} `| Record<string, any> | string`, */
    arg1: WriteJsonOptions | Record<string, any> | string, 
    filePath?: string,
    indent: number=4,
    enableOverwrite: boolean=true
): void {
    if (!arg1) {
        mlog.error('[writing.writeObjectToJson()] No data to write to JSON file');
        return;
    }
    let data: Record<string, any> | string;
    let outputFilePath: string;
    let outputIndent: number = indent;
    let outputEnableOverwrite: boolean = enableOverwrite;
    // Handle options object overload
    if (isWriteJsonOptions(arg1)) {
        data = arg1.data;
        outputFilePath = arg1.filePath;
        outputIndent = arg1.indent ?? indent;
        outputEnableOverwrite = arg1.enableOverwrite ?? enableOverwrite;
    } else {
        if (!isNonEmptyString(filePath)) {
            mlog.error('[writing.writeObjectToJson()] filePath is required when not using WriteJsonOptions object');
            return;
        }
        data = arg1;
        outputFilePath = filePath;
    }
    
    // Convert data to object if it's a string (should be valid JSON)
    let objectData: Record<string, any>;
    if (typeof data === 'string') {
        try {
            objectData = JSON.parse(data) as Record<string, any>;
        } catch (error) {
            mlog.error(
                '[writing.writeObjectToJson()] Error parsing string to JSON',
                error
            );
            return;
        }
    } else { // is already an object
        objectData = data;
    }
    
    const outputPath = coerceFileExtension(outputFilePath, 'json');
    try {
        const jsonData = JSON.stringify(objectData, null, outputIndent);
        if (outputEnableOverwrite) {
            fs.writeFileSync(outputPath, jsonData, { flag: 'w' });
        } else {
            fs.appendFileSync(outputPath, jsonData, { flag: 'a' });
        }
        // mlog.info(`[writing.writeObjectToJson()] file saved to '${outputPath}'`)
    } catch (error) {
        mlog.error('[writing.writeObjectToJson()] Error writing to JSON file',
            error
        );
        throw error;
    }
}

/**
 * @param data `Record<string, any> | string` - JSON data to stringify
 * @param indent `number` `optional`, default=`0` - number of additional indents to add to each line
 * @param spaces `number` `optional`, default=`4`
 * @returns **`jsonString`** `string`
 */
export function indentedStringify(
    data: Record<string, any> | string,
    indent: number=0,
    spaces: number=4
): string {
    if (!data) {
        return '';
    }
    let jsonString = typeof data === 'string' 
        ? data : JSON.stringify(data, null, spaces);
    jsonString = jsonString
        .split('\n')
        .map(line => TAB + '\t'.repeat(indent) + line)
        .join('')
        .replace(/^\n\t. /, '').replace(/•/g, '');
    return jsonString;
}

/**
 * @returns **`timestamp`** `string` = `(${MM}-${DD})-(${HH}-${mm}.${ss}.${ms})`
 */
export function getFileNameTimestamp(): string {
    const now = new Date();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `(${MM}-${DD})-(${HH}-${mm}.${ss}.${ms})`
}

/**
 * @param listData `Record<string, Array<string>>` map col names to col values
 * @param outputPath `string`
 * @param delimiter `string` - optional, default=`'\t'`
 * @param columnDelimiter `string` - optional, default=`''`
 */
export function writeListsToCsv(
    listData: Record<string, Array<string>>,
    outputPath: string,
    delimiter: string = DelimiterCharacterEnum.TAB,
    columnDelimiter: string = '',
): void {
    const listNames = Object.keys(listData);
    const listValues = Object.values(listData);

    // Get the maximum length of the lists
    const maxLength = Math.max(...listValues.map(list => list.length));
    let csvContent = listNames.join(delimiter) + '\n';

    if (isNonEmptyString(columnDelimiter)) {
        delimiter = delimiter + columnDelimiter + delimiter;
    }
    for (let i = 0; i < maxLength; i++) {
        const row = listValues.map(list => list[i] || '').join(delimiter);
        csvContent += row + '\n';
    }
    
    fs.writeFile(outputPath, csvContent, (err) => {
        if (err) {
            mlog.error('Error writing to CSV file', err);
            return;
        } 
        mlog.info(`CSV file has been saved to ${outputPath}`);
    });
}

/**
 * @TODO consider if should allow other file extensions
 * @description Trims a text file to keep only the last 10MB of data if it exceeds 10MB.
 * @param maxMB - Maximum size in MB to keep in the file, default is `5` -> 5MB.
 * @param filePaths arbitrary number of text file paths to trim
 */
export function trimFile(maxMB: number=5, ...filePaths: string[]): void {
    const MAX_BYTES = maxMB * 1024 * 1024;
    for (const filePath of filePaths) {
        if (!filePath || !fs.existsSync(filePath) 
            || !filePath.toLowerCase().endsWith('.txt')) {
            mlog.error(`File does not exist or is not text: ${filePath}`);
            continue;
        }
        try {
            const stats = fs.statSync(filePath);
            if (stats.size <= MAX_BYTES) return;
            const fd = fs.openSync(filePath, 'r+');
            const buffer = Buffer.alloc(MAX_BYTES);
            fs.readSync(fd, buffer, 0, MAX_BYTES, stats.size - MAX_BYTES);
            fs.ftruncateSync(fd, 0);
            fs.writeSync(fd, buffer, 0, MAX_BYTES, 0);
            fs.closeSync(fd);
            mlog.info(`Trimmed file to last ${maxMB}MB: ${filePath}`);
        } catch (e) {
            mlog.error('Error trimming file to last 10MB', e);
            throw e;
        }
    }
}

/**
 * `sync` Clears the content of the specified log file(s).
 * @param filePaths - The path(s) to the log file(s) to clear.
 */
export function clearFileSync(...filePaths: string[]): void {
    for (const filePath of filePaths) {
        if (!filePath || !existsSync(filePath)) {
            mlog.warn(`clearFileSync() Log file does not exist: ${filePath}`);
            continue;
        }
        try {
            writeFileSync(filePath, '', { encoding: 'utf-8', flag: 'w' });
        } catch (error: any) {
            if (error.code === 'EBUSY' || error.code === 'EMFILE') {
                // File is busy, try again after a short delay
                setTimeout(() => {
                    try {
                        writeFileSync(filePath, '', { encoding: 'utf-8', flag: 'w' });
                    } catch (retryError) {
                        mlog.warn(`clearFileSync() Failed to clear file after retry: ${filePath}`, retryError);
                    }
                }, 50);
            } else {
                mlog.warn(`clearFileSync() Failed to clear file: ${filePath}`, error);
            }
        }
    }
}

/**
 * `async` func to ensure files are cleared before proceeding.
 * @param filePaths - The path(s) to the log file(s) to clear.
 */
export async function clearFile(...filePaths: string[]): Promise<void> {
    const promises = filePaths.map(async (filePath) => {
        if (!filePath || !existsSync(filePath)) {
            mlog.warn(`clearFile() Log file does not exist: ${filePath}`);
            return;
        }
        
        return new Promise<void>((resolve, reject) => {
            const tryWrite = (attempt: number = 1) => {
                try {
                    writeFileSync(filePath, '', { encoding: 'utf-8', flag: 'w' });
                    resolve();
                } catch (error: any) {
                    if ((error.code === 'EBUSY' || error.code === 'EMFILE') && attempt < 3) {
                        setTimeout(() => tryWrite(attempt + 1), 50 * attempt);
                    } else {
                        mlog.warn(`clearFile() Failed to clear file: ${filePath}`, error);
                        resolve(); // Don't reject, just warn and continue
                    }
                }
            };
            tryWrite();
        });
    });
    
    await Promise.all(promises);
}

/**
 * - can write to `tsv` by having `outputPath` end with `'.tsv'`
 * @param rows `Record<string, any>[]` - array of objects to write to CSV 
 * @param outputPath `string` - path to the output CSV file.
 * @returns **`void`**
 */
export function writeRowsToCsv(
    rows: Record<string, any>[],
    outputPath: string,
): void {
    validate.arrayArgument('writeRowsToCsv', {rows}, TypeOfEnum.OBJECT);
    validate.stringArgument('writeRowsToCsv', {outputPath});
    const delimiter = getDelimiterFromFilePath(outputPath);
    const headers = Object.keys(rows[0] || {});
    if (isEmptyArray(headers)) {
        mlog.error(`[writeRowsToCsv()] No headers found in rows, nothing to write.`,
            TAB + `Intended outputPath: '${outputPath}'`,
        );
        return;
    }
    if (rows.some(row => !hasKeys(row, headers))) {
        mlog.error([`[writeRowsToCsv()] Some rows do not have all headers!`,
            `headers: ${JSON.stringify(headers)}`,
            `Intended outputPath: '${outputPath}'`
        ].join(TAB));
        return;
    }
    const csvContent: string = [headers.join(delimiter)].concat(
        rows.map(row => headers.map(header => row[header] || '').join(delimiter))
    ).join('\n');
    try {
        fs.writeFileSync(outputPath, csvContent, { encoding: 'utf-8' });
        mlog.info(`[writeRowsToCsv()] file has been saved to '${outputPath}'`);
    } catch (e) {
        mlog.error('[writeRowsToCsv()] Error writing to CSV file', e);
        throw e;
    }
}
