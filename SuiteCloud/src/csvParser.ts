/**
 * @file src/csvParser.ts
 */
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL, DEBUG_LOGS,
    indentedStringify,
    STOP_RUNNING
} from "./config";
import {
    isNonEmptyArray, isEmptyArray, isNullLike,
    BOOLEAN_TRUE_VALUES,
    BOOLEAN_FALSE_VALUES,
    isBooleanFieldId
} from "./utils/typeValidation";
import { 
    getDelimiterFromFilePath, DelimiterCharacterEnum, DelimitedFileTypeEnum,
    ValueMapping, ValueMappingEntry, isValueMappingEntry, 
    cleanString, equivalentAlphanumericStrings,
} from "./utils/io";
import csv from 'csv-parser';
import fs from 'fs';
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    PostRecordOptions, RecordTypeEnum, 
    CloneOptions, 
    FieldDictionaryParseOptions, FieldParseOptions, SubrecordParseOptions,
    SublistDictionaryParseOptions,
} from "./utils/api";

/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;
let rowIndex = 0;
type ParseOptions = {
    [recordType: RecordTypeEnum | string]: {
        keyColumn: string,
        fieldOptions?: FieldDictionaryParseOptions,
        sublistOptions?: SublistDictionaryParseOptions,
    };
}
type IntermediateParseResults = {
    [recordType: RecordTypeEnum | string]: {
        [recordId: string]: PostRecordOptions
    }
};
type ParseResults = {[recordType: RecordTypeEnum | string]: PostRecordOptions[]};

async function parseRecordsFromCsv(
    filePath: string,
    parseOptions: ParseOptions
): Promise<any>{
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        mlog.error(`ERROR parseRecordsFromCsv(): Invalid 'filePath' parameter:`,
            TAB+`expected param 'filePath' of type 'string'`,
            TAB+`received '${typeof filePath}' = '${filePath}'`,
        );
        return [];
    }
    const delimiter = getDelimiterFromFilePath(filePath);
    if (!isValidCsv(filePath, delimiter)) {
        mlog.error(`ERROR parseRecordsFromCsv(): Invalid CSV file: isValidCsv() returned false`,
            TAB+` filePath: '${filePath}'`,
            TAB+`delimiter: '${delimiter}'`,
            TAB+`Please check the file and try again.`,
        );
        return [];
    }
    if (isNullLike(parseOptions)) {
        mlog.error(`ERROR parseRecordsFromCsv(): Invalid 'options' parameter:`,
            TAB+`expected param 'options' object of type 'ParseOptions'`,
            TAB+`received '${typeof parseOptions}' = '${parseOptions}'`,
        );
        return [];
    }
    const startTime = new Date();
    mlog.info(`parseRecordsFromCsv() Starting parse...`,
        TAB+`  startTime:  ${startTime.toLocaleString()}.`,
        TAB+`recordTypes: ${JSON.stringify(Object.keys(parseOptions))}`,
        TAB+`   filePath: '${filePath}'`,
    );           
    let results: ParseResults = {};
    let intermediate: IntermediateParseResults = {};
    for (const recordType of Object.keys(parseOptions)) {
        results[recordType] = [];
        intermediate[recordType] = {};
    }
    return new Promise((resolve, reject) => {
        rowIndex = 0;
        fs.createReadStream(filePath)
            .pipe(csv({ separator: delimiter}))
            .on('data', (row: Record<string, any>) => {
                for (const recordType of Object.keys(parseOptions)) {
                    const { keyColumn, fieldOptions, sublistOptions } = parseOptions[recordType];
                    const recordId = cleanString(row[keyColumn]);
                    let postOptions: PostRecordOptions;
                    if (intermediate[recordType][recordId]) {
                        postOptions = intermediate[recordType][recordId];
                    } else {
                        postOptions = {
                            recordType: recordType as RecordTypeEnum,
                            fields: {},
                            sublists: {},
                        } as PostRecordOptions;
                    }
                    intermediate[recordType][recordId] = postOptions;
                }
            })
            .on('error', (error: Error) => {
                reject(error);
            })
            .on('end', () => {
                const endTime = new Date();
                mlog.info(`Finished processing CSV file at ${endTime.toLocaleString()}.`,
                    TAB + `  recordTypes: ${JSON.stringify(Object.keys(parseOptions))}`,
                    TAB + ` Elapsed Time: ${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(5)} seconds`,
                    TAB + `Last rowIndex: ${rowIndex}`,
                );
                resolve(results)
            });
    });
}

/**
 * - for fields, if allow override for fields, then if files parsed in chrono order (ascending), 
 * then most recent value will be assigned to field. 
 * - for sublists, make a new SublistLine if all key-value pairs not equal?*/
function processRow(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    fieldOptions: FieldDictionaryParseOptions,
    sublistOptions: SublistDictionaryParseOptions,
): PostRecordOptions {
    for (const fieldId of Object.keys(fieldOptions)) {
        if (!fieldId || typeof fieldId !== 'string') { continue; }
        const options = fieldOptions[fieldId];
        if (isSubrecordValue(options)) {
            postOptions.fields[fieldId] = generateSetFieldSubrecordOptions(
                row, 
                postOptions, 
                fieldId, 
                options as SubrecordParseOptions
            );
        } else {
            postOptions.fields[fieldId] = parseFieldValue(
                row, 
                fieldId, 
                options as FieldParseOptions
            );
        }
        
        
    }
    return postOptions;
}

function generateSetFieldSubrecordOptions(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    fieldId: string,
    subrecordOptions: SubrecordParseOptions,
): SetFieldSubrecordOptions {
    const { subrecordType, fieldDictionaryOptions, sublistDictionaryOptions} = subrecordOptions;
    const setSubrecordOptions = (postOptions.fields[fieldId] 
        ? postOptions.fields[fieldId] // overwrite existing subrecord options
        : { subrecordType, fieldId, fields: {}, sublists: {} } // create new subrecord options
    ) as SetFieldSubrecordOptions;
    if (fieldDictionaryOptions && isNonEmptyArray(Object.keys(fieldDictionaryOptions))) {
        for (const subrecordFieldId of Object.keys(fieldDictionaryOptions)) {
            const subrecordFieldOptions = fieldDictionaryOptions[subrecordFieldId];
            if (Object.prototype.hasOwnProperty.call(fieldDictionaryOptions, 'subrecordType')) {
                setSubrecordOptions.fields[subrecordFieldId] = generateSetFieldSubrecordOptions(row, postOptions, subrecordFieldId, subrecordFieldOptions as SubrecordParseOptions);
            } else {
                setSubrecordOptions.fields[subrecordFieldId] = parseFieldValue(row, subrecordFieldId, subrecordFieldOptions as FieldParseOptions);
            }
        }   
    }
    if (sublistDictionaryOptions && isNonEmptyArray(Object.keys(sublistDictionaryOptions))) {
        for (const sublistId of Object.keys(sublistDictionaryOptions)) {
            const sublistFieldOptions = sublistDictionaryOptions[sublistId];
            const potentialSublistLine: SublistLine = {};
            for (const sublistFieldId of Object.keys(sublistFieldOptions)) {
                const sublistFieldParseOptions = sublistFieldOptions[sublistFieldId];
                if (isSubrecordValue(sublistFieldParseOptions)) {
                    potentialSublistLine[sublistFieldId] = generateSetSublistSubrecordOptions(
                        row,
                        postOptions,
                        sublistId,
                        sublistFieldId,
                        sublistFieldParseOptions as SubrecordParseOptions
                    ) as SetSublistSubrecordOptions; // as SubrecordValue;
                } else {
                    potentialSublistLine[sublistFieldId] = parseFieldValue(row, sublistFieldId, sublistFieldParseOptions as FieldParseOptions);
                }
            }
            const hasExistingSublistLine = Boolean(setSubrecordOptions.sublists[sublistId] 
                && isNonEmptyArray(setSubrecordOptions.sublists[sublistId])
            ); 
            const sublistLines = (hasExistingSublistLine
                ? setSubrecordOptions.sublists[sublistId] 
                : []
            ) as SublistLine[];
            if (!isDuplicateSublistLine(sublistLines, potentialSublistLine)) {
                sublistLines.push(potentialSublistLine);
            }
            setSubrecordOptions.sublists[sublistId] = sublistLines;
        }
    }
    return setSubrecordOptions;
}

function generateSetSublistSubrecordOptions(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    sublistId: string,
    fieldId: string,
    subrecordOptions: SubrecordParseOptions,
): SetSublistSubrecordOptions {
    const { subrecordType, fieldDictionaryOptions, sublistDictionaryOptions} = subrecordOptions;





    return {} as SetSublistSubrecordOptions;
}

function parseFieldValue(
    row: Record<string, any>,
    fieldId: string,
    fieldParseOptions: FieldParseOptions,
): FieldValue {
    if (!fieldId || typeof fieldId !== 'string' || isNullLike(fieldParseOptions)) {
        return null;
    }
    let value: FieldValue = null;
    const { defaultValue, colName, evaluator, args } = fieldParseOptions;
    if (evaluator) {
        value = evaluator(row, ...(args || []));
    } else if (colName) {
        value = transformValue(String(row[colName]), colName, fieldId);
    }

    if (defaultValue !== undefined && isNullLike(value)) {
        value = defaultValue;
    }   
    return value;
}

/**
 * @param {string} originalValue - The original value to be transformed with valueMapping or default operaitons
 * @param {string} originalKey  - The original column header (key) of the value being transformed
 * @param {string} newKey - The new column header (`fieldId`) (key) of the value being transformed
 * @param {ValueMapping} [valueMapping] {@link ValueMapping}
 * @returns **`transformedValue`** {@link FieldValue}
 */
export function transformValue(
    originalValue: string, 
    originalKey: string,
    newKey: string,
    valueMapping?: ValueMapping
): FieldValue {
    const trimmedValue = originalValue.trim();
    if (valueMapping && trimmedValue in valueMapping) {
        const mappedValue = valueMapping[trimmedValue];
        if (isValueMappingEntry(mappedValue)) {
            const validColumns = Array.isArray(mappedValue.validColumns) 
                ? mappedValue.validColumns 
                : [mappedValue.validColumns];
                
            if (validColumns.includes(originalKey)) {
                return mappedValue.newValue;
            }
        } else {
            // Handle simple value mapping (applies to all columns)
            return mappedValue;
        }
    }
    // Fallback to automatic type conversion
    try {
        // try to parse as boolean
        if (BOOLEAN_TRUE_VALUES.includes(trimmedValue.toLowerCase()) && isBooleanFieldId(newKey)) {
            return true
        } else if (BOOLEAN_FALSE_VALUES.includes(trimmedValue.toLowerCase()) && isBooleanFieldId(newKey)) {
            return false
        };
        
        // maybe try to parse as date
        // TODO: use regex to check if date is in a valid format (e.g. YYYY-MM-DD, MM/DD/YYYY, etc.)
        // else return as string
        return trimmedValue;
    } catch (error) {
        console.warn(`transformValue() for a value in row ${rowIndex} Could not parse value: ${trimmedValue}`);
        return trimmedValue;
    }
}

/**
 * 
 * @param existingLines `Array<`{@link SublistLine}`>`
 * @param newLine {@link SublistLine}
 * @returns **`boolean`** 
 * - `true` if the `newLine` is a duplicate of any line in `existingLines`, 
 * - `false` otherwise.
 */
function isDuplicateSublistLine(
    existingLines: SublistLine[],
    newLine: SublistLine,
): boolean {
    if (existingLines.length === 0) {
        return false;
    }
    return existingLines.some(existingLine => {
        return Object.keys(newLine).every(fieldId => {
            const valA = existingLine[fieldId];
            const valB = newLine[fieldId];
            if (isSubrecordValue(valA) && isSubrecordValue(valB)) {
                // Compare subrecord objects by shallow equality of their keys and values
                const keysA = Object.keys(valA);
                const keysB = Object.keys(valB);
                if (keysA.length !== keysB.length) return false;
                return keysA.every(key => equivalentAlphanumericStrings(String(valA[key]), String(valB[key])));
            }
            return equivalentAlphanumericStrings(String(valA), String(valB));
        });
    });
}

function isSubrecordValue(value: any): value is SubrecordValue {
    return typeof value === 'object' && value !== null && 'subrecordType' in value;
}

function isValidCsv(
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
        if (header.length !== rowValues.length) {
            mlog.warn(`isValidCsv(): Invalid row found: header.length !== rowValues.length`,
                TAB+`   header.length: ${header.length},`,
                TAB+`rowValues.length: ${rowValues.length}`,
                TAB+` => Difference =  ${header.length - rowValues.length}`,
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