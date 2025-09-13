/**
 * @file src/services/parse/csvParser.ts
 */
import { 
    mainLogger as mlog,
    simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
} from "../../config";
import {
    isNonEmptyArray, isEmptyArray, isEmpty,
    areEquivalentObjects,
    isIntegerArray,
    hasKeys,
    isNonEmptyString
} from "typeshi:utils/typeValidation";
import { isRowSourceMetaData, RowSourceMetaData, 
    handleFileArgument, indentedStringify, 
    isFileData, FileData, 
    getSourceString
} from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import { 
    ValueMapping,
    FieldDictionaryParseOptions,
    FieldParseOptions,
    SublistDictionaryParseOptions,
    SubrecordParseOptions,
    ParseDictionary,
    ParseResults,
    IntermediateParseResults,
    SublistLineParseOptions,
    isFieldParseOptions,
    isValueMappingEntry,
    SublistLineIdOptions
} from "./types/index";
import {
    clean, equivalentAlphanumericStrings, DATE_STRING_PATTERN
} from "typeshi:utils/regex";
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    RecordOptions, isFieldValue, isSubrecordValue,
    SourceTypeEnum
} from "../../api";
import { RecordTypeEnum } from "../../utils/ns/Enums";
import { BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES, isBooleanFieldId } from "../../utils/ns/utils";
/** tells endpoint to load record in standard mode */
const NOT_DYNAMIC = false;
let rowIndex: number = 0;

/**
 * @param recordSource `string | Record<string, any>[]` 
 * - does {@link handleFileArgument}`(recordSource)` -> rows: `Record<string, any>[]`, 
 * then operates on rows 
 * @param parseDictionary {@link ParseDictionary}
 * @returns **`results`** `Promise<`{@link ParseResults}`>` 
 * = `{ [recordType: string]:` {@link RecordOptions}`[] }`
 */
export async function parseRecordCsv(
    recordSource: string | FileData | Record<string, any>[],
    parseDictionary: ParseDictionary,
    sourceType?: SourceTypeEnum
): Promise<ParseResults> {
    const source = getSourceString(__filename, parseRecordCsv.name);
    if (isEmpty(recordSource)) {
        throw new Error([
            `${source} Invalid Argument: 'recordSource'`,
            `Expected recordSource: string | FileData | Record<string, any>[]`,
            `Received recordSource: ${typeof recordSource}`,
        ].join(TAB));
    }
    validate.objectArgument(source, {parseDictionary});
    mlog.info([`${source} START`,
        `recordSource: ${getRecordSourceLabel(recordSource)}`,
        ` recordTypes: ${Object.keys(parseDictionary).join(', ')}`,
    ].join(TAB));           
    const rows = await handleFileArgument(recordSource, source);
    const results: ParseResults = {};
    const intermediate: IntermediateParseResults = {};
    for (const recordType of Object.keys(parseDictionary)) {
        results[recordType] = [];
        intermediate[recordType] = {};
    }
    rowIndex = 0;
    for (const row of rows) {
        for (const recordType of Object.keys(parseDictionary)) {
            const { 
                keyColumn, fieldOptions, sublistOptions 
            } = parseDictionary[recordType];
            const recordId = clean(row[keyColumn]);
            if (!recordId) {
                mlog.warn([`${source} key column value is empty `,
                    `@ row ${rowIndex} for recordType '${recordType}'`,
                    `skipping row...`
                ].join(NL));
                continue;
            }
            /** 
             * `if row` pertains to an existing record in `IntermediateParseResults` 
             * (e.g. recordType=salesorder and have already processed one of its rows) 
             * */
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
        ` recordSource:  ${getRecordSourceLabel(recordSource)}`,
        `  recordTypes:  ${JSON.stringify(Object.keys(parseDictionary))}`,
        `Last rowIndex:  ${rowIndex}`,
        `Parse Summary:  ${indentedStringify(parseSummary)}`
    ].join(TAB));
    return results;
}

function getRecordSourceLabel(recordSource: string | FileData | Record<string, any>[]): string {
    return (typeof recordSource === 'string' 
        ? `(filePath) '${recordSource}'` 
        : isFileData(recordSource) 
        ? recordSource.fileName 
        : `(rowArray).length ${recordSource.length}`
    );
}

async function updateRecordMeta(
    record: RecordOptions, 
    rowIndex: number,
    recordSource: string | FileData | Record<string, any>[],
    sourceType?: SourceTypeEnum
): Promise<void> {
    const source = getSourceString(__filename, updateRecordMeta.name);
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
    } else if (isFileData(recordSource)) {
        if (!record.meta || !isIntegerArray(record.meta.dataSource)) {
            record.meta = {
                dataSource: [rowIndex],
                sourceType: sourceType ? sourceType : SourceTypeEnum.ENCODED_FILE_CONTENT_STRING
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
            `Expected recordSource: string | FileData | Record<string, any>[]`,
            `Received recordSource: ${typeof recordSource}`,
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
    if (fieldOptions && !isEmpty(fieldOptions)) {
        record.fields = await processFieldDictionaryParseOptions(
            row, record.fields ?? {}, fieldOptions
        );
    }
    if (sublistOptions && !isEmpty(sublistOptions)) {
        record.sublists = await processSublistDictionaryParseOptions(
            row, record.sublists ?? {}, sublistOptions
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
    if (!row || !fields || isEmpty(fieldOptions)) {
        return fields;
    }
    for (const fieldId of Object.keys(fieldOptions)) {
        if (!isNonEmptyString(fieldId)) { continue; }
        if (fieldId in fields && !isEmpty(fields[fieldId])) {
            continue;
        }
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
    if (!row || isEmpty(sublistOptions)) {
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
            newSublistLine.idFields = lineIdOptions.lineIdProp;
        }
        delete lineOptions.lineIdOptions;
        for (const sublistFieldId of Object.keys(lineOptions)) {
            const valueOptions = lineOptions[sublistFieldId];
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
    const source = getSourceString(__filename, generateSublistSubrecordOptions.name);
    validate.multipleStringArguments(source, { parentSublistId, parentFieldId });
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
    validate.stringArgument(source, {fieldId});
    validate.objectArgument(source,  {valueParseOptions, isFieldParseOptions});
    let value: FieldValue | undefined = undefined;
    const { defaultValue, colName, evaluator, args } = valueParseOptions;
    if (typeof evaluator === 'function') {
        try {
            value = await evaluator(row, ...(args || []));
        } catch (error) {
            mlog.error(`${source} Error in evaluator for field '${fieldId}':`, error);
            value = defaultValue !== undefined ? defaultValue : null;
        }
    } else if (colName && hasKeys(row, colName)) {
        value = await transformValue(clean(row[colName]), colName, fieldId, 
            isNonEmptyArray(args) ? args[0] as ValueMapping : undefined
        );
    }
    if (defaultValue !== undefined && (value === undefined || value === '')) {
        value = defaultValue;
    }   
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
    const { lineIdProp, lineIdEvaluator, args } = lineIdOptions || {};
    const isDuplicate = existingLines.some((existingLine, sublistLineIndex) => {
        if (lineIdEvaluator && typeof lineIdEvaluator === 'function') {
            const existingLineId = lineIdEvaluator(existingLine, ...(args || []));
            const newLineId = lineIdEvaluator(newLine, ...(args || []));
            return equivalentAlphanumericStrings(existingLineId, newLineId);
        }
        const canCompareUsingLineIdProp = Boolean(lineIdProp
            && existingLine.idFields === lineIdProp
            && Boolean(newLine[lineIdProp])
            && typeof newLine[lineIdProp] === 'string' 
            && typeof existingLine[lineIdProp] === 'string'
        );
        if (lineIdProp && canCompareUsingLineIdProp) {
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
            return areFieldsEqual;
        });
    });
    return isDuplicate;
}


