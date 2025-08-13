/**
 * @file src/csvParser.ts
 */
import { 
    mainLogger as mlog, 
    parseLogger as plog,
    simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
    STOP_RUNNING
} from "./config";
import {
    isNonEmptyArray, isEmptyArray, isNullLike as isNull,
    areEquivalentObjects,
    isIntegerArray,
    hasKeys
} from "./utils/typeValidation";
import { isRowSourceMetaData, RowSourceMetaData } from "./utils/io";
import * as validate from "./utils/argumentValidation";
import { 
    ValueMapping,
    FieldDictionaryParseOptions,
    FieldParseOptions,
    SublistDictionaryParseOptions,
    SubrecordParseOptions,
    ParseOptions,
    ParseResults,
    IntermediateParseResults,
    SublistLineParseOptions,
    isFieldParseOptions,
    isValueMappingEntry,
    SublistLineIdOptions, indentedStringify, handleFileArgument
} from "./utils/io";
import {
    clean, equivalentAlphanumericStrings, DATE_STRING_PATTERN
} from "./utils/regex";
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    RecordOptions, isFieldValue, isSubrecordValue,
    SourceTypeEnum
} from "./api";
import { RecordTypeEnum } from "./utils/ns/Enums";
import { BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES, isBooleanFieldId } from "./utils/ns/utils";
/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;
let rowIndex: number = 0;

/**
 * @param recordSource `string | Record<string, any>[]` {@link handleFileArgument}
 * @param parseOptions {@link ParseOptions}
 * @returns **`results`** `Promise<`{@link ParseResults}`>` 
 * = `{ [recordType: string]:` {@link RecordOptions}`[] }`
 */
export async function parseRecordCsv(
    recordSource: string | Record<string, any>[],
    parseOptions: ParseOptions,
    sourceType?: SourceTypeEnum
): Promise<ParseResults> {
    const source = `[csvParser.parseRecordCsv()]`;
    if (isNull(recordSource)) {
        throw new Error([
            `${source} Invalid argument: 'recordSource'`,
            `Expected 'recordSource' to be: filePath (string) | rowArray (Record<string, any>[])`,
            `Received: ${typeof recordSource} = ${recordSource}`
        ].join(TAB));
    }
    validate.objectArgument(source, {parseOptions});
    mlog.info([`${source} START`,
        ` recordTypes: ${JSON.stringify(Object.keys(parseOptions))}`,
        `recordSource: ` + (typeof recordSource === 'string' 
        ? `(filePath) '${recordSource}'` : `(rowArray).length ${recordSource.length}`),
    ].join(TAB));           
    const rows = await handleFileArgument(recordSource, 'csvParser.parseRecordCsv');
    const results: ParseResults = {};
    const intermediate: IntermediateParseResults = {};
    for (const recordType of Object.keys(parseOptions)) {
        results[recordType] = [];
        intermediate[recordType] = {};
    }
    rowIndex = 0;
    for (const row of rows) {
        plog.debug(`[START ROW] rowIndex: ${rowIndex}:`,);
        for (const recordType of Object.keys(parseOptions)) {
            const { 
                keyColumn, fieldOptions, sublistOptions 
            } = parseOptions[recordType];
            const recordId = clean(row[keyColumn]);
            /** 
             * `if row` pertains to an existing record in `IntermediateParseResults` 
             * (e.g. recordType=salesorder and have already processed one of its rows) 
             * */
            plog.debug(
                `recordType: '${recordType}', keyColumn: '${keyColumn}', `,
                `recordId: '${recordId}' `,
                `-> isExistingRecord ? ${recordId in intermediate[recordType]}`,
            );
            let record = (intermediate[recordType][recordId]  
                ? intermediate[recordType][recordId] 
                : {
                    recordType: recordType as RecordTypeEnum,
                    isDynamic: NOT_DYNAMIC,
                    fields: {} as FieldDictionary,
                    sublists: {} as SublistDictionary,
                }
            ) as RecordOptions;
            await updateRecordMeta(record, rowIndex, recordSource, sourceType);
            intermediate[recordType][recordId] = await processRow(row,
                record, 
                fieldOptions as FieldDictionaryParseOptions, 
                sublistOptions as SublistDictionaryParseOptions
            );
        }
        rowIndex++;
    }
    
    for (const recordType of Object.keys(intermediate)) {
        results[recordType] = Object.values(intermediate[recordType]) as RecordOptions[];
    }
    const parseSummary = Object.keys(results).reduce((acc, recordType) => {
        acc[recordType] = results[recordType].length;
        return acc;
    }, {} as Record<string, number>);
    slog.info([`${source} END`,
        ` recordSource: ` + (typeof recordSource === 'string' 
        ? `(filePath) '${recordSource}'` : `(rowArray).length ${recordSource.length}`),
        `  recordTypes:  ${JSON.stringify(Object.keys(parseOptions))}`,
        `Last rowIndex:  ${rowIndex}`,
        `Parse Summary:  ${indentedStringify(parseSummary)}`
    ].join(TAB));
    return results;
}

async function updateRecordMeta(
    record: RecordOptions, 
    rowIndex: number,
    recordSource: string | Record<string, any>[],
    sourceType?: SourceTypeEnum
): Promise<void> {
    const source = `[csvParser.updateRecordMeta()]`;
    if (typeof recordSource === 'string') {
        if (!record.meta || !isRowSourceMetaData(record.meta.dataSource)) {
            record.meta = {
                dataSource: { [recordSource]: [rowIndex] } as RowSourceMetaData,
                sourceType: SourceTypeEnum.LOCAL_FILE
            };
        } else if (!record.meta.dataSource[recordSource].includes(rowIndex)) {
            record.meta.dataSource[recordSource].push(rowIndex);
        } else {
            throw new Error([
                `${source} Invalid RecordOptions.meta.dataSource`,
            ].join(TAB));
        }
    } else if (isNonEmptyArray(recordSource)) { // source is array of rows
        if (!record.meta || !isIntegerArray(record.meta.dataSource)) {
            record.meta = {
                dataSource: [rowIndex],
                sourceType: sourceType ? sourceType : SourceTypeEnum.ROW_SUBSET_ARRAY
            };
        } else if (!record.meta.dataSource.includes(rowIndex)) {
            record.meta.dataSource.push(rowIndex);
        } else {
            throw new Error([`${source} Invalid RecordOptions.meta.dataSource`,
            ].join(TAB));
        }
    } else {
        throw new Error([
            `${source} Invalid type for param 'recordSource'`,
            `I didn't think we would ever end up here...`
        ].join(TAB));
    }
}
/**
 * - for fields, if want to allow override for fields and if files parsed in chrono order (ascending), 
 * then most recent value will be assigned to field. 
 * - for sublists, make a new {@link SublistLine} if all key-value pairs not equal?
 * @param row `Record<string, any>` - the current row
 * @param record {@link RecordOptions}
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @param sublistOptions {@link SublistDictionaryParseOptions}
 * @returns **`record`** — {@link RecordOptions}
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
    if (fieldOptions && !isNull(fieldOptions)) {
        record.fields = await processFieldDictionaryParseOptions(
            row, record.fields as FieldDictionary, fieldOptions
        );
    }
    if (sublistOptions && !isNull(sublistOptions)) {
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
    if (!row || !fields || isNull(fieldOptions)) {
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
    if (!row || isNull(sublistOptions)) {
        return sublists;
    }
    for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
        const sublistLines = (isNonEmptyArray(sublists[sublistId]) 
            ? sublists[sublistId] : []
        ) as SublistLine[];
        sublists[sublistId] = await processSublistLineParseOptions(
            row, sublistId, sublistLines, lineOptionsArray as SublistLineParseOptions[]
        );
    }
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
    const source = `[csvParser.processSublistLineParseOptions()]`
    try {
        validate.stringArgument(source, {sublistId});
        validate.objectArgument(source, {row});
        validate.arrayArgument(source, {lineOptionsArray});
    } catch (error) {
        mlog.error(`${source} caught arg validation error`,
            `gonna throw it for now`, error
        );
        throw error;
        // return sublistLines;
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
            plog.debug([`${source}`,
                `sublistId: '${sublistId}', sublistFieldId: '${sublistFieldId}'`,
                `sublistLines.length: ${sublistLines.length}`,
                `valueOptions.keys(): ${Object.keys(valueOptions)}`,
            ].join(TAB));
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
    const source = `[csvParser.generateSublistSubrecordOptions()]`
    validate.multipleStringArguments(source, 
        { parentSublistId, parentFieldId }
    );
    validate.objectArgument(source, {row});
    validate.objectArgument(source, 
        {subrecordOptions, SubrecordParseOptions: isSubrecordValue}
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
    const source = `[csvParser.parseFieldValue()]`
    validate.stringArgument(source, `fieldId`, fieldId);
    validate.objectArgument(source,  {valueParseOptions, isFieldParseOptions});
    let value: FieldValue | undefined = undefined;
    const { defaultValue, colName, evaluator, args } = valueParseOptions;
    plog.debug([`${source} unpacking FieldParseOptions`,
        `defaultValue: '${defaultValue}'`,
        `     colName: '${colName}'`,
        `   evlauator: '${evaluator ? evaluator.name+'()': undefined}'`,
        ` args.length:  ${args ? args.length : 0}`,
    ].join(TAB));
    if (typeof evaluator === 'function') {
        try {
            value = await evaluator(row, ...(args || []));
            plog.debug(` -> value from evaluator(row) = '${value}'`);
        } catch (error) {
            mlog.error(`${source} Error in evaluator for field '${fieldId}':`, error);
            value = defaultValue !== undefined ? defaultValue : null;
            plog.debug(` -> error in evaluator, using fallback value: '${value}'`);
        }
    } else if (colName) {
        if (!hasKeys(row, colName)) {
            mlog.error([`${source} Invalid FieldParseOptions.colName`,
                `colName: '${colName}' is not in row's keys`,
                `Object.keys(row): ${JSON.stringify(Object.keys(row))}`,
                `rowIndex: ${rowIndex}`
            ].join(TAB));
            throw new Error(`${source} Invalid FieldParseOptions.colName`);
        }
        value = await transformValue(clean(row[colName]), colName, fieldId, 
            isNonEmptyArray(args) ? args[0] as ValueMapping : undefined
        );
        plog.debug(` -> value from transformValue(row[colName]) = '${value}'`);
    }
    if (defaultValue !== undefined && (value === undefined || value === '')) {
        value = defaultValue;
        plog.debug(` -> value from defaultValue ='${value}'`);
    }   
    plog.debug(`${source} END - fieldId: '${fieldId}' -> value: '${value}'`);
    return value as FieldValue;
}

/**
 * @consideration could add a param called transformers (or something similar) 
 * that is a list of functions to apply to trimmedValue that returns a FieldValue (the transformed value to return)
 * if the transformation is applicable (i.e. can parse as a date string or a number), 
 * otherwise returns `undefined`.
 * if all transformations not applicable (all return undefined), just return `trimmedValue`
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
            const validColumns = (Array.isArray(mappedValue.validColumns) 
                ? mappedValue.validColumns 
                : [mappedValue.validColumns]
            );    
            if (validColumns.includes(originalKey)) {
                return mappedValue.newValue;
            }
        } else { // !isValueMappingEntry -> Simple mapping (applies to all columns)
            return mappedValue;
        }
    }
    try {
        if (BOOLEAN_TRUE_VALUES.includes(trimmedValue.toLowerCase()) 
            && isBooleanFieldId(newKey)) {
            return true
        } else if (BOOLEAN_FALSE_VALUES.includes(trimmedValue.toLowerCase()) 
            && isBooleanFieldId(newKey)) {
            return false
        };
        // @example "11/15/2024" becomes "2024-11-15T08:00:00.000Z"
        if (DATE_STRING_PATTERN.test(trimmedValue)) {
            return new Date(trimmedValue);
        } 
        
        // Check if trimmedValue matches a number pattern (integer or float, with optional commas)
        // Pattern: matches numbers like "1,234", "1234", "1,234.56", "1234.56"
        // temp assumption: strings with leading zeros are zip codes and should not be converted to number
        // const NUMBER_PATTERN = /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(\.\d+)?$/;
        // if (!trimmedValue.startsWith('0') 
        //     && NUMBER_PATTERN.test(trimmedValue.replace(/(\s|\$)/g, ''))) {
        //     // Remove commas before converting to number
        //     const numericValue = Number(trimmedValue.replace(/(,|\$)/g, ''));
        //     if (!isNaN(numericValue)) {
        //         return numericValue;
        //     }
        // }
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
    if (!isNonEmptyArray(existingLines)) { return false }
    plog.debug(NL + `[START isDuplicateSublistLine()]`,);
    const { lineIdProp, lineIdEvaluator, args } = lineIdOptions || {};
    const isDuplicate = existingLines.some((existingLine, sublistLineIndex) => {
        if (lineIdEvaluator && typeof lineIdEvaluator === 'function') {
            const existingLineId = lineIdEvaluator(existingLine, ...(args || []));
            const newLineId = lineIdEvaluator(newLine, ...(args || []));
            return equivalentAlphanumericStrings(existingLineId, newLineId);
        }
        const canCompareUsingLineIdProp = Boolean(lineIdProp
            && existingLine.lineIdProp === lineIdProp
            && Boolean(newLine[lineIdProp])
            && typeof newLine[lineIdProp] === 'string' 
            && typeof existingLine[lineIdProp] === 'string'
        );
        if (lineIdProp && canCompareUsingLineIdProp) {
            plog.debug([`canCompareUsingLineIdProp === true`,
                ` existingLine.lineIdProp: '${existingLine.lineIdProp}'`,
                `        param lineIdProp: '${lineIdProp}'`,
                `existingLine['${lineIdProp}']: '${existingLine[lineIdProp]}'`,
                `     newLine['${lineIdProp}']: '${newLine[lineIdProp]}'`,
            ].join(TAB));
            return equivalentAlphanumericStrings(
                existingLine[lineIdProp] as string, newLine[lineIdProp] as string
            );
        } 
        return Object.keys(newLine).every(fieldId => {
            const valA = existingLine[fieldId];
            const valB = newLine[fieldId];
            let areFieldsEqual = (isFieldValue(valA) && isFieldValue(valB)
                ? equivalentAlphanumericStrings(String(valA), String(valB))
                : areEquivalentObjects(valA as SubrecordValue, valB as SubrecordValue)
            );
            plog.debug([
                `sublistLineIndex: ${sublistLineIndex}, fieldId: '${fieldId}'`,
                `valA: '${valA}'`,
                `valB: '${valB}'`,
                `areFieldsEqual: ${areFieldsEqual}`,
            ].join(TAB));
            return areFieldsEqual;
        });
    });
    plog.debug(`[END isDuplicateSublistLine()] -> returning ${isDuplicate}`,);
    return isDuplicate;
}


