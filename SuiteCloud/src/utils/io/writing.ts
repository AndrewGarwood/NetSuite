/**
 * @file src/utils/io/writing.ts
 */
import fs from 'fs';
import { mainLogger as mlog, INDENT_LOG_LINE as NEW_LINE_TAB } from 'src/config/setupLog';
import { OUTPUT_DIR } from '../../config/env';
import { getCurrentPacificTime } from './dateTime';
import { validateFileExtension } from './reading';
import { DelimitedFileTypeEnum, DelimiterCharacterEnum } from './types/Csv';
import { hasKeys } from '../typeValidation';
import path from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';



export type WriteJsonOptions = {
    data: Record<string, any> | string;
    filePath: string;
    fileName?: string;
    indent?: number;
    enableOverwrite?: boolean;
}

/**
 * Output JSON data to a file with `fs.writeFileSync` or `fs.appendFileSync`.
 * @param options {@link WriteJsonOptions}
 * @param options.data `Record<string, any> | string` - JSON data to write to file.
 * - If `data` is a string, it will be parsed to JSON. If `data` is an object, it will be converted to JSON.
 * @param options.filePath `string` - the complete path or the path to the directory where the file will be saved. If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
 * @param options.fileName `string` - `optional`, 'name.ext', default=`''` If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
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
 * @param fileName `string` - `optional`, 'name.ext', default=`''` If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
 * @param indent `number` - `optional`, default=`4`
 * @param enableOverwrite `boolean` - `optional`, default=`true` If `enableOverwrite` is `true`, the file will be overwritten. If `false`, the `data` will be appended to the file.
 * @returns {void}
 */
export function writeObjectToJson(
    data: Record<string, any> | string, 
    filePath: string,
    fileName?: string,
    indent?: number,
    enableOverwrite?: boolean
): void

export function writeObjectToJson(
    /** {@link WriteJsonOptions} `| Record<string, any> | string`, */
    arg1: WriteJsonOptions | Record<string, any> | string, 
    filePath?: string,
    fileName: string='',
    indent: number=4,
    enableOverwrite: boolean=true
): void {
    if (!arg1) {
        mlog.error('No data to write to JSON file');
        return;
    }
    let data: Record<string, any> | string | undefined = arg1;
    if (typeof arg1 === 'string') {
        try {
            data = JSON.parse(arg1) as Record<string, any>;
        } catch (e) {
            mlog.error('Error parsing string to JSON', e);
            return;
        }
    }
    if (typeof arg1 === 'object' && hasKeys<Record<string, any>>(arg1 as WriteJsonOptions, ['data', 'filePath'])) {
        data = typeof arg1.data === 'string' ? JSON.parse(arg1.data) : arg1.data;
        filePath = arg1.filePath;
        fileName = arg1?.fileName || fileName;
        indent = arg1?.indent || indent;
        enableOverwrite = arg1?.enableOverwrite || enableOverwrite;
    } else if (typeof arg1 === 'object'&& filePath) {
        data = arg1 as Record<string, any>;
    }

    const validationResults = validateFileExtension(
        (fileName ? path.join(filePath || '', fileName): filePath || ''), 'json'
    );
    if (!validationResults.isValid) {
        mlog.error('Invalid file path or name', validationResults);
        return;
    }
    const outputPath = validationResults.validatedFilePath;
    try {
        const jsonData = JSON.stringify(data, null, indent);
        if (enableOverwrite) {
            fs.writeFileSync(outputPath, jsonData, { flag: 'w' });
        } else {
            fs.appendFileSync(outputPath, jsonData, { flag: 'a' });
        };
    } catch (e) {
        mlog.error('Error writing to JSON file', e);
        throw e;
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
        .map(line => NEW_LINE_TAB + '\t'.repeat(indent) + line)
        .join('')
        .replace(/^\n\t. /, '').replace(/•/g, '');
    return jsonString;
}

/**
 * @deprecated
 * Output JSON data to the console
 * @param data `Record<string, any>`
 * @param spaces `number` - `optional`, default=`4` 
 */
export function printJson(data:Record<string, any>, spaces: number=4) {
    try {
        console.log(JSON.stringify(data, null, spaces));
    } catch (e) {
        mlog.error(e);
    }
}

/**
 * @deprecated
 * @typedefn **`ConsoleGroup`**
 * @property {string} label `string` - label for the console group
 * @property {Array<string> | string} details `string[]` - log each string in arr on new line
 * @property {boolean} collapse `boolean` - `optional`, default=`false`
 * @property {number} numTabs `number` - `optional`, default=`1`
 * @property {boolean} printToConsole `boolean` - `optional`, default=`true`
 * @property {boolean} printToFile `boolean` - `optional`, default=`true`
 * @property {string} filePath `string` - `optional`, default=`${OUTPUT_DIR}/DEFAULT_LOG.txt`
 * @property {boolean} enableOverwrite `boolean` - `optional`, default=`false`
 * @description Print a console group with the given label and log statements. Optionally print to file.
 */
export type ConsoleGroup = {
    label: string,
    details?: Array<string> | string,
    collapse?: boolean,
    numTabs?: number,
    printToConsole?: boolean,
    printToFile?: boolean,
    filePath?: string,
    enableOverwrite?: boolean
}


/**
 * @deprecated
 * @param consoleGroup {@link ConsoleGroup}
 * @param consoleGroup.label `string`
 * @param consoleGroup.details `string[]` - log each string in arr on new line
 * @param consoleGroup.collapse `boolean` - `optional`, default=`false`
 * @param consoleGroup.numTabs `number` - `optional`, default=`1`
 * @param consoleGroup.printToConsole `boolean` - `optional`, default=`true`
 * @param consoleGroup.printToFile `boolean` - `optional`, default=`true`
 * @param consoleGroup.filePath `string` - `${OUTPUT_DIR}/logs/DEFAULT_LOG.txt`
 * @param consoleGroup.enableOverwrite `boolean` - `optional`, default=`false`
 * @returns {void}
 * @description Print a console group with the given label and log statements. Optionally print to file.
 */
export function printConsoleGroup({
    label = 'Group Name', 
    details = [],
    collapse = false,
    numTabs = 0,
    printToConsole = true,
    printToFile = true,
    filePath = `${OUTPUT_DIR}/logs/DEFAULT_LOG.txt`,
    enableOverwrite = false
}: ConsoleGroup): void {
    let labelOffset = '\t'.repeat(numTabs);
    let bodyOffset = '\t'.repeat(numTabs + 1);
    label = labelOffset + `[${getCurrentPacificTime()}] ` + label
    details = typeof details === 'string' ? [details] : details;
    if (printToConsole) {
        if (collapse) {
            console.groupCollapsed(label);
        } else {
            console.group(label);
        }
        details.forEach(statement => console.log(statement));
        console.groupEnd();
    }
    if (printToFile) {
        filePath = validateFileExtension(filePath, 'txt').validatedFilePath;
        if (enableOverwrite) {
            fs.writeFile(
                filePath, 
                '\n' + labelOffset + label + '\n' + bodyOffset + details.join('\n' + bodyOffset), 
                (err) => {
                    if (err) {
                        mlog.error('Error writing to file', err);
                    }
                }
            );
        } else {
            fs.appendFile(
                filePath, 
                '\n' + labelOffset + label + '\n' + bodyOffset + details.join('\n' + bodyOffset), 
                (err) => {
                    if (err) {
                        mlog.error('Error appending to file', err);
                    }
                }
            );
        }
    }
}


/**
 * @param listData `Record<string, Array<string>>` map col names to col values
 * @param fileName string
 * @param filePath string
 * @param delimiter string - optional, default=`','`
 * @param delimiterColumn string - optional, default=`''`
 */
export function writeListsToCsv(
    listData: Record<string, Array<string>>,
    fileName: string,
    filePath: string,
    delimiter: string =DelimiterCharacterEnum.COMMA,
    delimiterColumn: string='',  
) {
    let fileExtension = '';
    if (delimiter === DelimiterCharacterEnum.COMMA) {
        fileExtension = DelimitedFileTypeEnum.CSV;
    } else if (delimiter === DelimiterCharacterEnum.TAB) {
        fileExtension = DelimitedFileTypeEnum.TSV;
    }
    const outputAddress = `${filePath}/${fileName}.${fileExtension}`;
    const listNames = Object.keys(listData);
    const listValues = Object.values(listData);

    // Get the maximum length of the lists
    const maxLength = Math.max(...listValues.map(list => list.length));
    let csvContent = listNames.join(delimiter) + '\n'; // Header row
    
    if (delimiterColumn && delimiterColumn.length > 0) {
        delimiter = delimiter + delimiterColumn + delimiter;
    }
    for (let i = 0; i < maxLength; i++) {
        const row = listValues.map(list => list[i] || '').join(delimiter);
        csvContent += row + '\n';
    }
    
    fs.writeFile(outputAddress, csvContent, (err) => {
        if (err) {
            mlog.error('Error writing to CSV file', err);
            return;
        } 
        mlog.info(`CSV file has been saved to ${outputAddress}`);
    });
}

/**
 * @TODO consider if should allow other file extensions
 * @description Trims a text file to keep only the last 10MB of data if it exceeds 10MB.
 * @param max - Maximum size in MB to keep in the file, default is `5` -> 5MB.
 * @param filePaths arbitrary number of text file paths to trim
 */
export function trimFile(max: number=5, ...filePaths: string[]): void {
    const MAX_BYTES = max * 1024 * 1024;
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
            mlog.info(`Trimmed file to last ${max}MB: ${filePath}`);
        } catch (e) {
            mlog.error('Error trimming file to last 10MB', e);
            throw e;
        }
    }
}

/**
 * Clears the content of the specified log file(s).
 * @param filePaths - The path(s) to the log file(s) to clear.
 */
export function clearFile(...filePaths: string[]): void {
    for (const filePath of filePaths) {
        if (!filePath || !existsSync(filePath)) {
            mlog.warn(`clearFile() Log file does not exist: ${filePath}`);
            continue;
        }
        writeFileSync(filePath, '', { encoding: 'utf-8' });
    }
}