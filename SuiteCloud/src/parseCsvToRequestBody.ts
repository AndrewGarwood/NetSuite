/**
 * @file src/parseCsvToRequestBody.ts
 */
import { 
    PostRecordOptions, 
    FieldDictionary,
    FieldValue,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistDictionary, 
    SublistFieldDictionary,   
    SetSubrecordOptions,

    ParseOptions, RecordParseOptions, ParseResults,
    FieldDictionaryParseOptions, 
    FieldParentTypeEnum, 
    FieldSubrecordMapping, 
    FieldValueMapping, 
    SublistDictionaryParseOptions, 
    SublistFieldDictionaryParseOptions, 
    SublistFieldValueMapping, 
    SublistSubrecordMapping 
} from "./utils/api/types";
import { RecordTypeEnum } from "./utils/NS";
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "./config/setupLog";
import {
    isBooleanFieldId, isNullLike, BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES
} from "./utils/typeValidation";
import { getDelimiterFromFilePath, indentedStringify } from "./utils/io";
import { STOP_RUNNING } from "./config/env";
import csv from 'csv-parser';
import fs from 'fs';
import { ValueMapping, ValueMappingEntry, isValueMappingEntry } from "./utils/io/types";

/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;
let rowIndex = 0;
let pruneCount: Record<string, number> = {};

/**
 * @TODO modify handling of pruneFunc so that can read the invalid PostRecordOptions 
 * instead of just returning the ParseOptions that generated them
 * 
 */

/**
 * @param csvPath `string` - The path to the CSV file.
 * @param recordParseOptions - {@link RecordParseOptions}
 * - = `{ [key` in {@link RecordTypeEnum}`]?:` {@link ParseOptions}`[] }`
 * - {@link ParseOptions} =
 * - -  `{ recordType: `{@link RecordTypeEnum}, `fieldDictParseOptions: `{@link FieldDictionaryParseOptions}, `sublistDictParseOptions: `{@link SublistDictionaryParseOptions}` }`
 * @returns **`results`** - `Promise<`{@link ParseResults}`>` 
 * = `{ [key` in {@link RecordTypeEnum}`]?:` `{ validPostOptions: Array<`{@link PostRecordOptions}`>, invalidParseOptions: Array<`{@link PostRecordOptions}`> } }`
 * - {@link PostRecordOptions} = `{ recordType: `{@link RecordTypeEnum}, `isDynamic: boolean`, `fieldDict: `{@link FieldDictionary}, `sublistDict: `{@link SublistDictionary}` }`
 */
export async function parseCsvToPostRecordOptions(
    csvPath: string,
    recordParseOptions: RecordParseOptions
): Promise<ParseResults>

export async function parseCsvToPostRecordOptions(
    csvPath: string,
    parseOptionsArray: ParseOptions[],
): Promise<ParseResults>

export async function parseCsvToPostRecordOptions(
    csvPath: string,
    /** `arg2` = {@link ParseOptions}`[]` or {@link RecordParseOptions} */
    arg2: RecordParseOptions | ParseOptions[],
): Promise<ParseResults> {
    if (!csvPath || typeof csvPath !== 'string') {
        throw new Error(`ERROR in parseCsvToPostRecordOptions() Unable to Start: No csvPath provided.`);
    }
    if (!fs.existsSync(csvPath)) {
        throw new Error(`ERROR in parseCsvToPostRecordOptions() Unable to Start: File not found: ${csvPath}`);
    }
    if (!arg2 
        || (Array.isArray(arg2) && arg2.length === 0) 
        || (typeof arg2 === 'object' && Object.keys(arg2).length === 0)
    ) {
        throw new Error(`ERROR in parseCsvToPostRecordOptions() Unable to Start: No arg2: (parseOptionsArray OR recordParseOptions) provided.`);
    }
    const recordParseOptions = {} as RecordParseOptions;
    // handle overload when arg2 is an array of ParseOptions
    if (Array.isArray(arg2)) { 
        arg2.forEach((parseOptions, index) => {
            const recordType = parseOptions.recordType;
            if (!recordType) {
                throw new Error(`ERROR in parseCsvToPostRecordOptions() Unable to Start: No recordType provided in parseOptions at arg2 parseOptionsArray[${index}].`);
            }
            if (recordParseOptions[recordType]) {
                recordParseOptions[recordType].push(parseOptions);
            } else {
                recordParseOptions[recordType] = [parseOptions];
            }
        })
    }
    if (!recordParseOptions || Object.keys(recordParseOptions).length === 0) {
        throw new Error(`ERROR in parseCsvToPostRecordOptions() Unable to Start: No parse options provided.`);
    }
    const results: ParseResults = {};
    Object.keys(recordParseOptions).forEach(recordKey => {
        results[recordKey] = { validPostOptions: [], invalidParseOptions: [] };
    });
    return new Promise((resolve, reject) => {
        rowIndex = 0;
        fs.createReadStream(csvPath)
            .pipe(csv({ separator: getDelimiterFromFilePath(csvPath)}))
            .on('data', (row: Record<string, any>) => {
                for (let recordKey of Object.keys(recordParseOptions)) {
                    const parseOptionsArray = recordParseOptions[recordKey] as ParseOptions[];
                    if (!Array.isArray(parseOptionsArray) || parseOptionsArray.length === 0) {
                        log.error(`ERROR in parseCsvToPostRecordOptions() No parse options provided for recordParseOptions["${recordKey}"].`);
                    }
                    for (let [arrIndex, parseOptions] of Object.entries(parseOptionsArray)) {
                        try {
                            const { 
                                recordType, 
                                fieldDictParseOptions, 
                                sublistDictParseOptions, 
                                valueOverrides, 
                                pruneFunc 
                            } = parseOptions as ParseOptions;
                            if (recordKey !== recordType) {
                                log.error(`ERROR in parseCsvToPostRecordOptions() recordType ${recordKey} does not match parseOptions recordType ${recordType}.`);
                                continue;
                            }   
                            validateFieldMappings(row, fieldDictParseOptions, sublistDictParseOptions);
                            let postOptions: PostRecordOptions | null = generatePostRecordOptions(
                                row,
                                recordType,
                                fieldDictParseOptions,
                                sublistDictParseOptions,
                                valueOverrides
                            );
                            if (pruneFunc) {
                                postOptions = pruneFunc(postOptions);
                            }
                            if (!postOptions) {
                                pruneCount[recordType] = (pruneCount[recordType] || 0) + 1;
                                results[recordType]?.invalidParseOptions.push(parseOptions);
                                continue;
                            }
                            results[recordType]?.validPostOptions.push(postOptions);
                        } catch (error) {
                            log.error(`ERROR in parseCsvToPostRecordOptions() Error processing row ${rowIndex} at recordType ${recordKey}'s parseOptionsArray[${arrIndex}]:`, error);
                            results[recordKey]?.invalidParseOptions.push(...parseOptionsArray);
                            reject(error);
                        }
                    }
                }
                rowIndex++;
            })
            .on('end', () => {
                const parseSummary: Record<string, any> = {};
                Object.keys(results).forEach(recordKey => {
                    parseSummary[recordKey] = {
                        validPostOptions: results[recordKey]?.validPostOptions.length || 0,
                        invalidParseOptions: results[recordKey]?.invalidParseOptions.length || 0,
                        pruneCount: pruneCount[recordKey] || 0,
                    }
                });
                log.debug(
                    `Finished processing CSV file`,
                    TAB + `Last rowIndex: ${rowIndex}`,
                    TAB + `recordType(s): [${Object.keys(recordParseOptions).join(', ')}]`, 
                    // TAB + `pruneCount:`, JSON.stringify(pruneCount),
                    TAB + ` parseSummary:`, indentedStringify(parseSummary),
                    TAB + `      csvPath: "${csvPath}"`
                );
                resolve(results)
            })
            .on('error', reject);
    });
}

/**
 * @param row `Record<string, any>` - The CSV row to validate.
 * @param fieldDict - {@link FieldDictionaryParseOptions} = `{ fieldValueMapArray: Array<`{@link FieldValueMapping}`>, subrecordMapArray: Array<`{@link FieldSubrecordMapping}`> }`
 * @param sublistDict - {@link SublistDictionaryParseOptions} = `{ [sublistId: string]: { fieldValueMapArray: Array<`{@link SublistFieldValueMapping}`>, subrecordMapArray: Array<`{@link SublistSubrecordMapping}`> } }`
 * @throws `Error` if any of the required fields are missing in the CSV row
 */
function validateFieldMappings(
    row: Record<string, any>,
    fieldDict: FieldDictionaryParseOptions,
    sublistDict: SublistDictionaryParseOptions
): void {
    // Validate body field mappings
    fieldDict.fieldValueMapArray?.forEach(mapping => {
        if ('colName' in mapping && mapping.colName && !(mapping.colName in row)) {
            throw new Error(`Missing CSV column for field mapping: ${mapping.colName}`);
        }
    });

    // Validate sublist field mappings
    Object.values(sublistDict).forEach(sublist => {
        sublist.fieldValueMapArray?.forEach(mapping => {
            if ('colName' in mapping && mapping.colName && !(mapping.colName in row)) {
                throw new Error(`Missing CSV column for sublist mapping: ${mapping.colName}`);
            }
        });
    });
}

/**
 * @description returns a {@link PostRecordOptions} object for the given row and record type. to use in a request body to make a record in NetSuite in standard mode (`isDynamic = false`).
 * @param row `Record<string, any>`
 * @param recordType - {@link RecordTypeEnum}
 * @param fieldDictParseOptions - {@link FieldDictionaryParseOptions} = `{ fieldValueMapArray: Array<`{@link FieldValueMapping}`>, subrecordMapArray: Array<`{@link FieldSubrecordMapping}`> }`
 * @param sublistDictParseOptions - {@link SublistDictionaryParseOptions} = `{ [sublistId: string]: { fieldValueMapArray: Array<`{@link SublistFieldValueMapping}`>, subrecordMapArray: Array<`{@link SublistSubrecordMapping}`> } }`
 * @param valueOverrides - {@link ValueMapping} = `{ [originalValue: string]: `{@link FieldValue} | {@link ValueMappingEntry}` }`
 * @returns `postOptions` - {@link PostRecordOptions} = `{ recordType: string, isDynamic: boolean=false, fieldDict: `{@link FieldDictionary},` sublistDict: `{@link SublistDictionary}` }`
 */
export function generatePostRecordOptions(
    row: Record<string, any>, 
    recordType: RecordTypeEnum, 
    fieldDictParseOptions: FieldDictionaryParseOptions, 
    sublistDictParseOptions: SublistDictionaryParseOptions,
    valueOverrides?: ValueMapping
): PostRecordOptions {
    let postOptions = { 
        recordType: recordType,
        isDynamic: NOT_DYNAMIC,
        fieldDict: generateFieldDictionary(row, fieldDictParseOptions, valueOverrides) as FieldDictionary,
        sublistDict: generateSublistDictionary(row, sublistDictParseOptions, valueOverrides) as SublistDictionary,
    }
    return postOptions as PostRecordOptions;
}


/**
 * @param row `Record<string, any>`
 * @param fieldDictParseOptions {@link FieldDictionaryParseOptions} = { `fieldValueMapArray`: `Array<`{@link FieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link FieldSubrecordMapping}`> }`
 * @param valueOverrides {@link ValueMapping} = `{ [originalValue: string]: `{@link FieldValue} | {@link ValueMappingEntry}` }`
 * @returns `fieldDict` — {@link FieldDictionary} = { `valueFields`: `Array<`{@link SetFieldValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`> }`
 */
export function generateFieldDictionary(
    row: Record<string, any>,
    fieldDictParseOptions: FieldDictionaryParseOptions, 
    valueOverrides?: ValueMapping
): FieldDictionary {
    const fieldDict = {
        valueFields: generateSetFieldValueOptionsArray(row, fieldDictParseOptions.fieldValueMapArray, valueOverrides) as SetFieldValueOptions[],
        subrecordFields: generateSetSubrecordOptionsArray(row, FieldParentTypeEnum.BODY, fieldDictParseOptions.subrecordMapArray || [], valueOverrides) as SetSubrecordOptions[],
    } as FieldDictionary;
    return fieldDict;
}

/**
 * @param row `Record<string, any>`
 * @param sublistDictParseOptions {@link SublistDictionaryParseOptions} = { [`sublistId`: string]: {@link SublistFieldDictionaryParseOptions} }
 * = { [`sublistId`: string]: { `fieldValueMapArray`: `Array<`{@link SublistFieldValueMapping}`>`, `subrecordMapArray`: `Array<`{@link SublistSubrecordMapping}`>` } } 
 * @param valueOverrides {@link ValueMapping} = `{ [originalValue: string]: `{@link FieldValue} | {@link ValueMappingEntry}` }`
 * @returns `sublistDict` — {@link SublistDictionary} = { [`sublistId`: string]: {@link SublistFieldDictionary} }
 * = { [`sublistId`: string]: { `valueFields`: `Array<`{@link SetSublistValueOptions}`>`, `subrecordFields`: `Array<`{@link SetSubrecordOptions}`>` } }
 */
export function generateSublistDictionary(
    row: Record<string, any>, 
    sublistDictParseOptions: SublistDictionaryParseOptions,
    valueOverrides?: ValueMapping
): SublistDictionary {
    const sublistDict = {} as SublistDictionary;
    for (let sublistId of Object.keys(sublistDictParseOptions)) {
        let sublistFieldDictOptions: SublistFieldDictionaryParseOptions = sublistDictParseOptions[sublistId];
        sublistDict[sublistId] = {
            valueFields: generateSetSublistValueOptionsArray(row, sublistFieldDictOptions.fieldValueMapArray, valueOverrides) as SetSublistValueOptions[],
            subrecordFields: generateSetSubrecordOptionsArray(row, FieldParentTypeEnum.SUBLIST, sublistFieldDictOptions.subrecordMapArray || [], valueOverrides) as SetSubrecordOptions[],
        } as SublistFieldDictionary;
    }
    return sublistDict;
}

/**
 * @param row `Record<string, any>`
 * @param parentType {@link FieldParentTypeEnum} 
 * @param subrecordMapArray `Array<`{@link FieldSubrecordMapping}`> | Array<`{@link SublistSubrecordMapping}`>`
 * @returns `arr` — `Array<`{@link SetSubrecordOptions}`>` = `{ parentSublistId`?: string, `line`?: string, `fieldId`: string, `subrecordType`: string, `fieldDict`: {@link FieldDictionary}, `sublistDict`: {@link SublistDictionary}` }[]`
 */
export function generateSetSubrecordOptionsArray(
    row: Record<string, any>, 
    parentType: FieldParentTypeEnum, 
    subrecordMapArray: FieldSubrecordMapping[] | SublistSubrecordMapping[],
    valueOverrides?: ValueMapping
): SetSubrecordOptions[] {
    let arr = [] as SetSubrecordOptions[];    
    if (parentType === FieldParentTypeEnum.BODY) {
        for (let subrecordMap of subrecordMapArray) {
            let { fieldId, subrecordType, fieldDictOptions, sublistDictOptions } = subrecordMap as FieldSubrecordMapping;
            let fieldSubrecOptions: SetSubrecordOptions = {
                fieldId: fieldId,
                subrecordType: subrecordType,
            }
            if (fieldDictOptions) {
                fieldSubrecOptions.fieldDict = generateFieldDictionary(row, fieldDictOptions, valueOverrides);
            }
            if (sublistDictOptions) {
                fieldSubrecOptions.sublistDict = generateSublistDictionary(row, sublistDictOptions, valueOverrides);
            }
            arr.push(fieldSubrecOptions);
        }
    } else if (parentType === FieldParentTypeEnum.SUBLIST) {
        for (let [index, subrecordMap] of Object.entries(subrecordMapArray)) {
            let { parentSublistId, line, fieldId, subrecordType, fieldDictParseOptions: fieldDictOptions, sublistDictParseOptions: sublistDictOptions } = subrecordMap as SublistSubrecordMapping;
            let sublistSubrecOptions: SetSubrecordOptions = {
                parentSublistId: parentSublistId,
                line: line === undefined || line === null ? parseInt(index) : line,
                fieldId: fieldId,
                subrecordType: subrecordType,
            }
            if (fieldDictOptions) {
                sublistSubrecOptions.fieldDict = generateFieldDictionary(row, fieldDictOptions, valueOverrides);
            }
            if (sublistDictOptions) {
                sublistSubrecOptions.sublistDict = generateSublistDictionary(row, sublistDictOptions, valueOverrides);
            }
            arr.push(sublistSubrecOptions);
        }
    } else {
        throw new Error(`generateSetSubrecordOptionsArray() Invalid parentType: ${parentType}`);
    }
    return arr;
}

/**
 * @param row `Record<string, any>`
 * @param sublistFieldValueMapArray `Array<`{@link SublistFieldValueMapping}`>` = `{ sublistId`: string, `line`: number, `fieldId`: string, `colName`?: string`, `evaluator`?: `(row: Record<string, any>) => `{@link FieldValue}` }[]`
 * @param valueOverrides {@link ValueMapping} = `{ [originalValue: string]: `{@link FieldValue} | {@link ValueMappingEntry}` }`
 * @returns `arr` — `Array<`{@link SetSublistValueOptions}`>` = `{ sublistId`: string, `line`: number, `fieldId`: string, `value`: string | number | boolean | Date` }[]`
 */
export function generateSetSublistValueOptionsArray(
    row: Record<string, any>,
    sublistFieldValueMapArray: SublistFieldValueMapping[],
    valueOverrides?: ValueMapping
): SetSublistValueOptions[] {
    let arr = [] as SetSublistValueOptions[];
    for (let [index, sublistFieldValueMap] of Object.entries(sublistFieldValueMapArray)) {
        try {
            let { sublistId, line, fieldId, defaultValue, colName, evaluator, args } = sublistFieldValueMap;
            if (!fieldId || (isNullLike(defaultValue) && !colName && !evaluator)) {
                throw new Error(`generateSetFieldValueOptionsArray(), fieldValueMapArray[${index}], invalid mapping for ${fieldId} must have fieldId and colName or evaluator or defaultValue`);
            }     
            let rowValue: FieldValue = null;    
            if (evaluator) {
                rowValue = evaluator(row, ...(args || []));
            } else if (colName) {
                rowValue = transformValue(String(row[colName]), colName, fieldId, valueOverrides);
            } 
            
            if (defaultValue !== undefined && isNullLike(rowValue)) {
                rowValue = defaultValue;
            }

            if (isNullLike(rowValue)) {
                continue;
            }
            arr.push({
                sublistId: sublistId, 
                line: line === undefined || line === null ? parseInt(index) : line, 
                fieldId: fieldId, 
                value: rowValue 
            });
        } catch (error) {
            log.error(`rowIndex ${rowIndex}: generateSetSublistValueOptionsArray() Error processing sublistFieldValueMapArray[${index}]:`, 
                `${sublistFieldValueMap}`, error);
        }
    }
    return arr;
}

/**
 * @param row `Record<string, any>`
 * @param fieldValueMapArray `Array<`{@link FieldValueMapping}`>` = `{ fieldId`: string, `colName`?: string, `evaluator`?: `(row: Record<string, any>) => `{@link FieldValue}` }[]` 
 * @param valueOverrides {@link ValueMapping} = `{ [originalValue: string]: `{@link FieldValue} | {@link ValueMappingEntry}` }`
 * @returns `arr` — `Array<`{@link SetFieldValueOptions}`>` = `{ fieldId`: string, `value`: string | number | boolean | Date` }[]`
 */
export function generateSetFieldValueOptionsArray(
    row: Record<string, any>, 
    fieldValueMapArray: FieldValueMapping[],
    valueOverrides?: ValueMapping
): SetFieldValueOptions[] {
    let arr = [] as SetFieldValueOptions[];
    for (let [index, fieldValueMap] of Object.entries(fieldValueMapArray)) {
        try {
            let { fieldId, defaultValue, colName, evaluator, args } = fieldValueMap;
            if (!fieldId || (isNullLike(defaultValue) && !colName && !evaluator)) {
                throw new Error(`generateSetFieldValueOptionsArray(), fieldValueMapArray[${index}], invalid mapping for ${fieldId} must have fieldId and colName or evaluator or defaultValue`);
            }     
            let rowValue: FieldValue = null;
            if (evaluator) {
                rowValue = evaluator(row, ...(args || []));
            } else if (colName) {
                rowValue = transformValue(String(row[colName]), colName, fieldId, valueOverrides);
            }

            if (defaultValue !== undefined && isNullLike(rowValue)) {
                rowValue = defaultValue;
            }   
            
            if (isNullLike(rowValue)) {
                continue;
            }
            arr.push({fieldId: fieldId, value: rowValue })
        } catch (error) {
            log.error(`rowIndex ${rowIndex}: generateSetFieldValueOptionsArray() Error processing fieldValueMapArray[${index}]:`, 
                `${fieldValueMap}`, error);
        }
    }
    return arr;
}

/**
 * @param {string} originalValue - The original value to be transformed with valueMapping or default operaitons
 * @param {string} originalKey  - The original column header (key) of the value being transformed
 * @param {string} newKey - The new column header (`fieldId`) (key) of the value being transformed
 * @param {ValueMapping} [valueMapping] {@link ValueMapping}
 * @returns `transformedValue` {@link FieldValue}
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