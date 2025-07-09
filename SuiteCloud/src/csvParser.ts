/**
 * @file src/csvParser.ts
 */
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL, DEBUG_LOGS as DEBUG, INFO_LOGS as INFO,
    indentedStringify, SUPPRESSED_LOGS as SUP,
    STOP_RUNNING
} from "./config";
import {
    isNonEmptyArray, isEmptyArray, isNullLike as isNull, anyNull,
    BOOLEAN_TRUE_VALUES,
    BOOLEAN_FALSE_VALUES,
    isBooleanFieldId,
    areEquivalentObjects,
} from "./utils/typeValidation";
import { 
    getDelimiterFromFilePath, DelimiterCharacterEnum,
    ValueMapping, ValueMappingEntry, getRows,
    clean, equivalentAlphanumericStrings as equivalentAlphanumeric,
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
    SublistLineIdOptions,
    DATE_STRING_PATTERN,
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
    if (!isValidCsv(filePath)) {
        mlog.error(`ERROR parseRecords(): Invalid CSV file: isValidCsv() returned false`,
            TAB+` filePath: '${filePath}'`,
            TAB+`Please check the file and try again.`,
        );
        return {};
    }
    if (isNull(parseOptions)) {
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
    let rowIndex = 0;
    const rows = await getRows(filePath);
    for (const row of rows) {
        DEBUG.push(
            (DEBUG.length > 0 ? NL : '')+`[START ROW] rowIndex: ${rowIndex}:`,
        );
        for (const recordType of Object.keys(parseOptions)) {
            const { 
                keyColumn, fieldOptions, sublistOptions 
            } = parseOptions[recordType];
            const recordId = clean(row[keyColumn]);
            /** 
             * `if row` pertains to an existing record in `IntermediateParseResults` 
             * (e.g. recordType=salesorder and have already processed one of its rows) 
             * */
            DEBUG.push(
                NL+ `recordType: '${recordType}', idColumn: '${keyColumn}', recordId: '${recordId}' -> isExistingRecord ? ${
                    recordId in intermediate[recordType]
                }`,
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
            intermediate[recordType][recordId] = await processRow(row,
                postOptions, 
                fieldOptions as FieldDictionaryParseOptions, 
                sublistOptions as SublistDictionaryParseOptions
            );
        }
        mlog.debug(...DEBUG, NL+`[END ROW] rowIndex: ${rowIndex}:`,);
        DEBUG.length = 0;
        SUP.length = 0;
        rowIndex++;
    }
    
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
    return results;
}

/**
 * - for fields, if want to allow override for fields and if files parsed in chrono order (ascending), 
 * then most recent value will be assigned to field. 
 * - for sublists, make a new {@link SublistLine} if all key-value pairs not equal?
 * @param row `Record<string, any>` - the current row
 * @param record {@link RecordOptions}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @param sublistOptions {@link SublistDictionaryParseOptions}
 * @returns **`postOptions`** — {@link RecordOptions}
 */
async function processRow(
    row: Record<string, any>,
    record: RecordOptions,
    fieldOptions: FieldDictionaryParseOptions,
    sublistOptions: SublistDictionaryParseOptions,
): Promise<RecordOptions> {
    if (!row || !record) {
        return record;
    }
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        record.fields = await processFieldDictionaryParseOptions(
            row, record.fields as FieldDictionary, fieldOptions
        );
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        record.sublists = await processSublistDictionaryParseOptions(
            row, record.sublists as SublistDictionary, sublistOptions
        );
    }
    return record;
}

/**
 * @param row `Record<string, any>`
 * @param fields {@link FieldDictionary}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @returns **`fields`** {@link FieldDictionary} 
 */
async function processFieldDictionaryParseOptions(
    row: Record<string, any>,
    fields: FieldDictionary,
    fieldOptions: FieldDictionaryParseOptions,
): Promise<FieldDictionary> {
    if (!row || !fields || !fieldOptions || isEmptyArray(Object.keys(fieldOptions))) {
        return fields;
    }
    for (const fieldId of Object.keys(fieldOptions)) {
        if (!fieldId || typeof fieldId !== 'string') { continue; }
        const valueOptions = fieldOptions[fieldId];
        const value = (isFieldParseOptions(valueOptions)
            ? await parseFieldValue(row, 
                fieldId, valueOptions as FieldParseOptions
            ) as FieldValue
            : await generateFieldSubrecordOptions(row, fields, 
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
async function processSublistDictionaryParseOptions(
    row: Record<string, any>,
    sublists: SublistDictionary,
    sublistOptions: SublistDictionaryParseOptions,
): Promise<SublistDictionary> {
    SUP.push(
        NL + `[START processSublistDictionaryParseOptions()]`,
        TAB+`Object.keys(sublistOptions): ${JSON.stringify(Object.keys(sublistOptions))}`,
    );
    if (!row || !sublistOptions || isEmptyArray(Object.keys(sublistOptions))) {
        return sublists;
    }
    SUP.push(
        NL+`sublists BEFORE processSublistLineParseOptions(): ${indentedStringify(sublists)}`
    );
    for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
        const sublistLines = (isNonEmptyArray(sublists[sublistId]) 
            ? sublists[sublistId] : []
        ) as SublistLine[];
        sublists[sublistId] = await processSublistLineParseOptions(
            row, sublistId, sublistLines, lineOptionsArray as SublistLineParseOptions[]
        );
    }
    SUP.push(
        NL+`sublists AFTER processSublistLineParseOptions(): ${indentedStringify(sublists)}`,
        NL + `[END processSublistDictionaryParseOptions()]`
    );
    return sublists;
}

async function processSublistLineParseOptions(
    row: Record<string, any>,
    sublistId: string,
    sublistLines: SublistLine[],
    lineOptionsArray: SublistLineParseOptions[],
): Promise<SublistLine[]> {
    if (!row || !sublistId || !isNonEmptyArray(lineOptionsArray) 
        || !Array.isArray(sublistLines)) {
        return sublistLines;
    }
    for (const lineOptions of lineOptionsArray) {
        const newSublistLine: SublistLine = {};
        const lineIdOptions = lineOptions.lineIdOptions || {} as SublistLineIdOptions;
        if (lineIdOptions.lineIdProp) {
            newSublistLine.lineIdProp = lineIdOptions.lineIdProp;
        }
        delete lineOptions.lineIdOptions;
        for (const sublistFieldId of Object.keys(lineOptions)) {
            const valueOptions = lineOptions[sublistFieldId];
            SUP.push(NL+`[processSublistLineParseOptions()]`,
                TAB+`sublistId: '${sublistId}', sublistFieldId: '${sublistFieldId}'`,
                TAB+`sublistLines.length: ${sublistLines.length}`,
                TAB+`valueOptions.keys(): ${Object.keys(valueOptions)}`,
                // TAB+`'subrecordType' in valueOptions ? ${valueOptions && 'subrecordType' in valueOptions}`,
            );
            // if (sublistFieldId === 'addressbookaddress') {
            //     mlog.debug(`addressbookaddress - isFieldParseOptions(valueOptions) ? ${isFieldParseOptions(valueOptions)}`,
            //         // TAB+`valueOptions: ${indentedStringify(valueOptions)}`,
            //     );
            //     STOP_RUNNING(1);
            // }
            const value = (isFieldParseOptions(valueOptions)
                ? await parseFieldValue(row, 
                    sublistFieldId, valueOptions as FieldParseOptions
                ) as FieldValue
                : await generateSublistSubrecordOptions(row, sublistId, 
                    sublistFieldId, valueOptions as SubrecordParseOptions
                ) as SubrecordValue
            );
            if (value === '' || value === undefined) { continue; }
            newSublistLine[sublistFieldId] = value;
        }
        if (!(await isDuplicateSublistLine(sublistLines, newSublistLine, lineIdOptions))) {
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
async function generateSublistSubrecordOptions(
    row: Record<string, any>,
    parentSublistId: string,
    parentFieldId: string,
    subrecordOptions: SubrecordParseOptions,
): Promise<SetSublistSubrecordOptions> {
    if (!row || !parentSublistId || !parentFieldId || isNull(subrecordOptions)) {
        return {} as SetSublistSubrecordOptions;
    }
    SUP.push(
        NL + `[START generateSublistSubrecordOptions()]`, 
        TAB+`parentSublistId: '${parentSublistId}'`,
        TAB+`  parentFieldId: '${parentFieldId}'`,
    );
    const { subrecordType, fieldOptions, sublistOptions } = subrecordOptions;
    const result = {
        subrecordType, 
        sublistId: parentSublistId, 
        fieldId: parentFieldId
    } as SetSublistSubrecordOptions;
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        result.fields = await processFieldDictionaryParseOptions(row, {}, fieldOptions);
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = await processSublistDictionaryParseOptions(row, {}, sublistOptions);
    }
    SUP.push(NL + `[END generateSublistSubrecordOptions()]`,); 
    return result;
}

/**
 * @param row 
 * @param fields 
 * @param fieldId 
 * @param subrecordOptions 
 * @returns **`result`** {@link SetFieldSubrecordOptions}
 */
async function generateFieldSubrecordOptions(
    row: Record<string, any>,
    fields: FieldDictionary,
    fieldId: string,
    subrecordOptions: SubrecordParseOptions,
): Promise<SetFieldSubrecordOptions> {
    const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
    const result = (fields && fields[fieldId] 
        ? fields[fieldId] // overwrite existing subrecord options
        : { subrecordType, fieldId, fields: {}, sublists: {} } // create new subrecord options
    ) as SetFieldSubrecordOptions;
    if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
        result.fields = await processFieldDictionaryParseOptions(row, 
            result.fields as FieldDictionary, fieldOptions
        );
    }
    if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
        result.sublists = await processSublistDictionaryParseOptions(row, 
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
async function parseFieldValue(
    row: Record<string, any>,
    fieldId: string,
    valueParseOptions: FieldParseOptions,
): Promise<FieldValue> {
    SUP.push(
        NL +`[START parseFieldValue()] - fieldId: '${fieldId}'`,
    );
    if (!fieldId || typeof fieldId !== 'string' || isNull(valueParseOptions)) {
        return null;
    }
    let value: FieldValue | undefined = undefined;
    const { defaultValue, colName, evaluator, args } = valueParseOptions;
    SUP.push(
        TAB+`defaultValue: '${defaultValue}'`,
        TAB+`     colName: '${colName}'`,
        TAB+`   evlauator: '${evaluator ? evaluator.name+'()': undefined}'`,
        // TAB+` args.length:  ${args ? args.length : 0}`,
    );
    if (evaluator) {
        try {
            value = await evaluator(row, ...(args || []));
            SUP.push(NL+` -> value from evaluator(row) = '${value}'`);
        } catch (error) {
            mlog.error(`[csvParser.parseFieldValue()] Error in evaluator for field '${fieldId}':`, error);
            // Use defaultValue if available, otherwise null
            value = defaultValue !== undefined ? defaultValue : null;
            SUP.push(NL+` -> error in evaluator, using fallback value: '${value}'`);
        }
    } else if (colName) {
        if (!Object.keys(row).includes(colName)) {
            mlog.error(`[csvParser.parseFieldValue()] Invalid FieldParseOptions.colName`,
                TAB+`colName: '${colName}' is not in row's keys`,
                TAB+`Object.keys(row): ${JSON.stringify(Object.keys(row))}`
            );
            throw new Error(`[csvParser.parseFieldValue()] Invalid FieldParseOptions.colName`);
        }
        value = await transformValue(
            clean(row[colName]), 
            colName, 
            fieldId, 
            isNonEmptyArray(args) ? args[0] as ValueMapping : undefined
        );
        SUP.push(NL+` -> value from transformValue(row[colName]) = '${value}'`);
    }
    if (defaultValue !== undefined && (value === undefined || value === '')) {
        value = defaultValue;
        SUP.push(NL+` -> value from defaultValue ='${value}'`);
    }   
    SUP.push(NL+`[END parseFieldValue()] - fieldId: '${fieldId}' -> value: '${value}'`);
    return value as FieldValue;
}

/**
 * @param originalValue - The original value to be transformed with valueMapping or default operaitons
 * @param originalKey  - The original column header (key) of the value being transformed
 * @param newKey - The new column header (`fieldId`) (key) of the value being transformed
 * @param valueMapping {@link ValueMapping} (i.e. `valueOverrides`) - An optional mapping object
 * @returns **`transformedValue`** {@link FieldValue}
 */
export async function transformValue(
    originalValue: string, 
    originalKey: string,
    newKey: string,
    valueMapping?: ValueMapping
): Promise<FieldValue> {
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
        
        if (DATE_STRING_PATTERN.test(trimmedValue)) {
            return new Date(trimmedValue);
        } // @example "11/15/2024" becomes "2024-11-15T08:00:00.000Z"
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
export async function isDuplicateSublistLine(
    existingLines: SublistLine[],
    newLine: SublistLine,
    lineIdOptions?: SublistLineIdOptions
): Promise<boolean> {
    if (!isNonEmptyArray(existingLines)) { // existingLines isEmptyArray === true, or it's undefined
        return false;
    }
    SUP.push(
        NL + `[START isDuplicateSublistLine()] - checking for duplicate sublist line.`,
    );
    const { lineIdProp, lineIdEvaluator, args } = lineIdOptions || {};
    const isDuplicateSublistLine = existingLines.some((existingLine, sublistLineIndex) => {
        if (lineIdEvaluator && typeof lineIdEvaluator === 'function') {
            const existingLineId = lineIdEvaluator(existingLine, ...(args || []));
            const newLineId = lineIdEvaluator(newLine, ...(args || []));
            return equivalentAlphanumeric(existingLineId, newLineId);
        }
        const canCompareUsingLineIdProp = Boolean(lineIdProp
            && existingLine.lineIdProp === lineIdProp
            && Boolean(newLine[lineIdProp])
            && typeof newLine[lineIdProp] === 'string' 
            && typeof existingLine[lineIdProp] === 'string'
        );
        if (lineIdProp && canCompareUsingLineIdProp) {
            SUP.push(NL + `canCompareUsingLineIdProp === true`,
                TAB + ` existingLine.lineIdProp: '${existingLine.lineIdProp}'`,
                TAB + `        param lineIdProp: '${lineIdProp}'`,
                TAB + `existingLine['${lineIdProp}']: '${existingLine[lineIdProp]}'`,
                TAB + `     newLine['${lineIdProp}']: '${newLine[lineIdProp]}'`,
            );
            return equivalentAlphanumeric(
                existingLine[lineIdProp] as string, newLine[lineIdProp] as string
            );
        } 
        return Object.keys(newLine).every(fieldId => {
            const valA = existingLine[fieldId];
            const valB = newLine[fieldId];
            let areFieldsEqual = (isFieldValue(valA) && isFieldValue(valB)
                ? equivalentAlphanumeric(String(valA), String(valB))
                : areEquivalentObjects(valA as SubrecordValue, valB as SubrecordValue)
            );
            SUP.push(
                TAB + `sublistLineIndex: ${sublistLineIndex}, fieldId: '${fieldId}',`,
                TAB + `valA: '${valA}'`,
                TAB + `valB: '${valB}'`,
                TAB + `areFieldsEqual: ${areFieldsEqual}`,
            );
            return areFieldsEqual;
        });
    });
    SUP.push(
        NL + `[END isDuplicateSublistLine()] -> returning ${isDuplicateSublistLine}`,
    );
    return isDuplicateSublistLine;
}


