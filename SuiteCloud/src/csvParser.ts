/**
 * @file src/csvParser.ts
 * @consideration maybe try to enacpsulate parse output into a class that evaluator functions can use...
 * - so that they can reference fields that have already been parsed to prevent repeat function calls...
 * - and other global variables like rowIndex and csvFilePath 
 * @consideration
 * - instead of parsing csv directly to type of `RecordOptions`, could instead parse to
 * record interfaces from src/utils/ns, then have a function that converts those
 * to `RecordOptions`
 * @TODO allow one FieldParseOptions to generate multiple fieldId:FieldValue pairs for the FieldDictionary
 */
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL, DEBUG_LOGS as DEBUG, INFO_LOGS as INFO,
    indentedStringify,
    STOP_RUNNING
} from "./config";
import {
    isNonEmptyArray, isEmptyArray, isNullLike, hasNonTrivialKeys,
    BOOLEAN_TRUE_VALUES,
    BOOLEAN_FALSE_VALUES,
    isBooleanFieldId,
    areEquivalentObjects,
} from "./utils/typeValidation";
import { 
    getDelimiterFromFilePath, DelimiterCharacterEnum,
    ValueMapping, ValueMappingEntry, 
    cleanString, equivalentAlphanumericStrings as equivalentAlphanumeric,
    FieldDictionaryParseOptions,
    FieldParseOptions,
    SublistDictionaryParseOptions,
    SubrecordParseOptions,
    ParseOptions,
    ParseResults,
    IntermediateParseResults,
    SublistLineParseOptions,
    isValidCsv,
    isFieldParseOptions,
    isValueMappingEntry,
} from "./utils/io";
import csv from 'csv-parser';
import fs from 'fs';
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    RecordOptions, RecordTypeEnum, isFieldValue, isSubrecordValue
} from "./utils/api";

/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;
let rowIndex = 0;

/**
 * @param filePath `string` 
 * @param parseOptions {@link ParseOptions}
 * @returns **`results`** `Promise<`{@link ParseResults}`>`
 */
export async function parseRecordCsv(
    filePath: string,
    parseOptions: ParseOptions
): Promise<ParseResults> {
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
    INFO.push(`[START parseRecordCsv()]`,
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
                DEBUG.push(
                    (DEBUG.length > 0 ? NL : '')+`[START ROW] rowIndex: ${rowIndex}:`,
                );
                for (const recordType of Object.keys(parseOptions)) {
                    const { 
                        keyColumn, fieldOptions, sublistOptions 
                    } = parseOptions[recordType];
                    const recordId = cleanString(row[keyColumn]);
                    /** 
                     * `if row` pertains to an existing record in `IntermediateParseResults` 
                     * (e.g. recordType=salesorder and have already processed one of its rows) 
                     * */
                    DEBUG.push(
                        NL+ `recordType: '${recordType}', idColumn: '${keyColumn}', recordId: '${recordId}' -> isExistingRecord ? ${recordId in intermediate[recordType]}`,
                    );
                    let postOptions = (intermediate[recordType][recordId]  
                        ? intermediate[recordType][recordId] 
                        : {
                            recordType: recordType as RecordTypeEnum,
                            isDynamic: NOT_DYNAMIC,
                            fields: {} as FieldDictionary,
                            sublists: {} as SublistDictionary,
                        }
                    ) as RecordOptions;
                    intermediate[recordType][recordId] = processRow(row,
                        postOptions, 
                        fieldOptions as FieldDictionaryParseOptions, 
                        sublistOptions as SublistDictionaryParseOptions
                    );
                }
                // mlog.debug(...DEBUG, NL+`[END ROW] rowIndex: ${rowIndex}:`,);
                DEBUG.length = 0;
                rowIndex++;
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
                INFO.push(NL+`[END parseRecordCsv()]`,
                    TAB + `  recordTypes: ${JSON.stringify(Object.keys(parseOptions))}`,
                    TAB + `Last rowIndex: ${rowIndex}`,
                    TAB + `Parse Summary: ${indentedStringify(parseSummary)}`
                );
                mlog.info(...INFO);
                INFO.length = 0;
                resolve(results)
            });
    });
}

/**
 * - for fields, if want to allow override for fields and if files parsed in chrono order (ascending), 
 * then most recent value will be assigned to field. 
 * - for sublists, make a new {@link SublistLine} if all key-value pairs not equal?
 * @param row `Record<string, any>` - the current row
 * @param postOptions {@link RecordOptions}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @param sublistOptions {@link SublistDictionaryParseOptions}
 * @returns **`postOptions`** — {@link RecordOptions}
 */
function processRow(
    row: Record<string, any>,
    postOptions: RecordOptions,
    fieldOptions: FieldDictionaryParseOptions,
    sublistOptions: SublistDictionaryParseOptions,
): RecordOptions {
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
        const value = (isFieldParseOptions(valueOptions)
            ? parseFieldValue(row, 
                fieldId, valueOptions as FieldParseOptions
            ) as FieldValue
            : generateSetFieldSubrecordOptions(row, fields, 
                fieldId, valueOptions as SubrecordParseOptions
            ) as SubrecordValue
        );
        if (value === '' || value === undefined) { continue; }
        fields[fieldId] = value;
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
    // DEBUG.push(
    //     NL + `[START processSublistDictionaryParseOptions()]`,
    //     TAB+`Object.keys(sublistOptions): ${JSON.stringify(Object.keys(sublistOptions))}`,
    // );
    if (!row || !sublistOptions || isEmptyArray(Object.keys(sublistOptions))) {
        return sublists;
    }
    // DEBUG.push(
    //     NL+`sublists BEFORE processSublistLineParseOptions(): ${indentedStringify(sublists)}`
    // );
    for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
        const sublistLines = (isNonEmptyArray(sublists[sublistId]) 
            ? sublists[sublistId] : []
        ) as SublistLine[];
        sublists[sublistId] = processSublistLineParseOptions(
            row, sublistId, sublistLines, lineOptionsArray as SublistLineParseOptions[]
        );
    }
    // DEBUG.push(
    //     NL+`sublists AFTER processSublistLineParseOptions(): ${indentedStringify(sublists)}`,
    //     NL + `[END processSublistDictionaryParseOptions()]`
    // );
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
        if (lineOptions.lineIdProp) {
            // mlog.debug(`lineOptions.lineIdProp is truthy`,
            //     TAB+`sublistId: '${sublistId}'`,
            //     // TAB+`lineOptions: ${JSON.stringify(lineOptions)}`,
            //     TAB+`lineOptions.lineIdProp: '${lineOptions.lineIdProp}'`,
            // );
            // STOP_RUNNING(); 
            newSublistLine.lineIdProp = lineOptions.lineIdProp; 
            delete lineOptions.lineIdProp;
        }
        for (const sublistFieldId of Object.keys(lineOptions)) {
            const valueOptions = lineOptions[sublistFieldId];
            // mlog.info(`processSublistLineParseOptions()`,
            //     TAB+`sublistId: '${sublistId}', sublistFieldId: '${sublistFieldId}'`,
            //     TAB+`sublistLines.length: ${sublistLines.length}`,
            //     TAB+`valueOptions.keys(): ${Object.keys(valueOptions)}`,
            //     TAB+`'subrecordType' in valueOptions ? ${valueOptions && 'subrecordType' in valueOptions}`,
            // );
            // if (sublistFieldId === 'addressbookaddress') {
            //     mlog.debug(`addressbookaddress - isFieldParseOptions(valueOptions) ? ${isFieldParseOptions(valueOptions)}`,
            //         // TAB+`valueOptions: ${indentedStringify(valueOptions)}`,
            //     );
            //     STOP_RUNNING(1);
            // }
            const value = (isFieldParseOptions(valueOptions)
                ? parseFieldValue(row, 
                    sublistFieldId, valueOptions as FieldParseOptions
                ) as FieldValue
                : generateSetSublistSubrecordOptions(row, sublistId, 
                    sublistFieldId, valueOptions as SubrecordParseOptions
                ) as SubrecordValue
            );
            if (value === '' || value === undefined) { continue; }
            newSublistLine[sublistFieldId] = value;
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
    // DEBUG.push(
    //     NL + `[START generateSetSublistSubrecordOptions()]`, 
    //     TAB+`parentSublistId: '${parentSublistId}'`,
    //     TAB+`  parentFieldId: '${parentFieldId}'`,
    // );
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
    // DEBUG.push(NL + `[END generateSetSublistSubrecordOptions()]`,); 
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
        result.fields = processFieldDictionaryParseOptions(row, 
            result.fields as FieldDictionary, fieldOptions
        );
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = processSublistDictionaryParseOptions(row, 
            result.sublists as SublistDictionary, sublistOptions
        );
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
    // DEBUG.push(
    //     NL +`[START parseFieldValue()] - fieldId: '${fieldId}'`,
    // );
    if (!fieldId || typeof fieldId !== 'string' || isNullLike(valueParseOptions)) {
        return null;
    }
    let value: FieldValue | undefined = undefined;
    const { defaultValue, colName, evaluator, args } = valueParseOptions;
    // DEBUG.push(
    //     TAB+`defaultValue: '${defaultValue}'`,
    //     TAB+`     colName: '${colName}'`,
    //     TAB+`   evlauator: '${evaluator ? evaluator.name+'()': undefined}'`,
    //     // TAB+` args.length:  ${args ? args.length : 0}`,
    // );
    if (evaluator) {
        value = evaluator(row, ...(args || []));
        // DEBUG.push(NL+` -> value from evaluator(row) = '${value}'`);
    } else if (colName) {
        value = transformValue(
            cleanString(row[colName]), colName, fieldId, 
                isNonEmptyArray(args) ? args[0] as ValueMapping : undefined
        );
        // DEBUG.push(NL+` -> value from transformValue(row[colName]) = '${value}'`);
    }
    if (defaultValue !== undefined && (value === undefined || value === '')) {
        value = defaultValue;
        // DEBUG.push(NL+` -> value from defaultValue ='${value}'`);
    }   
    // DEBUG.push(NL+`[END parseFieldValue()] - fieldId: '${fieldId}' -> value: '${value}'`);
    return value as FieldValue;
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
        mlog.error(`ERROR transformValue(): at row ${rowIndex} could not parse value: ${trimmedValue}`);
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
    DEBUG.push(
        NL + `isDuplicateSublistLine() - checking for duplicate sublist line.`,
    );
    const isDuplicateSublistLine = existingLines.some((existingLine, sublistLineIndex) => {
        const canCompareUsingLineIdProp = Boolean(
            existingLine.lineIdProp && newLine.lineIdProp
            && typeof existingLine.lineIdProp === 'string' 
            && typeof newLine.lineIdProp === 'string'  
            && Boolean(newLine[newLine.lineIdProp])
            && typeof newLine[newLine.lineIdProp] === 'string' 
            && typeof existingLine[existingLine.lineIdProp] === 'string'
            && existingLine.lineIdProp === newLine.lineIdProp
        );
        if (canCompareUsingLineIdProp) {
            DEBUG.push(NL + `canCompareUsingLineIdProp === true`,
                TAB + `              existingLine.lineIdProp: '${existingLine.lineIdProp}'`,
                TAB + `                   newLine.lineIdProp: '${newLine.lineIdProp}'`,
                TAB + `existingLine[existingLine.lineIdProp]: '${existingLine[existingLine.lineIdProp as string]}'`,
                TAB + `          newLine[newLine.lineIdProp]: '${newLine[newLine.lineIdProp as string]}'`,
            );
            let idProp = existingLine.lineIdProp as string;
            return equivalentAlphanumeric(
                existingLine[idProp] as string, newLine[idProp] as string
            );
        } 
        return Object.keys(newLine).every(fieldId => {
            const valA = existingLine[fieldId];
            const valB = newLine[fieldId];
            let areFieldsEqual = (isFieldValue(valA) && isFieldValue(valB)
                ? equivalentAlphanumeric(
                    String(valA as FieldValue), String(valB as FieldValue)
                )
                : areEquivalentObjects(valA as SubrecordValue, valB as SubrecordValue)
            );
            // DEBUG.push(
            //     TAB + `sublistLineIndex: ${sublistLineIndex}, fieldId: '${fieldId}',`,
            //     TAB + `valA: '${valA}'`,
            //     TAB + `valB: '${valB}'`,
            //     TAB + `areFieldsEqual: ${areFieldsEqual}`,
            // );
            return areFieldsEqual;
        });
    });
    // DEBUG.push(
    //     NL + ` -> return isDuplicateSublistLine === ${isDuplicateSublistLine}`,
    // );
    return isDuplicateSublistLine;
}


