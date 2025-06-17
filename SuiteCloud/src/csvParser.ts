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
    getDelimiterFromFilePath, DelimiterCharacterEnum,
    ValueMapping, ValueMappingEntry, isValueMappingEntry, 
    cleanString, equivalentAlphanumericStrings as equivalentAlphanumeric,
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
): Promise<ParseResults>{
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        mlog.error(`ERROR parseRecordsFromCsv(): Invalid 'filePath' parameter:`,
            TAB+`expected param 'filePath' of type 'string'`,
            TAB+`received '${typeof filePath}' = '${filePath}'`,
        );
        return {};
    }
    const delimiter = getDelimiterFromFilePath(filePath);
    if (!isValidCsv(filePath, delimiter)) {
        mlog.error(`ERROR parseRecordsFromCsv(): Invalid CSV file: isValidCsv() returned false`,
            TAB+` filePath: '${filePath}'`,
            TAB+`delimiter: '${delimiter}'`,
            TAB+`Please check the file and try again.`,
        );
        return {};
    }
    if (isNullLike(parseOptions)) {
        mlog.error(`ERROR parseRecordsFromCsv(): Invalid 'options' parameter:`,
            TAB+`expected param 'options' object of type 'ParseOptions'`,
            TAB+`received '${typeof parseOptions}' = '${parseOptions}'`,
        );
        return {};
    }
    const startTime = new Date();
    mlog.info(`parseRecordsFromCsv() Starting parse...`,
        TAB+`  startTime:  ${startTime.toLocaleString()}.`,
        TAB+`recordTypes: ${JSON.stringify(Object.keys(parseOptions))}`,
        TAB+`   filePath: '${filePath}'`,
    );           
    const results: ParseResults = {};
    const intermediate: IntermediateParseResults = {};
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
                        // if row pertains to an existing record in IntermediateParseResults 
                        // e.g. recordType=salesorder and have already processed one of its rows
                        postOptions = intermediate[recordType][recordId];
                    } else {
                        postOptions = {
                            recordType: recordType as RecordTypeEnum,
                            fields: {},
                            sublists: {},
                        } as PostRecordOptions;
                    }
                    intermediate[recordType][recordId] = processRow(
                        row, postOptions, fieldOptions, sublistOptions
                    );
                }
            })
            .on('error', (error: Error) => {
                reject(error);
            })
            .on('end', () => {
                for (const recordType of Object.keys(intermediate)) {
                    results[recordType] = Object.values(intermediate[recordType]);
                }
                const parseSummary = Object.keys(results).reduce((acc, recordType) => {
                    acc[recordType] = results[recordType].length;
                    return acc;
                }, {} as Record<string, number>);
                const endTime = new Date();
                mlog.info(`Finished processing CSV file at ${endTime.toLocaleString()}.`,
                    TAB + `  recordTypes: ${JSON.stringify(Object.keys(parseOptions))}`,
                    TAB + ` Elapsed Time: ${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(5)} seconds`,
                    TAB + `Last rowIndex: ${rowIndex}`,
                    TAB + `Parse Summary: ${indentedStringify(parseSummary)}`
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
    if (!row || !postOptions) {
        return postOptions;
    }
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        postOptions.fields = processFieldDictionaryParseOptions(row, postOptions, fieldOptions);
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        postOptions.sublists = processSublistDictionaryParseOptions(row, postOptions, sublistOptions);
    }
    return postOptions;
}

/**
 * @param row `Record<string, any>`
 * @param postOptions {@link PostRecordOptions}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @returns **`fields`** {@link FieldDictionary} 
 */
function processFieldDictionaryParseOptions(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    fieldOptions: FieldDictionaryParseOptions,
): FieldDictionary {
    if (!row || !postOptions || !fieldOptions || isEmptyArray(Object.keys(fieldOptions))) {
        return postOptions.fields || {};
    }
    const fields: FieldDictionary = (postOptions.fields || {}) as FieldDictionary;
    for (const fieldId of Object.keys(fieldOptions)) {
        if (!fieldId || typeof fieldId !== 'string') { continue; }
        const options = fieldOptions[fieldId];
        if (isSubrecordValue(options)) {
            fields[fieldId] = generateSetFieldSubrecordOptions(
                row, postOptions, fieldId, options as SubrecordParseOptions
            ) as SubrecordValue;
        } else {
            fields[fieldId] = parseFieldValue(
                row, fieldId, options as FieldParseOptions
            ) as FieldValue;
        }
    }
    return fields;
}

/**
 * @param row 
 * @param postOptions 
 * @param sublistOptions 
 * @returns **`sublists`** {@link SublistDictionary}
 */
function processSublistDictionaryParseOptions(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    sublistOptions: SublistDictionaryParseOptions,
): SublistDictionary {
    if (!row || !postOptions || !sublistOptions || isEmptyArray(Object.keys(sublistOptions))) {
        return postOptions.sublists || {};
    }
    const sublists: SublistDictionary = (postOptions.sublists || {}) as SublistDictionary;
    for (const sublistId of Object.keys(sublistOptions)) {
        if (!sublistId || typeof sublistId !== 'string') { continue; }
        const lineParseOptions = sublistOptions[sublistId];
        const newSublistLine: SublistLine = {};
        for (const sublistFieldId of Object.keys(lineParseOptions)) {
            if (!sublistFieldId || typeof sublistFieldId !== 'string') { continue; }
            const sublistFieldOptions = lineParseOptions[sublistFieldId];
            if (isSubrecordValue(sublistFieldOptions)) {
                newSublistLine[sublistFieldId] = generateSetSublistSubrecordOptions(
                    row, postOptions, sublistId, sublistFieldId,
                    sublistFieldOptions as SubrecordParseOptions
                ) as SubrecordValue;
            } else {
                newSublistLine[sublistFieldId] = parseFieldValue(
                    row, sublistFieldId, 
                    sublistFieldOptions as FieldParseOptions
                ) as FieldValue;
            }
        }
        const hasExistingSublistLine = Boolean(sublists[sublistId] 
            && isNonEmptyArray(sublists[sublistId])
        ); 
        const sublistLines = (hasExistingSublistLine
            ? sublists[sublistId] 
            : []
        ) as SublistLine[];
        if (!isDuplicateSublistLine(sublistLines, newSublistLine)) {
            sublistLines.push(newSublistLine);
        }
        sublists[sublistId] = sublistLines;
    }
    return sublists;
}

/**
 * @param row 
 * @param postOptions 
 * @param fieldId 
 * @param subrecordOptions 
 * @returns **`result`** {@link SetFieldSubrecordOptions}
 */
function generateSetFieldSubrecordOptions(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    fieldId: string,
    subrecordOptions: SubrecordParseOptions,
): SetFieldSubrecordOptions {
    const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
    const result = (postOptions.fields[fieldId] 
        ? postOptions.fields[fieldId] // overwrite existing subrecord options
        : { subrecordType, fieldId, fields: {}, sublists: {} } // create new subrecord options
    ) as SetFieldSubrecordOptions;
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        result.fields = processFieldDictionaryParseOptions(row, postOptions, fieldOptions);
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = processSublistDictionaryParseOptions(row, postOptions, sublistOptions);
    }
    return result;
}

/**
 * @param row `Record<string, any>`
 * @param postOptions {@link PostRecordOptions}
 * @param parentSublistId `string` the `parentSublistId` (The `internalid` of the main record's sublist)
 * @param parentFieldId `string` (i.e. `parentFieldId`) The `internalid` of the sublist field that holds a subrecord
 * @param subrecordOptions {@link SubrecordParseOptions} = `{ subrecordType`: string, `fieldOptions`: {@link FieldDictionaryParseOptions}, `sublistOptions`: {@link SublistDictionaryParseOptions}` }`
 * @returns **`result`** {@link SetSublistSubrecordOptions}
 */
function generateSetSublistSubrecordOptions(
    row: Record<string, any>,
    postOptions: PostRecordOptions,
    parentSublistId: string,
    parentFieldId: string,
    subrecordOptions: SubrecordParseOptions,
): SetSublistSubrecordOptions {
    const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
    const result = (postOptions.fields[parentSublistId]
        ? postOptions.fields[parentSublistId] // overwrite existing subrecord options
        : { // create new subrecord options
            subrecordType, 
            sublistId: parentSublistId, 
            fieldId: parentFieldId, 
            fields: {}, 
            sublists: {} 
    }) as SetSublistSubrecordOptions;
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        result.fields = processFieldDictionaryParseOptions(row, postOptions, fieldOptions);
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = processSublistDictionaryParseOptions(row, postOptions, sublistOptions);
    }
    return result;
}

/**
 * @param row `Record<string, any>`
 * @param fieldId `string`
 * @param valueParseOptions {@link FieldParseOptions}
 * @returns **`value`** {@link FieldValue}
 */
function parseFieldValue(
    row: Record<string, any>,
    fieldId: string,
    valueParseOptions: FieldParseOptions,
): FieldValue {
    if (!fieldId || typeof fieldId !== 'string' || isNullLike(valueParseOptions)) {
        return null;
    }
    let value: FieldValue = null;
    const { defaultValue, colName, evaluator, args } = valueParseOptions;
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
 * @param originalValue - The original value to be transformed with valueMapping or default operaitons
 * @param originalKey  - The original column header (key) of the value being transformed
 * @param newKey - The new column header (`fieldId`) (key) of the value being transformed
 * @param valueMapping {@link ValueMapping} (i.e. `valueOverrides`) - An optional mapping object
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
        } else { // !isValueMappingEntry -> Simple mapping (applies to all columns)
            return mappedValue;
        }
    }
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
        mlog.warn(`ERROR transformValue(): at row ${rowIndex} could not parse value: ${trimmedValue}`);
        return trimmedValue;
    }
}

/**
 * Compares subrecord value objects by shallow equality of their keys and values
 * @param existingLines `Array<`{@link SublistLine}`>`
 * @param newLine {@link SublistLine}
 * @returns **`isDuplicateSublistLine`** `boolean`
 * - `true` if the `newLine` is a duplicate of any line in `existingLines` (every key-value pair is the same), 
 * - `false` otherwise.
 */
export function isDuplicateSublistLine(
    existingLines: SublistLine[],
    newLine: SublistLine,
): boolean {
    if (!isNonEmptyArray(existingLines)) {
        return false;
    }
    const isDuplicateSublistLine = existingLines.some(existingLine => {
        return Object.keys(newLine).every(fieldId => {
            const valA = existingLine[fieldId];
            const valB = newLine[fieldId];
            if (isSubrecordValue(valA) && isSubrecordValue(valB)) {
                const keysA = Object.keys(valA);
                const keysB = Object.keys(valB);
                if (keysA.length !== keysB.length) return false;
                return keysA.every(key => 
                    equivalentAlphanumeric(String(valA[key]), String(valB[key]))
                );
            }
            return equivalentAlphanumeric(String(valA), String(valB));
        });
    });
    return isDuplicateSublistLine;
}

/**
 * @param value `any`
 * @returns **`isSubrecordValue`** `boolean`
 * - `true` if the `value` is an object with a `subrecordType` property,
 * - `false` otherwise.
 */
export function isSubrecordValue(value: any): value is SubrecordValue {
    return typeof value === 'object' && value !== null && 'subrecordType' in value;
}

/**
 * @param filePath `string`
 * @param delimiter `string` {@link DelimiterCharacterEnum}
 * @returns **`isValidCsv`** `boolean`
 * - `true` if the CSV file at `filePath` is valid (all rows have the same number of columns as the header),
 * - `false` `otherwise`. 
 */
export function isValidCsv(
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