import { 
    CreateRecordOptions, 
    FieldDictionary,
    FieldValue,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SublistDictionary, 
    SublistFieldDictionary,  
    BatchCreateRecordRequest,  
    SetSubrecordOptions,

    ParseOptions,
    FieldDictionaryParseOptions, 
    FieldParentTypeEnum, 
    FieldSubrecordMapping, 
    FieldValueMapping, 
    SublistDictionaryParseOptions, 
    SublistFieldDictionaryParseOptions, 
    SublistFieldValueMapping, 
    SublistSubrecordMapping 
} from "./utils/api/types";
import { RecordTypeEnum } from "./utils/api/types/NS";
import {
    hasKeys, isBooleanFieldId, isNullLike,
} from "./utils/typeValidation";
import { stripChar, printConsoleGroup as print, getDelimiterFromFilePath} from "./utils/io";
import { DATA_DIR, OUTPUT_DIR, STOP_RUNNING } from "./config/env";
import csv from 'csv-parser';
import fs from 'fs';
import { ValueMapping, ValueMappingEntry, isValueMappingEntry } from "./utils/io/types";
import { BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES } from "./config/constants";

const NOT_DYNAMIC = false;
let rowIndex = 0;

/**
 * 
 * @param csvPath - The path to the CSV file.
 * @param parseOptionsArray - `Array<`{@link ParseOptions}`>` 
 * - = `{ recordType: `{@link RecordTypeEnum}, `fieldDictParseOptions: `{@link FieldDictionaryParseOptions}, `sublistDictParseOptions: `{@link SublistDictionaryParseOptions}` }[]`
 * @returns `results` - `Promise<Array<`{@link CreateRecordOptions}`>>` 
 * - = `{ recordType: `{@link RecordTypeEnum}, `isDynamic: boolean`, `fieldDict: `{@link FieldDictionary}, `sublistDict: `{@link SublistDictionary}` }[]`
 */
export async function parseCsvToCreateOptions(
    csvPath: string,
    parseOptionsArray: ParseOptions[],
): Promise<CreateRecordOptions[]> {
    if (!fs.existsSync(csvPath)) {
        throw new Error(`parseCsvToCreateOptions() Unable to Start: File not found: ${csvPath}`);
    }
    return new Promise((resolve, reject) => {
        const results: CreateRecordOptions[] = [];
        if (!parseOptionsArray?.length) {
            throw new Error('parseOptionsArray must contain at least one ParseOptions configuration');
        }
        rowIndex = 0;
        fs.createReadStream(csvPath)
            .pipe(csv({ separator: getDelimiterFromFilePath(csvPath)}))
            .on('data', (row: Record<string, any>) => {
                try {
                    // Process each parse configuration for every row
                    for (const [index, options] of Object.entries(parseOptionsArray)) {
                        const { recordType, fieldDictParseOptions, sublistDictParseOptions, valueOverrides, pruneFunc } = options;
                        
                        // Validate required fields exist in CSV row
                        validateFieldMappings(row, fieldDictParseOptions, sublistDictParseOptions);
                        let createOptions: CreateRecordOptions | null = generateCreateRecordOptions(
                            row,
                            recordType,
                            fieldDictParseOptions,
                            sublistDictParseOptions,
                            valueOverrides
                        );
                        if (pruneFunc) {
                            createOptions = pruneFunc(createOptions);
                        }
                        if (!createOptions) {
                            console.log(`parseCsvToCreateOptions() rowIndex ${rowIndex}, parseOptionsArray[${index}], recordType ${recordType} was pruned by pruneOptions() and will not be included in the batch request`);
                            continue;
                        }
                        results.push(createOptions);
                    }
                } catch (error) {
                    console.error(`Error processing row ${rowIndex}:`, error);
                    reject(error);
                }
                rowIndex++;
            })
            .on('end', () => resolve(results))
            .on('error', reject);
        });
}

/**
 * @TODO maybe try to use {@link hasKeys}`(obj, keys)` to validate the row object
 * @param row `Record<string, any>` - The CSV row to validate.
 * @param fieldDict - {@link FieldDictionaryParseOptions} = `{ fieldValueMapArray: Array<`{@link FieldValueMapping}`>, subrecordMapArray: Array<`{@link FieldSubrecordMapping}`> }`
 * @param sublistDict - {@link SublistDictionaryParseOptions} = `{ [sublistId: string]: { fieldValueMapArray: Array<`{@link SublistFieldValueMapping}`>, subrecordMapArray: Array<`{@link SublistSubrecordMapping}`> } }`
 * @throws Error if any of the required fields are missing in the CSV row
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
      // No validation needed for rowEvaluator-based mappings
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
 * @description returns a {@link CreateRecordOptions} object for the given row and record type. to use in a request body to make a record in NetSuite in standard mode (`isDynamic = false`).
 * @param row `Record<string, any>`
 * @param recordType - {@link RecordTypeEnum}
 * @param fieldDictParseOptions - {@link FieldDictionaryParseOptions} = `{ fieldValueMapArray: Array<`{@link FieldValueMapping}`>, subrecordMapArray: Array<`{@link FieldSubrecordMapping}`> }`
 * @param sublistDictParseOptions - {@link SublistDictionaryParseOptions} = `{ [sublistId: string]: { fieldValueMapArray: Array<`{@link SublistFieldValueMapping}`>, subrecordMapArray: Array<`{@link SublistSubrecordMapping}`> } }`
 * @param valueOverrides - {@link ValueMapping} = `{ [originalValue: string]: `{@link FieldValue} | {@link ValueMappingEntry}` }`
 * @returns `createOptions` - {@link CreateRecordOptions} = `{ recordType: string, isDynamic: boolean=false, fieldDict: `{@link FieldDictionary},` sublistDict: `{@link SublistDictionary}` }`
 */
export function generateCreateRecordOptions(
    row: Record<string, any>, 
    recordType: RecordTypeEnum, 
    fieldDictParseOptions: FieldDictionaryParseOptions, 
    sublistDictParseOptions: SublistDictionaryParseOptions,
    valueOverrides?: ValueMapping
): CreateRecordOptions {
    let createOptions = { 
        recordType: recordType,
        isDynamic: NOT_DYNAMIC,
        fieldDict: generateFieldDictionary(row, fieldDictParseOptions, valueOverrides) as FieldDictionary,
        sublistDict: generateSublistDictionary(row, sublistDictParseOptions, valueOverrides) as SublistDictionary,
    }
    return createOptions as CreateRecordOptions;
}


/**
 * 
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
 * 
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
 * 
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
 * 
 * @param row `Record<string, any>`
 * @param sublistFieldValueMapArray `Array<`{@link SublistFieldValueMapping}`>` = `{ sublistId`: string, `line`: number, `fieldId`: string, `colName`?: string`, `rowEvaluator`?: `(row: Record<string, any>) => `{@link FieldValue}` }[]`
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
        let { sublistId, line, fieldId, defaultValue, colName, rowEvaluator } = sublistFieldValueMap;
        if (!fieldId || (isNullLike(defaultValue) && !colName && !rowEvaluator)) {
            throw new Error(`generateSetFieldValueOptionsArray(), fieldValueMapArray[${index}], invalid mapping for ${fieldId} must have fieldId and colName or rowEvaluator or defaultValue`);
        }     
        let rowValue: FieldValue = null;    
        if (rowEvaluator) {
            rowValue = rowEvaluator(row);
        } else if (colName) {
            rowValue = transformValue(String(row[colName]), colName, fieldId, valueOverrides);
        } 
        
        if (defaultValue !== undefined && isNullLike(rowValue)) {
            rowValue = defaultValue;
        }

        if (isNullLike(rowValue)) {
            print({
                label: `generateSetSublistValueOptionsArray(), row=${rowIndex} rowValue after transformValue or rowEvaluator is null or undefined`, 
                details: [
                `sublistFieldValueMap[${index}]: { sublistId: ${sublistId}, fieldId: ${fieldId}, defaultValue: ${defaultValue}, colName: ${colName} }`,
                `rowValue="${rowValue}" -> continue to next sublistFieldValueMap`
                ], printToConsole: false, printToFile: true, enableOverwrite: false
            });
            continue;
        }
        arr.push({
            sublistId: sublistId, 
            line: line === undefined || line === null ? parseInt(index) : line, 
            fieldId: fieldId, 
            value: rowValue 
        });
    }
    return arr;
}

/**
 * 
 * @param row `Record<string, any>`
 * @param fieldValueMapArray `Array<`{@link FieldValueMapping}`>` = `{ fieldId`: string, `colName`?: string, `rowEvaluator`?: `(row: Record<string, any>) => `{@link FieldValue}` }[]` 
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
            let { fieldId, defaultValue, colName, rowEvaluator } = fieldValueMap;
            if (!fieldId || (isNullLike(defaultValue) && !colName && !rowEvaluator)) {
                throw new Error(`generateSetFieldValueOptionsArray(), fieldValueMapArray[${index}], invalid mapping for ${fieldId} must have fieldId and colName or rowEvaluator or defaultValue`);
            }     
            let rowValue: FieldValue = null;
            if (rowEvaluator) {
                rowValue = rowEvaluator(row);
            } else if (colName) {
                rowValue = transformValue(String(row[colName]), colName, fieldId, valueOverrides);
            }

            if (defaultValue !== undefined && isNullLike(rowValue)) {
                rowValue = defaultValue;
            }   
            
            if (isNullLike(rowValue)) {
                print({
                    label: `rowIndex ${rowIndex}: generateSetFieldValueOptionsArray() rowValue is null or undefined.`, 
                    details: [
                    `fieldValueMap[${index}]: { fieldId: ${fieldId}, defaultValue: ${defaultValue}, colName: ${colName}}`,
                    `rowValue="${rowValue}" -> continue to next fieldValueMap`
                    ], printToConsole: false, printToFile: true, enableOverwrite: false
                });
                continue;
            }
            arr.push({fieldId: fieldId, value: rowValue })
        } catch (error) {
            print({
                label: `rowIndex: ${rowIndex} - generateSetFieldValueOptionsArray() Error processing fieldValueMap[${index}].`, 
                details: [JSON.stringify(error, null, 4)], printToConsole: false, printToFile: true, enableOverwrite: false
            });
        }
    }
    return arr;
}

/**
 * 
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
        
        // try to parse as date
        // TODO: use regex to check if date is in a valid format (e.g. YYYY-MM-DD, MM/DD/YYYY, etc.)

        // else return as string
        return trimmedValue;
    } catch (error) {
        console.warn(`transformValue() for a value in row ${rowIndex} Could not parse value: ${trimmedValue}`);
        return trimmedValue;
    }
}