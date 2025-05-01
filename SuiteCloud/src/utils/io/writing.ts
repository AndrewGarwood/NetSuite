/**
 * @file src/utils/io/writing.ts
 */
import fs from 'fs';
import { OUTPUT_DIR } from 'src/config/env';
import { getCurrentPacificTime } from './dateTime';
import { validateFileExtension } from './reading';
import { DelimitedFileTypeEnum } from 'src/utils/io/types/CsvMapping';



/**
 * @param {Record.<string, Array<string>>} listData Object.<string, Array\<string>> map col names to col values
 * @param {string} fileName string
 * @param {string} filePath string
 * @param {string} delimiter string - optional, default=','
 * @param {string} delimiterColumn string - optional, default=''
 */
export function writeListsToCsv(
    listData: Record<string, Array<string>>,
    fileName: string,
    filePath: string,
    delimiter: string =',',
    delimiterColumn: string='',  
) {
    let fileExtension = '';
    if (delimiter === ',') {
        fileExtension = DelimitedFileTypeEnum.CSV;
    } else if (delimiter === '\t') {
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
            console.error('Error writing to CSV file', err);
        } else {
            console.log(`CSV file has been saved to ${outputAddress}`);
        }
    });
}


/**
 * Output JSON data to a file with `fs.writeFileSync` or `fs.appendFileSync`.
 * @param {Record<string, any> | string} data Record.<string, any> | string - JSON data to write to file
 * @param {string} fileName string - optional, 'name.ext', default='' If fileName is not provided, it will be assumed the filePath contains the name and extension.
 * @param {string} filePath string 
 * @param {number} indent number - optional, default=4
 * @param {boolean} enableOverwrite boolean - optional, default=true If enableOverwrite is true, the file will be overwritten. If false, the data will be appended to the file.
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
        console.error('No data to write to JSON file');
        return;
    }
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data) as Record<string, any>;
        } catch (e) {
            console.error('Error parsing string to JSON', e);
            return;
        }
    }
    if (typeof data !== 'object') {
        console.error('Data is not an object or string', data);
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
        console.log(`JSON file has been saved to ${filePath}`);
    } catch (e) {
        console.error('Error writing to JSON file', e);
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
        console.error(e);
    }
}

/**
 * @typedefn {Object} ConsoleGroup
 * @property {string} label `string` - label for the console group
 * @property {Array<string>} details `string[]` - log each string in arr on new line
 * @property {boolean} collapse `boolean` - `optional`, default=`false`
 * @property {number} numTabs `number` - `optional`, default=`1`
 * @property {boolean} printToConsole `boolean` - `optional`, default=`true`
 * @property {boolean} printToFile `boolean` - `optional`, default=`true`
 * @property {string} filePath `string` - `optional`, default=`${OUTPUT_DIR}/DEFAULT_LOG.txt`
 * @property {boolean} enableOverwrite `boolean` - `optional`, default=`true`
 * @description Print a console group with the given label and log statements. Optionally print to file.
 */
export type ConsoleGroup = {
    label: string,
    details?: Array<string>,
    collapse?: boolean,
    numTabs?: number,
    printToConsole?: boolean,
    printToFile?: boolean,
    filePath?: string,
    enableOverwrite?: boolean
}


/**
 * @TODO phase this function out in favor of a logging library
 * @param {ConsoleGroup} consoleGroup {@link ConsoleGroup}
 * @param {string} consoleGroup.label `string`
 * @param {Array<string>} consoleGroup.details `string[]` - log each string in arr on new line
 * @param {boolean} consoleGroup.collapse `boolean` - `optional`, default=false
 * @param {number} consoleGroup.numTabs `number` - `optional`, default=1
 * @param {boolean} consoleGroup.printToConsole `boolean` - `optional`, default=true
 * @param {boolean} consoleGroup.printToFile `boolean` - `optional`, default=true
 * @param {string} consoleGroup.filePath `string` - `${OUTPUT_DIR}/DEFAULT_LOG.txt`
 * @param {boolean} consoleGroup.enableOverwrite `boolean` - `optional`, default=true
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
    filePath = `${OUTPUT_DIR}/DEFAULT_LOG.txt`,
    enableOverwrite = false
}: ConsoleGroup): void {
    let labelOffset = '\t'.repeat(numTabs);
    let bodyOffset = '\t'.repeat(numTabs + 1);
    label = labelOffset + `[${getCurrentPacificTime()}] ` + label
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
                        console.error('Error writing to file', err);
                    }
                }
            );
        } else {
            fs.appendFile(
                filePath, 
                '\n' + labelOffset + label + '\n' + bodyOffset + details.join('\n' + bodyOffset), 
                (err) => {
                    if (err) {
                        console.error('Error appending to file', err);
                    }
                }
            );
        }
    }
}