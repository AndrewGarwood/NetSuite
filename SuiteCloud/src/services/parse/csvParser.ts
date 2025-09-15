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
    isNonEmptyString,
    isInteger
} from "typeshi:utils/typeValidation";
import { 
    handleFileArgument, indentedStringify, 
    isFileData, FileData, 
    getSourceString,
    isFile
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
    SublistLineIdOptions,
    SourceTypeEnum, RecordParseMeta,
    RecordParseOptions
} from "./types/index";
import {
    clean, equivalentAlphanumericStrings, DATE_STRING_PATTERN
} from "typeshi:utils/regex";
import { 
    FieldValue, FieldDictionary, SublistDictionary, SublistLine, 
    SubrecordValue, SetFieldSubrecordOptions, SetSublistSubrecordOptions, 
    RecordOptions, isFieldValue, isSubrecordValue,
} from "../../api";
import { RecordTypeEnum } from "../../utils/ns/Enums";
import { BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES, isBooleanFieldId } from "../../utils/ns/utils";


let currentRowIndex: number | null;
let currentRecord: Required<RecordOptions> | null = null;
function getCurrentRecord(): Required<RecordOptions> {
    if (!currentRecord) {
        throw new Error(`${getSourceString(__filename, getCurrentRecord.name)} currentRecord is undefined (haven't started parsing yet)`)
    }
    return currentRecord;
}

function getCurrentRowIndex(): number {
    if (!isInteger(currentRowIndex)) {
        throw new Error(`${getSourceString(__filename, getCurrentRowIndex.name)} rowIndex is undefined (haven't started parsing yet)`)
    }
    return currentRowIndex;
}
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
): Promise<{
    parseResults: ParseResults; 
    meta: { [recordType: string]: RecordParseMeta }
}> {
    const source = getSourceString(__filename, parseRecordCsv.name);
    if (isEmpty(recordSource)) {
        throw new Error([
            `${source} Invalid Argument: 'recordSource'`,
            `Expected recordSource: string | FileData | Record<string, any>[]`,
            `Received recordSource: ${typeof recordSource}`,
        ].join(TAB));
    }
    mlog.info([`${source} START`,
        `recordSource: ${getRecordSourceLabel(recordSource)}`,
        ` recordTypes: ${Object.keys(parseDictionary).join(', ')}`,
    ].join(TAB));     
    const meta: { [recordType: string]: RecordParseMeta } = {};      
    const rows = await handleFileArgument(recordSource, source);
    const results: ParseResults = {};
    const intermediate: IntermediateParseResults = {};
    for (const recordType in parseDictionary) {
        results[recordType] = [];
        intermediate[recordType] = {};
        meta[recordType] = {
            sourceType: sourceType ?? SourceTypeEnum.UNKNOWN,
            sourceLabel: getRecordSourceLabel(recordSource),
            recordRows: {},
            parseOptions: parseDictionary[recordType]
        } as RecordParseMeta;
        if (isNonEmptyString(recordSource) && isFile(recordSource)) {
            meta[recordType].file = recordSource;
        } else if (isFileData(recordSource)) {
            meta[recordType].file = recordSource.fileName;
        }
    }
    rowLoop:
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        currentRowIndex = i;
        recordTypeLoop:
        for (const recordType in parseDictionary) {
            const { 
                keyColumn, fieldOptions, sublistOptions 
            } = parseDictionary[recordType] as RecordParseOptions;
            const recordId = clean(row[keyColumn]);
            if (isEmpty(recordId)) {
                mlog.warn([`${source} encountered row with invalid/empty recordId`,
                    `@ row ${currentRowIndex} for recordType '${recordType}', keyColumn: '${keyColumn}'`,
                    ...(keyColumn in row ? [
                        `       row[keyColumn]: '${row[keyColumn]}'`,
                        `clean(row[keyColumn]): '${clean(row[keyColumn])}'`,
                    ] : [`keyColumn in row === false`]),
                    `skipping row...`
                ].join(NL));
                continue recordTypeLoop;
            }
            /** 
             * `if row` pertains to an existing record in `IntermediateParseResults` 
             * (e.g. recordType=salesorder and have already processed one of its rows) 
             * */
            currentRecord = (intermediate[recordType][recordId] 
                ?? {
                    recordType: recordType as RecordTypeEnum,
                    idOptions: [],
                    fields: {},
                    sublists: {},
                }
            ) as Required<RecordOptions>;
            currentRecord = await processRow(
                row,
                fieldOptions ?? {}, 
                sublistOptions ?? {}
            );
            meta[recordType] = updateRecordMeta(recordId, meta[recordType]);
            intermediate[recordType][recordId] = currentRecord;
        }
    }
    
    for (const recordType in intermediate) {
        results[recordType] = Object.values(intermediate[recordType]);
    }
    const parseSummary = Object.keys(results).reduce((acc, recordType) => {
        acc[recordType] = results[recordType].length;
        return acc;
    }, {} as Record<string, number>);
    slog.info([`${source} (END)`,
        ` recordSource:  ${getRecordSourceLabel(recordSource)}`,
        `  recordTypes:  ${Object.keys(parseDictionary).join(', ')}`,
        `Last rowIndex:  ${getCurrentRowIndex()}`,
        `Parse Summary:  ${indentedStringify(parseSummary)}`
    ].join(TAB));
    return {
        parseResults: results,
        meta: meta
    };
}

function getRecordSourceLabel(recordSource: string | FileData | Record<string, any>[]): string {
    return (typeof recordSource === 'string' 
        ? `(filePath) '${recordSource}'` 
        : isFileData(recordSource) 
        ? recordSource.fileName 
        : `Array<Row>( ${recordSource.length} )`
    );
}

function updateRecordMeta(recordId: string, recordMeta: RecordParseMeta): RecordParseMeta {
    let rowIndex = getCurrentRowIndex();
    if (!(recordId in recordMeta.recordRows)) {
        recordMeta.recordRows[recordId] = [];
    }
    if (!recordMeta.recordRows[recordId].includes(rowIndex)) {
        recordMeta.recordRows[recordId].push(rowIndex)
    }
    return recordMeta;
}

/**
 * - for fields, if want to allow override for fields and if files parsed in chrono order (ascending), 
 * then most recent value will be assigned to field. 
 * - for sublists, make a new {@link SublistLine} if all key-value pairs not equal?
 * @param row `Record<string, any>` - the current row
 * @param fieldOptions {@link FieldDictionaryParseOptions}
 * @param sublistOptions {@link SublistDictionaryParseOptions}
 * @returns **`record`** — {@link RecordOptions}
 */
async function processRow(
    row: Record<string, any>,
    fieldOptions: FieldDictionaryParseOptions,
    sublistOptions: SublistDictionaryParseOptions,
): Promise<Required<RecordOptions>> {
    let record = getCurrentRecord();
    if (!isEmpty(fieldOptions)) {
        record.fields = await processFieldDictionaryParseOptions(
            row, record.fields, fieldOptions
        );
    }
    if (!isEmpty(sublistOptions)) {
        record.sublists = await processSublistDictionaryParseOptions(
            row, record.sublists, sublistOptions
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
    if (!fields || isEmpty(fieldOptions)) {
        return fields;
    }
    for (const fieldId in fieldOptions) {
        if (!isNonEmptyString(fieldId)) { continue }
        if (fieldId in fields) {
            continue;
        }
        const value = (isFieldParseOptions(fieldOptions[fieldId])
            ? await parseFieldValue(row, 
                fieldId, fieldOptions[fieldId] as FieldParseOptions
            ) as FieldValue
            : await generateFieldSubrecordOptions(row, fields, 
                fieldId, fieldOptions[fieldId] as SubrecordParseOptions
            ) as SubrecordValue
        );
        if (value === '' || value === undefined) { continue }
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
    if (isEmpty(sublistOptions)) {
        return sublists;
    }
    for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
        const sublistLines = (sublists[sublistId] ?? []) as SublistLine[];
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
    if (!sublistId || !isNonEmptyArray(lineOptionsArray) || !Array.isArray(sublistLines)) {
        return sublistLines;
    }
    for (const lineOptions of lineOptionsArray) {
        const newSublistLine: SublistLine = {};
        const lineIdOptions = lineOptions.lineIdOptions || {} as SublistLineIdOptions;
        if (lineIdOptions.lineIdProp) {
            newSublistLine.idFields = lineIdOptions.lineIdProp;
        }
        delete lineOptions.lineIdOptions;
        for (const sublistFieldId in lineOptions) {
            const valueOptions = lineOptions[sublistFieldId];
            const value = (isFieldParseOptions(valueOptions)
                ? await parseFieldValue(row, 
                    sublistFieldId, valueOptions as FieldParseOptions
                ) as FieldValue
                : await generateSublistSubrecordOptions(row, sublistId, 
                    sublistFieldId, valueOptions as SubrecordParseOptions
                ) as SubrecordValue
            );
            if (value === '' || value === undefined) { continue }
            newSublistLine[sublistFieldId] = value;
        }
        if (!isDuplicateSublistLine(sublistLines, newSublistLine, lineIdOptions)) {
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
 * @returns **`sublistSubrecord`** {@link SetSublistSubrecordOptions}
 */
async function generateSublistSubrecordOptions(
    row: Record<string, any>,
    parentSublistId: string,
    parentFieldId: string,
    subrecordOptions: SubrecordParseOptions,
): Promise<Required<SetSublistSubrecordOptions>> {
    const { subrecordType, fieldOptions, sublistOptions } = subrecordOptions;
    const sublistSubrecord = {
        subrecordType, 
        sublistId: parentSublistId, 
        fieldId: parentFieldId,
        fields: {},
        sublists: {}
    } as Required<SetSublistSubrecordOptions>;
    if (!isEmpty(fieldOptions)) {
        sublistSubrecord.fields = await processFieldDictionaryParseOptions(row, sublistSubrecord.fields, fieldOptions);
    }
    if (!isEmpty(sublistOptions)) {
        sublistSubrecord.sublists = await processSublistDictionaryParseOptions(row, sublistSubrecord.sublists, sublistOptions);
    }
    return sublistSubrecord;
}

/**
 * @param row 
 * @param fields 
 * @param fieldId 
 * @param subrecordOptions 
 * @returns **`fieldSubrecord`** {@link SetFieldSubrecordOptions}
 */
async function generateFieldSubrecordOptions(
    row: Record<string, any>,
    fields: FieldDictionary,
    fieldId: string,
    subrecordOptions: SubrecordParseOptions,
): Promise<Required<SetFieldSubrecordOptions>> {
    const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
    const fieldSubrecord = (fields[fieldId] 
        ? fields[fieldId] // overwrite existing subrecord options
        : { subrecordType, fieldId, fields: {}, sublists: {} } // create new subrecord options
    ) as Required<SetFieldSubrecordOptions>;
    if (!isEmpty(fieldOptions)) {
        fieldSubrecord.fields = await processFieldDictionaryParseOptions(row, 
            fieldSubrecord.fields, fieldOptions
        );
    }
    if (!isEmpty(sublistOptions)) {
        fieldSubrecord.sublists = await processSublistDictionaryParseOptions(row, 
            fieldSubrecord.sublists, sublistOptions
        );
    }
    return fieldSubrecord;
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
    const source = getSourceString(__filename, parseFieldValue.name, fieldId)
    let value: FieldValue | undefined = undefined;
    const { defaultValue, colName, evaluator, args } = valueParseOptions;
    if (typeof evaluator === 'function') {
        try {
            value = await evaluator(getCurrentRecord().fields, row, ...(args || []));
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
        mlog.error(`ERROR transformValue(): at row ${currentRowIndex} could not parse value: ${trimmedValue}`);
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
    lineIdOptions?: SublistLineIdOptions
): boolean {
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


