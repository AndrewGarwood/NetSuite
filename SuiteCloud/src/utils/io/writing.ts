/**
 * @file src/utils/io/writing.ts
 */
import fs from 'fs';
import { mainLogger as log } from 'src/config/setupLog';
import { OUTPUT_DIR } from '../../config/env';
import { getCurrentPacificTime } from './dateTime';
import { validateFileExtension } from './reading';
import { DelimitedFileTypeEnum, DelimiterCharacterEnum } from './types/Csv';



/**
 * Output JSON data to a file with `fs.writeFileSync` or `fs.appendFileSync`.
 * @param {Record<string, any> | string} data `Record<string, any> | string` - JSON data to write to file
 * @param {string} fileName `string` - optional, 'name.ext', default=`''` If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
 * @param {string} filePath `string` - the complete path or the path to the directory where the file will be saved. If `fileName` is not provided, it will be assumed the `filePath` contains the name and extension.
 * @param {number} indent `number` - `optional`, default=`4`
 * @param {boolean} enableOverwrite `boolean` - `optional`, default=`true` If `enableOverwrite` is true, the file will be overwritten. If false, the data will be appended to the file.
 * @description Write JSON data to a file.
 * @returns {void}
 */
export function writeObjectToJson(
    data: Record<string, any> | string, 
    fileName: string='',
    filePath: string,
    indent: number=4,
    enableOverwrite: boolean=true
): void {
    if (!data) {
        log.error('No data to write to JSON file');
        return;
    }
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data) as Record<string, any>;
        } catch (e) {
            log.error('Error parsing string to JSON', e);
            return;
        }
    }
    if (typeof data !== 'object') {
        log.error('Data is not an object or string', data);
        return;
    }
    filePath = validateFileExtension(
        (fileName ? `${filePath}/${fileName}`: filePath), 
        'json'
    ).validatedFilePath;
    try {
        const jsonData = JSON.stringify(data, null, indent);
        if (enableOverwrite) {
            fs.writeFileSync(filePath, jsonData, { flag: 'w' });
        } else {
            fs.appendFileSync(filePath, jsonData, { flag: 'a' });
        };
        // console.log(`JSON file has been saved to ${filePath}`);
    } catch (e) {
        log.error('Error writing to JSON file', e);
    }

}

/**
 * Output JSON data to the console
 * @param {Record<string, any>} data Object.<string, any>
 * @param {number} indent number - optional, default=4 
 */
export function printJson(data:Record<string, any>, indent: number=4) {
    try {
        console.log(JSON.stringify(data, null, indent));
    } catch (e) {
        log.error(e);
    }
}

/**
 * @typedefn `{Object}` `ConsoleGroup`
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
 * 
 * @param {ConsoleGroup} consoleGroup {@link ConsoleGroup}
 * @param {string} consoleGroup.label `string`
 * @param {Array<string> | string} consoleGroup.details `string[]` - log each string in arr on new line
 * @param {boolean} consoleGroup.collapse `boolean` - `optional`, default=`false`
 * @param {number} consoleGroup.numTabs `number` - `optional`, default=`1`
 * @param {boolean} consoleGroup.printToConsole `boolean` - `optional`, default=`true`
 * @param {boolean} consoleGroup.printToFile `boolean` - `optional`, default=`true`
 * @param {string} consoleGroup.filePath `string` - `${OUTPUT_DIR}/logs/DEFAULT_LOG.txt`
 * @param {boolean} consoleGroup.enableOverwrite `boolean` - `optional`, default=`false`
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
                        log.error('Error writing to file', err);
                    }
                }
            );
        } else {
            fs.appendFile(
                filePath, 
                '\n' + labelOffset + label + '\n' + bodyOffset + details.join('\n' + bodyOffset), 
                (err) => {
                    if (err) {
                        log.error('Error appending to file', err);
                    }
                }
            );
        }
    }
}


/**
 * @param {Record<string, Array<string>>} listData `Record<string, Array<string>>` map col names to col values
 * @param {string} fileName string
 * @param {string} filePath string
 * @param {string} delimiter string - optional, default=`','`
 * @param {string} delimiterColumn string - optional, default=`''`
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
            log.error('Error writing to CSV file', err);
            return;
        } 
        console.log(`CSV file has been saved to ${outputAddress}`);
    });
}
