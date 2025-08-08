/**
 * @file src/utils/io/logging.ts
 */
import * as fs from "fs";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, LOCAL_LOG_DIR } from "../../config/setupLog";
import { isNonEmptyArray, isNonEmptyString, } from "../typeValidation";
import * as validate from "../argumentValidation";
import path from "node:path";

/**
 * Auto-formats debug logs at the end of application execution.
 * Call this function when your main application is finishing.
 * @param filePaths `string[]` - optional, specific file paths to format.
 * If not provided, will format all .txt files in the log directory.
 * @returns `void`
 */
export function autoFormatLogsOnExit(
    filePaths?: string[]
): void {
    try {
        if (isNonEmptyArray(filePaths)) {
            for (const filePath of filePaths) {
                if (fs.existsSync(filePath)) {
                    formatDebugLogFile(filePath);
                }
            }
        } else {
            formatAllDebugLogs();
        }
    } catch (error) {
        // Don't throw errors during exit formatting to avoid disrupting the main flow
        console.error('[autoFormatLogsOnExit()] Error during log formatting:', error);
    }
}

/**
 * Formats a debug log file from JSON format to a more readable text format.
 * Removes the numeric keys and properly handles escape sequences.
 * @param inputFilePath `string` - path to the input log file (e.g., DEBUG.txt)
 * @param outputFilePath `string` - optional, path to the output formatted file. 
 * If not provided, will use inputFilePath with '.FORMATTED' inserted before the extension.
 * @returns `void`
 */
export function formatDebugLogFile(
    inputFilePath: string,
    outputFilePath?: string
): void {
    validate.existingPathArgument(`logging.formatDebugLogFile`, {inputFilePath});
    // Generate output path if not provided
    if (!outputFilePath) {
        const parsedPath = path.parse(inputFilePath);
        outputFilePath = path.join(
            parsedPath.dir, 
            `${parsedPath.name}.FORMATTED${parsedPath.ext}`
        );
    }
    try {
        const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
        const formattedContent = formatLogContent(fileContent);
        fs.writeFileSync(outputFilePath, formattedContent, { encoding: 'utf-8' });
        // mlog.info(`[formatDebugLogFile()] Formatted log file saved to '${outputFilePath}'`);
    } catch (error) {
        mlog.error('[formatDebugLogFile()] Error formatting log file:', error);
        throw error;
    }
}

/**
 * Formats the content of a debug log file from JSON objects to readable text.
 * @param content `string` - the raw content of the log file
 * @returns `string` - the formatted content
 */
function formatLogContent(content: string): string {
    const lines = content.split('\n');
    const formattedLines: string[] = [];
    let currentJsonObject = '';
    let insideJsonObject = false;
    let braceCount = 0;
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '{') {
            insideJsonObject = true;
            braceCount = 1;
            currentJsonObject = line;
        } else if (insideJsonObject) {
            currentJsonObject += '\n' + line;
            // Count braces to detect end of JSON object
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            if (braceCount === 0) {
                // End of JSON object, process it
                try {
                    const logObj = JSON.parse(currentJsonObject);
                    const formattedLogEntry = formatSingleLogEntry(logObj);
                    if (formattedLogEntry.trim()) {
                        formattedLines.push(formattedLogEntry);
                        formattedLines.push(''); // Add blank line between entries
                    }
                } catch (error) {
                    // If JSON parsing fails, include the original content
                    formattedLines.push(
                        '[formatLogContent(string)] Failed to parse JSON object:', 
                        currentJsonObject,''
                    );
                }
                insideJsonObject = false;
                currentJsonObject = '';
            }
        } else if (trimmedLine === '') { // Skip empty lines when not inside JSON object
            continue;
        } else { // Any other content (shouldn't happen with your format, but just in case)
            formattedLines.push(line);
        }
    }
    return  formattedLines.join('\n');
}

/**
 * Formats a single log entry object into readable text.
 * @param logObj `Record<string, any>` - the parsed log object
 * @returns `string` - the formatted log entry
 */
function formatSingleLogEntry(logObj: Record<string, any>): string {
    const lines: string[] = [];
    
    // Extract metadata (keys like '-1', '-2', 'meta0', etc.)
    const metaKeys = Object.keys(logObj).filter(key => 
        key.startsWith('-') || key.startsWith('meta') || key.includes('meta')
    );
    const contentKeys = Object.keys(logObj).filter(key => 
        !key.startsWith('-') && !key.startsWith('meta') && /^\d+$/.test(key)
    ).sort((a, b) => parseInt(a) - parseInt(b)); // Sort numeric keys
    // Add metadata line
    if (metaKeys.length > 0) {
        let metaValue = metaKeys.map(key => logObj[key]).join(' ');
        // const metaValue = logObj[metaKeys[0]]; // Use first meta key found
        if (metaValue) {
            lines.push(unescapeString(metaValue) + '\n');
        }
    }
    // Add content lines (without the numeric keys)
    for (const key of contentKeys) {
        const value = logObj[key];
        if (isNonEmptyString(value)) {
            const unescapedValue = unescapeString(value);
            if (unescapedValue.trim()) {
                lines.push(unescapedValue);
            }
        }
    }
    return lines.join(''); // lines.join('\n');
}

/**
 * Unescapes a string by replacing escape sequences with their actual characters.
 * @param s `string` - the string with escape sequences
 * @returns `string` - the unescaped string
 */
function unescapeString(s: string): string {
    return String(s) // coerce passed value to string
        .replace(/\\n/g, '\n')        // Replace \n with actual newlines
        .replace(/\\t/g, '\t')        // Replace \t with actual tabs
        .replace(/\\r/g, '\r')        // Replace \r with carriage returns
        .replace(/\\"/g, '"')         // Replace \" with actual quotes
        .replace(/\\\\/g, '\\')       // Replace \\ with single backslash
        .replace(/\\'/g, "'");        // Replace \' with actual single quotes
}

/**
 * Formats all debug log files in the log directory.
 * Looks for .txt files and creates .FORMATTED.txt versions.
 * @param logDirectory `string` - optional, path to the log directory. 
 * If not provided, uses LOCAL_LOG_DIR from setupLog.ts
 * @returns `void`
 */
export function formatAllDebugLogs(
    logDirectory?: string
): void {
    let logDir: string = logDirectory || LOCAL_LOG_DIR;
    if (!fs.existsSync(logDir)) {
        mlog.warn(`[formatAllDebugLogs()] Log directory does not exist: ${logDir}`);
        return;
    }
    try {
        const files = fs.readdirSync(logDir);
        const txtFiles = files.filter(file => 
            file.endsWith('.txt') && !file.includes('.FORMATTED.')
        );
        if (txtFiles.length === 0) {
            mlog.warn(`[formatAllDebugLogs()] No .txt log files found in ${logDir}`);
            return;
        }
        for (const txtFile of txtFiles) {
            const inputPath = path.join(logDir, txtFile);
            try {
                formatDebugLogFile(inputPath);
                // mlog.info(`[formatAllDebugLogs()] Formatted: ${txtFile}`);
            } catch (error) {
                mlog.error(`[formatAllDebugLogs()] Failed to format ${txtFile}:`, error);
            }
        }
    } catch (error) {
        mlog.error('[formatAllDebugLogs()] Error reading log directory:', error);
        throw error;
    }
}
