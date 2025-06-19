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
    isNonEmptyArray, isEmptyArray, isNullLike, hasNonTrivialKeys,
    BOOLEAN_TRUE_VALUES,
    BOOLEAN_FALSE_VALUES,
    isBooleanFieldId
} from "./utils/typeValidation";
import { 
    getDelimiterFromFilePath, DelimiterCharacterEnum,
    ValueMapping, ValueMappingEntry, isValueMappingEntry, 
    cleanString, equivalentAlphanumericStrings as equivalentAlphanumeric,
    FieldDictionaryParseOptions,
    FieldParseOptions,
    SublistDictionaryParseOptions,
    SubrecordParseOptions,
    ParseOptions,
    ParseResults,
    IntermediateParseResults,
    SublistLineParseOptions,
} from "./utils/io";
import csv from 'csv-parser';
import fs from 'fs';
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    PostRecordOptions, RecordTypeEnum, 
} from "./utils/api";

/**
 * @consideration
 * - instead of parsing csv directly to type of `PostRecordOptions`, could instead parse to
 * record interfaces from src/utils/ns, then have a function that converts those
 * to `PostRecordOptions`
 */

/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;
let rowIndex = 0;


export async function parseRecords(
    filePath: string,
    parseOptions: ParseOptions
): Promise<ParseResults>{
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
        mlog.error(`ERROR parseRecords(): Invalid 'filePath' parameter:`,
            TAB+`expected param 'filePath' of type 'string'`,
            TAB+`received '${typeof filePath}' = '${filePath}'`,
        );
        return {};
    }
    const delimiter = getDelimiterFromFilePath(filePath);
    if (!isValidCsv(filePath, delimiter)) {
        mlog.error(`ERROR parseRecords(): Invalid CSV file: isValidCsv() returned false`,
            TAB+` filePath: '${filePath}'`,
            TAB+`delimiter: '${delimiter}'`,
            TAB+`Please check the file and try again.`,
        );
        return {};
    }
    if (isNullLike(parseOptions)) {
        mlog.error(`ERROR parseRecords(): Invalid 'options' parameter:`,
            TAB+`expected param 'options' object of type 'ParseOptions'`,
            TAB+`received '${typeof parseOptions}' = '${parseOptions}'`,
        );
        return {};
    }
    const startTime = new Date();
    mlog.info(`parseRecords() Starting parse...`,
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
                    /** 
                     * `if row` pertains to an existing record in `IntermediateParseResults` 
                     * (e.g. recordType=salesorder and have already processed one of its rows) 
                     * */
                    let postOptions = (intermediate[recordType][recordId]  
                        ? intermediate[recordType][recordId] 
                        : {
                            recordType: recordType as RecordTypeEnum,
                            isDynamic: NOT_DYNAMIC,
                            fields: {} as FieldDictionary,
                            sublists: {} as SublistDictionary,
                        }
                    ) as PostRecordOptions;
                    
                    intermediate[recordType][recordId] = processRow(
                        row, postOptions, 
                        fieldOptions as FieldDictionaryParseOptions, 
                        sublistOptions as SublistDictionaryParseOptions
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
 * - for fields, if want to allow override for fields and if files parsed in chrono order (ascending), 
 * then most recent value will be assigned to field. 
 * - for sublists, make a new {@link SublistLine} if all key-value pairs not equal?
 * @param row `Record<string, any>` - the current row
 * @param postOptions {@link PostRecordOptions}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @param sublistOptions {@link SublistDictionaryParseOptions}
 * @returns **`postOptions`** — {@link PostRecordOptions}
 */
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
        postOptions.fields = processFieldDictionaryParseOptions(
            row, postOptions.fields as FieldDictionary, fieldOptions
        );
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        postOptions.sublists = processSublistDictionaryParseOptions(
            row, postOptions.sublists as SublistDictionary, sublistOptions
        );
    }
    return postOptions;
}

/**
 * @param row `Record<string, any>`
 * @param fields {@link FieldDictionary}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @returns **`fields`** {@link FieldDictionary} 
 */
function processFieldDictionaryParseOptions(
    row: Record<string, any>,
    fields: FieldDictionary,
    fieldOptions: FieldDictionaryParseOptions,
): FieldDictionary {
    if (!row || !fields || !fieldOptions || isEmptyArray(Object.keys(fieldOptions))) {
        return fields;
    }
    for (const fieldId of Object.keys(fieldOptions)) {
        if (!fieldId || typeof fieldId !== 'string') { continue; }
        const valueOptions = fieldOptions[fieldId];
        fields[fieldId] = (isSubrecordValue(valueOptions)
            ? generateSetFieldSubrecordOptions(row, fields, 
                fieldId, valueOptions as SubrecordParseOptions
            ) as SubrecordValue
            : parseFieldValue(row, 
                fieldId, valueOptions as FieldParseOptions
            ) as FieldValue
        );
    }
    return fields;
}

/**
 * @param row 
 * @param sublists 
 * @param sublistOptions 
 * @returns **`sublists`** {@link SublistDictionary}
 */
function processSublistDictionaryParseOptions(
    row: Record<string, any>,
    sublists: SublistDictionary,
    sublistOptions: SublistDictionaryParseOptions,
): SublistDictionary {
    if (!row || !sublistOptions || isEmptyArray(Object.keys(sublistOptions))) {
        return sublists;
    }
    for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
        const sublistLines = (isNonEmptyArray(sublists[sublistId]) 
            ? sublists[sublistId] : []
        ) as SublistLine[];
        sublists[sublistId] = processSublistLineParseOptions(
            row, sublistId, sublistLines, lineOptionsArray as SublistLineParseOptions[]
        );
    }
    return sublists;
}

function processSublistLineParseOptions(
    row: Record<string, any>,
    sublistId: string,
    sublistLines: SublistLine[],
    lineOptionsArray: SublistLineParseOptions[],
): SublistLine[] {
    if (!row || !sublistId || !isNonEmptyArray(lineOptionsArray) || !Array.isArray(sublistLines)) {
        return sublistLines;
    }
    for (const lineOptions of lineOptionsArray) {
        const newSublistLine: SublistLine = {};
        for (const sublistFieldId of Object.keys(lineOptions)) {
            const valueOptions = lineOptions[sublistFieldId];
            newSublistLine[sublistFieldId] = (isSubrecordValue(valueOptions)
                ? generateSetSublistSubrecordOptions(row, sublistId, 
                    sublistFieldId, valueOptions as SubrecordParseOptions
                ) as SubrecordValue 
                : parseFieldValue(row, 
                    sublistFieldId, valueOptions as FieldParseOptions
                ) as FieldValue
            );
        }
        if (!isDuplicateSublistLine(sublistLines, newSublistLine)) {
            sublistLines.push(newSublistLine);
        }
    }
    return sublistLines;
}

/**
 * @param row `Record<string, any>`
 * @param parentSublistId `string` the `parentSublistId` (The `internalid` of the main record's sublist)
 * @param parentFieldId `string` (i.e. `parentFieldId`) The `internalid` of the sublist field that holds a subrecord
 * @param subrecordOptions {@link SubrecordParseOptions} = `{ subrecordType`: string, `fieldOptions`: {@link FieldDictionaryParseOptions}, `sublistOptions`: {@link SublistDictionaryParseOptions}` }`
 * @returns **`result`** {@link SetSublistSubrecordOptions}
 */
function generateSetSublistSubrecordOptions(
    row: Record<string, any>,
    parentSublistId: string,
    parentFieldId: string,
    subrecordOptions: SubrecordParseOptions,
): SetSublistSubrecordOptions {
    if (!row || !parentSublistId || !parentFieldId || isNullLike(subrecordOptions)) {
        return {} as SetSublistSubrecordOptions;
    }
    const { subrecordType, fieldOptions, sublistOptions } = subrecordOptions;
    const result = {
        subrecordType, 
        sublistId: parentSublistId, 
        fieldId: parentFieldId
    } as SetSublistSubrecordOptions;
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        result.fields = processFieldDictionaryParseOptions(row, {}, fieldOptions);
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = processSublistDictionaryParseOptions(row, {}, sublistOptions);
    }
    return result;
}

/**
 * @param row 
 * @param fields 
 * @param fieldId 
 * @param subrecordOptions 
 * @returns **`result`** {@link SetFieldSubrecordOptions}
 */
function generateSetFieldSubrecordOptions(
    row: Record<string, any>,
    fields: FieldDictionary,
    fieldId: string,
    subrecordOptions: SubrecordParseOptions,
): SetFieldSubrecordOptions {
    const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
    const result = (fields && fields[fieldId] 
        ? fields[fieldId] // overwrite existing subrecord options
        : { subrecordType, fieldId, fields: {}, sublists: {} } // create new subrecord options
    ) as SetFieldSubrecordOptions;
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        result.fields = processFieldDictionaryParseOptions(row, result.fields as FieldDictionary, fieldOptions);
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = processSublistDictionaryParseOptions(row, result.sublists as SublistDictionary, sublistOptions);
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
    if (!isNonEmptyArray(existingLines)) { // existingLines isEmptyArray === true, or it's undefined
        return false;
    }
    const isDuplicateSublistLine = existingLines.some(existingLine => {
        return Object.keys(newLine).every(fieldId => {
            const valA = existingLine[fieldId];
            const valB = newLine[fieldId];
            if (isSubrecordValue(valA) && isSubrecordValue(valB)) {
                return areEquivalentSubrecordValues(valA, valB);
            }
            return equivalentAlphanumeric(String(valA), String(valB));
        });
    });
    return isDuplicateSublistLine;
}
/**
 * Compares subrecord value objects by shallow equality of their keys and values 
 * */
export function areEquivalentSubrecordValues(valA: SubrecordValue, valB: SubrecordValue): boolean {
    if (!isSubrecordValue(valA) || !isSubrecordValue(valB)) {
        return false;
    }
    const keysA = Object.keys(valA);
    const keysB = Object.keys(valB);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => 
        equivalentAlphanumeric(
            String((valA as Record<string, any>)[key]), 
            String((valB as Record<string, any>)[key])
        )
    );
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
        if (header.length !== rowValues.length 
            && i !== lines.length-1 // allow for empty last row in files.
        ) {
            mlog.warn(`isValidCsv(): Invalid row found: header.length !== rowValues.length`,
                TAB+`   header.length: ${header.length},`,
                TAB+`rowValues.length: ${rowValues.length}`,
                TAB+` -> Difference =  ${header.length - rowValues.length}`,
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