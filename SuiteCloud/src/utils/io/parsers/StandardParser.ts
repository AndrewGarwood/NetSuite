/**
 * @file src/utils/io/parsers/StandardParser.ts
 * @description Standard row-by-row CSV parsing strategy
 */

import csv from 'csv-parser';
import fs from 'fs';
import { 
    ParseStrategy, ParseManagerContext, ParseStrategyEnum 
} from "./types/ParseStrategy";
import { FieldDependencyResolver } from "./FieldDependencyResolver";
import { 
    ParseResults, IntermediateParseResults, FieldDictionaryParseOptions,
    SublistDictionaryParseOptions, EvaluationContext, RowContext,
    FieldParseOptions, SubrecordParseOptions, RecordParseOptions, ParseOptions,
} from "../types";
import { 
    FieldDictionary, SublistDictionary, SublistLine, RecordOptions,
    RecordTypeEnum, FieldValue, SubrecordValue,
    SetFieldSubrecordOptions,
    SetSublistSubrecordOptions,
    isFieldValue
} from "../../api";
import {
    isNonEmptyArray, anyNull,
    isFieldParseOptions, isValueMappingEntry,
    isNullLike as isNull,
    BOOLEAN_TRUE_VALUES,
    BOOLEAN_FALSE_VALUES,
    isBooleanFieldId,
    areEquivalentObjects
} from "../../typeValidation";
import { 
    getDelimiterFromFilePath, 
    isValidCsv, ValueMapping,
    SublistLineIdOptions, 
    SublistLineParseOptions 
} from "../";
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
    indentedStringify
} from "../../../config";
import { 
    clean, 
    equivalentAlphanumericStrings as equivalentAlphanumeric, 
    DATE_STRING_PATTERN 
} from "../regex/index";
/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;



/**
 * @class **`StandardParser`**
 * Implements the traditional row-by-row parsing approach
 */
export class StandardParser implements ParseStrategy {
    private intermediate: IntermediateParseResults = {};
    private rowContext: RowContext;
    private info: any[] = [];
    private debug: any[] = [];

    constructor() {
        this.rowContext = {
            recordType: '',
            rowIndex: 0,
            filePath: '',
            cache: {}
        };
    }

    getStrategyName(): string {
        return ParseStrategyEnum.STANDARD;
    }

    validateInput(context: ParseManagerContext): void {
        const { filePath, parseOptions } = context;
        
        if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
            throw new Error(`Invalid file path: ${filePath}`);
        }
        
        if (!isValidCsv(filePath)) {
            throw new Error(`Invalid CSV file: ${filePath}`);
        }
        
        for (const [recordType, options] of Object.entries(parseOptions)) {
            if (!options.keyColumn) {
                throw new Error(`Missing keyColumn for record type: ${recordType}`);
            }
        }
    }

    async parseFile(context: ParseManagerContext): Promise<ParseResults> {
        this.validateInput(context);
        
        const { filePath, parseOptions, meta, errors, globalCache } = context;
        const delimiter = getDelimiterFromFilePath(filePath);
        const results: ParseResults = {};
        for (const recordType of Object.keys(parseOptions)) {
            results[recordType] = [];
            this.intermediate[recordType] = {};
            meta.recordTypeCounts[recordType] = 0;
            if (!globalCache[recordType]) {
                globalCache[recordType] = {};
            }
        }
        this.rowContext.filePath = filePath;
        return new Promise((resolve, reject) => {
            this.rowContext.rowIndex = 0;
            
            fs.createReadStream(filePath)
                .pipe(csv({ separator: delimiter }))
                .on('data', async (row: Record<string, any>) => {
                    try {
                        await this.processRow(row, parseOptions, globalCache, errors);
                        meta.successfulRows++;
                    } catch (error) {
                        this.handleRowError(error as Error, row, errors);
                    }
                    this.rowContext.rowIndex++;
                    meta.totalRows++;
                })
                .on('end', () => {
                    try {
                        // Convert intermediate results to final format
                        for (const [recordType, recordMap] of Object.entries(this.intermediate)) {
                            results[recordType] = Object.values(recordMap);
                            meta.recordTypeCounts[recordType] = results[recordType].length;
                        }
                        mlog.info(`Successfully parsed ${meta.totalRows} rows from ${filePath}`);
                        resolve(results);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    private async processRow(
        row: Record<string, any>, 
        parseOptions: ParseOptions,
        globalCache: { [recordType: string]: { [recordId: string]: FieldDictionary} },
        errors: any[]
    ): Promise<void> {
        for (const [recordType, options] of Object.entries(parseOptions)) {
            this.rowContext.recordType = recordType;
            const { keyColumn, fieldOptions, sublistOptions } = options as RecordParseOptions;
            
            try {
                const recordId = clean(row[keyColumn]);
                this.rowContext.recordId = recordId;
                
                let record;
                if (this.intermediate[recordType][recordId]) {  
                    record = this.intermediate[recordType][recordId];
                    this.rowContext.cache = {...(globalCache[recordType][recordId] || {}), ...record.fields};
                } else {
                    record = {
                        recordType: recordType as RecordTypeEnum,
                        isDynamic: NOT_DYNAMIC,
                        fields: {} as FieldDictionary,
                        sublists: {} as SublistDictionary,
                    } as RecordOptions;
                    this.rowContext.cache = globalCache[recordType][recordId] || {};
                }
                
                this.intermediate[recordType][recordId] = await this.processRecord(
                    row, record, fieldOptions || {}, sublistOptions || {}
                );
            } catch (error) {
                this.handleRowError(error as Error, row, errors);
            }
        }
    }

    private async processRecord(
        row: Record<string, any>, 
        record: RecordOptions, 
        fieldOptions: FieldDictionaryParseOptions, 
        sublistOptions: SublistDictionaryParseOptions
    ): Promise<RecordOptions> {
        if (isNonEmptyArray(Object.keys(fieldOptions))) {
            record.fields = await this.processFields(row, record.fields as FieldDictionary, fieldOptions);
        }
        if (isNonEmptyArray(Object.keys(sublistOptions))) {
            record.sublists = await this.processSublists(row, record.sublists as SublistDictionary, sublistOptions);
        }
        return record;
    }

    private async processFields(
        row: Record<string, any>,
        fields: FieldDictionary,
        fieldOptions: FieldDictionaryParseOptions,
    ): Promise<FieldDictionary> {
        const resolver = new FieldDependencyResolver(fieldOptions);
        const evaluationOrder = resolver.getEvaluationOrder();
        
        const evalContext: EvaluationContext = {
            ...this.rowContext,
            currentFieldId: '', 
            fields
        };
        
        for (const fieldId of evaluationOrder) {
            evalContext.currentFieldId = fieldId;
            try {
                const valueOptions = fieldOptions[fieldId];
                let value; 
                if (isFieldParseOptions(valueOptions)) {
                    value = await this.processFieldValue(row, evalContext, 
                        valueOptions as FieldParseOptions
                    ) as FieldValue;
                } else {
                    value = await this.generateFieldSubrecordOptions(row, evalContext, 
                        valueOptions as SubrecordParseOptions
                    ) as SubrecordValue;
                }
                fields[fieldId] = value;
            } catch (error) {
                this.handleFieldError(error as Error, row, evalContext);
            }
        }
        return fields;
    }

    /**
     * 
     * @param row `Record<string, any>`
     * @param sublists {@link SublistDictionary} - The `RecordOptions.sublists` to update
     * @param sublistOptions {@link SublistDictionaryParseOptions}
     * @returns **`sublists`** {@link SublistDictionary} - The `sublists` with updated lines
     */
    private async processSublists(
        row: Record<string, any>,
        sublists: SublistDictionary,
        sublistOptions: SublistDictionaryParseOptions
    ): Promise<SublistDictionary> {
        this.debug.push(
            NL + `[START processSublists()]`,
            TAB+`Object.keys(sublistOptions): ${JSON.stringify(Object.keys(sublistOptions))}`,
        );
        if (anyNull(row, sublists, sublistOptions)) {
            return sublists || {};
        }
        for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
            try {
                const sublistLines = (isNonEmptyArray(sublists[sublistId]) 
                    ? sublists[sublistId] : []
                ) as SublistLine[];
                sublists[sublistId] = await this.processSublistLineParseOptions(
                    row, sublistId, sublistLines, lineOptionsArray
                );
            } catch (error) {
                this.handleSublistError(error as Error, row, sublistId);
            }
        }
        this.debug.push(
            NL+`sublists AFTER processSublistLineParseOptions(): ${indentedStringify(sublists)}`,
            NL + `[END processSublists()]`
        );
        return sublists;
    }
    /**
     * 
     * @param row 
     * @param sublistId 
     * @param sublistLines 
     * @param lineOptionsArray 
     * @returns 
     */
    private async processSublistLineParseOptions(
        row: Record<string, any>,
        sublistId: string,
        sublistLines: SublistLine[],
        lineOptionsArray: SublistLineParseOptions[],
    ): Promise<SublistLine[]> {
        if (anyNull(row, sublistId, lineOptionsArray) || !Array.isArray(sublistLines)) {
            return sublistLines;
        }
        for (const lineOptions of lineOptionsArray) {
            const newSublistLine: SublistLine = {};
            if (lineOptions?.lineIdOptions?.lineIdProp) {
                newSublistLine.lineIdProp = lineOptions.lineIdOptions.lineIdProp;
            }
            /** filter out parse field-value pairs so they don't get put in the SublistLine */
            const sublistFieldIds = Object.keys(lineOptions).filter((key) => 
                key !== 'lineIdOptions'
            );
            const context: EvaluationContext = {
                ...this.rowContext,
                sublistId,
                currentFieldId: '',
                fields: newSublistLine,
            };
            for (const sublistFieldId of sublistFieldIds) {
                context.currentFieldId = sublistFieldId;
                const valueOptions = lineOptions[sublistFieldId];
                const value = (isFieldParseOptions(valueOptions)
                    ? await this.processFieldValue(row, context, 
                        valueOptions as FieldParseOptions
                    ) as FieldValue
                    : await this.generateSublistSubrecordOptions(row, context, sublistId,
                        valueOptions as SubrecordParseOptions
                    ) as SubrecordValue
                );
                if (value === '' || value === undefined) { continue; }
                newSublistLine[sublistFieldId] = value;
            }
            if (!this.isDuplicateSublistLine(sublistLines, newSublistLine, 
                lineOptions.lineIdOptions || {}
            )) {
                sublistLines.push(newSublistLine);
            }
        }
        return sublistLines;
    }    
    private async generateSublistSubrecordOptions(
        row: Record<string, any>,
        context: EvaluationContext,
        parentSublistId: string,
        subrecordOptions: SubrecordParseOptions,
    ): Promise<SetSublistSubrecordOptions> {
        if (anyNull(row, parentSublistId, context.currentFieldId, subrecordOptions)) {
            return {} as SetSublistSubrecordOptions;
        }
        this.debug.push(
            NL + `[START generateSetSublistSubrecordOptions()]`, 
            TAB+`parentSublistId: '${parentSublistId}'`,
            TAB+`  parentFieldId: '${context.currentFieldId}'`,
        );
        const { subrecordType, fieldOptions, sublistOptions } = subrecordOptions;
        const subrecord: SetSublistSubrecordOptions = {
            subrecordType, 
            sublistId: parentSublistId, 
            fieldId: context.currentFieldId
        };
        if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
            subrecord.fields = await this.processFields(
                row, subrecord.fields || {}, fieldOptions
            );
        }
        if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
            subrecord.sublists = await this.processSublists(
                row, subrecord.sublists || {}, sublistOptions
            );
        }
        this.debug.push(NL + `[END generateSetSublistSubrecordOptions()]`,); 
        return subrecord;
    }
    
    private isDuplicateSublistLine(
        existingLines: SublistLine[],
        newLine: SublistLine,
        lineIdOptions: SublistLineIdOptions
    ): boolean {
        if (!isNonEmptyArray(existingLines)) { // no existing SublistLines, or it's undefined
            return false;
        }
        this.debug.push(
            NL + `[ParseManager.isDuplicateSublistLine()] - checking for duplicate sublist line.`,
        );
        const { lineIdProp, lineIdEvaluator, args } = lineIdOptions || {};
        const isDuplicateSublistLine = existingLines.some((existingLine, sublistLineIndex) => {
            if (lineIdEvaluator && typeof lineIdEvaluator === 'function') {
                const existingLineId = lineIdEvaluator(existingLine, ...args || []);
                const newLineId = lineIdEvaluator(newLine, ...args || []);
                return equivalentAlphanumeric(existingLineId, newLineId);
            }
            const canCompareUsingLineIdProp = Boolean(lineIdProp
                && existingLine.lineIdProp === lineIdProp
                && Boolean(newLine[lineIdProp])
                && typeof newLine[lineIdProp] === 'string' 
                && typeof existingLine[lineIdProp] === 'string'
            );
            if (lineIdProp && canCompareUsingLineIdProp) {
                this.debug.push(NL + `canCompareUsingLineIdProp === true`,
                    TAB + ` existingLine.lineIdProp: '${existingLine.lineIdProp}'`,
                    TAB + `        param lineIdProp: '${lineIdProp}'`,
                    TAB + `existingLine[lineIdProp]: '${existingLine[lineIdProp]}'`,
                    TAB + `     newLine[lineIdProp]: '${newLine[lineIdProp]}'`,
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
                this.debug.push(
                    TAB + `sublistLineIndex: ${sublistLineIndex}, fieldId: '${fieldId}',`,
                    TAB + `valA: '${valA}'`,
                    TAB + `valB: '${valB}'`,
                    TAB + `areFieldsEqual: ${areFieldsEqual}`,
                );
                return areFieldsEqual;
            });
        });
        this.debug.push(
            NL + ` -> return isDuplicateSublistLine === ${isDuplicateSublistLine}`,
        );
        return isDuplicateSublistLine;
    }
    /**
     * @param valueOptions {@link FieldParseOptions}
     * @returns **`value`** {@link FieldValue}
     */
    private async processFieldValue(
        row: Record<string, any>,
        context: EvaluationContext,
        valueOptions: FieldParseOptions,
    ): Promise<FieldValue> {
        this.info.push(
            NL +`[START parseFieldValue()] - fieldId: '${context.currentFieldId}'`,
        );
        if (anyNull(context, context.currentFieldId, valueOptions)) {
            return null;
        }
        let value: FieldValue | undefined = undefined;
        const { defaultValue, colName, evaluator, args } = valueOptions;
        if (evaluator) {
            value = await evaluator(row, context, ...(args || []));
            this.info.push(NL+` -> value from evaluator(row) = '${value}'`);
        } else if (colName) {
            value = this.transformValue(
                clean(row[colName]), 
                colName, 
                context.currentFieldId, 
                isNonEmptyArray(args) ? args[0] as ValueMapping : undefined
            );
            this.info.push(NL+` -> value from transformValue(row[colName]) = '${value}'`);
        }
        if (defaultValue !== undefined && (value === undefined || value === '')) {
            value = defaultValue;
            this.info.push(NL+` -> value from defaultValue ='${value}'`);
        }   
        this.info.push(NL+`[END parseFieldValue()] - fieldId: '${context.currentFieldId}' -> value: '${value}'`);
        return value as FieldValue;
    }

    private transformValue(
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

            if (DATE_STRING_PATTERN.test(trimmedValue)) {
                return new Date(trimmedValue);
            } 
            return trimmedValue;
        } catch (error) {
            return trimmedValue;
        }
    }

    private async generateFieldSubrecordOptions(
        row: Record<string, any>,
        context: EvaluationContext,
        subrecordOptions: SubrecordParseOptions,
    ): Promise<SetFieldSubrecordOptions> {
        const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
        const { currentFieldId } = context;
        if (!row || !subrecordType || !currentFieldId || isNull(subrecordOptions)) {
            mlog.error(`ERROR generateSetFieldSubrecordOptions(): Invalid parameters:`,);
            return {} as SetFieldSubrecordOptions;
        }
        const subrecord = (context.fields && context.fields[currentFieldId] 
            ? context.fields[currentFieldId] // overwrite existing subrecord options
            : { subrecordType, fieldId: currentFieldId, fields: {}, sublists: {} } // create new subrecord options
        ) as SetFieldSubrecordOptions;
        if (fieldOptions && isNonEmptyArray(Object.keys(fieldOptions))) {
            subrecord.fields = await this.processFields(
                row, subrecord.fields || {}, fieldOptions
            );
        }
        if (sublistOptions && isNonEmptyArray(Object.keys(sublistOptions))) {
            subrecord.sublists = await this.processSublists(
                row, subrecord.sublists || {}, sublistOptions
            );
        }
        return subrecord;
    }

    private handleRowError(error: Error, row: Record<string, any>, errors: any[]): void {
        const parseError = {
            recordType: this.rowContext.recordType,
            error,
            context: this.rowContext
        };
        errors.push(parseError);
        mlog.error(`Row processing error: ${error.message}`, parseError);
    }
    private handleSublistError(
        error: Error, 
        row: Record<string, any>, 
        sublistId: string,
    ): void {
        // this.meta.status = ParseStatusEnum.ERROR;
        // const sublistParseError: ParseError = {
        //     recordType: this.rowContext.recordType,
        //     sublistId,
        //     error,
        //     row,
        //     context: this.rowContext
        // };
        // this.errors.push(sublistParseError);
        // const errorKey = `${this.rowContext.recordType}.${sublistId}`;
        // this.meta.sublistErrors[errorKey] = (this.meta.sublistErrors[errorKey] || 0) + 1;
        mlog.error(`[ParseManager.handleSublistError()] Error evaluating field '${sublistId}' for ${this.rowContext.recordType} at row ${this.rowContext.rowIndex}: ${error.message}`);
    }

    private handleFieldError(error: Error, row: Record<string, any>, context: EvaluationContext): void {
        mlog.error(`Field processing error for '${context.currentFieldId}': ${error.message}`);
    }
}
