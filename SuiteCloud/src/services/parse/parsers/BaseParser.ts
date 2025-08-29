/**
 * @file src/utils/io/parsers/BaseParser.ts
 * @description Base class for parsing strategies containing shared functionality
 */

import { 
    ParseManagerContext,
    ParseStrategy 
} from "./types/ParseStrategy";
import { FieldDependencyResolver } from "./FieldDependencyResolver";
import { 
    FieldDictionary, SublistDictionary, SublistLine, 
    FieldValue, SubrecordValue, SetFieldSubrecordOptions,
    SetSublistSubrecordOptions, isFieldValue
} from "../../../api";
import {
    isNonEmptyArray, anyNull,
    areEquivalentObjects
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
} from "../../../config";
import { 
    clean, 
    equivalentAlphanumericStrings as equivalentAlphanumeric, 
    DATE_STRING_PATTERN 
} from "typeshi:utils/regex";
import { indentedStringify } from "typeshi:utils/io/writing";
import { 
    BOOLEAN_FALSE_VALUES, BOOLEAN_TRUE_VALUES, isBooleanFieldId 
} from "../../../utils/ns";
import { 
    EvaluationContext, FieldDictionaryParseOptions, 
    FieldParseOptions, RowContext, SublistDictionaryParseOptions, 
    SublistLineIdOptions, SublistLineParseOptions, 
    SubrecordParseOptions, ValueMapping, 
    isFieldParseOptions, isValueMappingEntry 
} from "../types/index";

/**
 * @abstract
 * @class **`BaseParser`**
 * @implements `ParseStrategy` {@link ParseStrategy}
 * @constructor Instantiates blank `this.`{@link RowContext}
 * @description Base class containing shared functionality for parsing strategies
 */
export abstract class BaseParser implements ParseStrategy {
    protected rowContext: RowContext;
    protected errors: any[] = [];
    protected info: any[] = [];
    protected debug: any[] = [];
    protected checkSublistLineDuplicates: boolean = true;
        protected globalCache: { 
            [recordType: string]: { [recordId: string]: FieldDictionary } 
        } = {};

    constructor() {
        this.rowContext = {
            filePath: '',
            rowIndex: 0,
            recordType: 'BASE_PARSER_CONSTRUCTOR_UNDEFINED_RECORD_TYPE',
            recordId: 'BASE_PARSER_CONSTRUCTOR_UNDEFINED_RECORD_ID',
            cache: {}
        } as RowContext;
    }

    // Abstract methods that must be implemented by subclasses
    abstract getStrategyName(): string;
    abstract validateInput(context: ParseManagerContext): void;
    abstract parseFile(context: ParseManagerContext): Promise<any>;

// ============================================================================
// FIELD PROCESSING METHODS
// ============================================================================

    /**
     * Process body fields using dependency resolution
     */
    protected async processFields(
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
            try {
                evalContext.currentFieldId = fieldId;
                const valueOptions = fieldOptions[fieldId];
                let value: FieldValue | SubrecordValue;
                
                if (isFieldParseOptions(valueOptions)) {
                    value = await this.processFieldValue(row, evalContext, 
                        valueOptions as FieldParseOptions
                    ) as FieldValue;
                } else {
                    value = await this.generateFieldSubrecordOptions(row, 
                        evalContext, 
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
     * Process a single field value
     */
    protected async processFieldValue(
        row: Record<string, any>,
        context: EvaluationContext,
        valueOptions: FieldParseOptions,
    ): Promise<FieldValue> {
        this.info.push(
            NL +`[START BaseParser.parseFieldValue()] - fieldId: '${context.currentFieldId}'`,
        );
        if (anyNull(context, context.currentFieldId, valueOptions)) {
            return null;
        }
        let value: FieldValue | undefined = undefined;
        const { defaultValue: defaultValue, colName, evaluator, args, cache } = valueOptions;
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
        this.info.push(NL+`[END BaseParser.parseFieldValue()] - fieldId: '${context.currentFieldId}' -> value: '${value}'`);
        if (typeof cache === 'boolean' && cache && value !== undefined && value !== '') {
            context.cache[context.currentFieldId] = value;
        }
        return value as FieldValue;
    }

// ============================================================================
// SUBLIST METHODS
// ============================================================================

    /**
     * @description Given a single row
     * - `for` each `[sublistId, lineOptionsArray]` in entries of `sublistOptions`: 
     * - - update `sublists[sublistId]` with the results from `processSublistLineParseOptions()`
     * @param row `Record<string, any>` - The current row being processed
     * @param sublists {@link SublistDictionary}
     * @param sublistOptions {@link SublistDictionaryParseOptions}
     * @returns **`sublists`** {@link SublistDictionary} - Updated version of `sublists`
     */
    protected async processSublists(
        row: Record<string, any>,
        sublists: SublistDictionary,
        sublistOptions: SublistDictionaryParseOptions
    ): Promise<SublistDictionary> {
        this.debug.push(
            NL + `[START BaseParser.processSublists()]`,
            TAB+`Object.keys(sublistOptions): ${JSON.stringify(Object.keys(sublistOptions))}`,
        );
        if (anyNull(row, sublists, sublistOptions)) {
            return sublists;
        }
        for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
            if (!sublists[sublistId]) {
                sublists[sublistId] = [];
            }
            sublists[sublistId] = await this.processSublistLineParseOptions(
                row, sublistId, sublists[sublistId] as SublistLine[], lineOptionsArray
            );
        }
        this.debug.push(
            NL+`sublists AFTER processSublistLineParseOptions(): ${indentedStringify(sublists)}`,
            NL + `[END BaseParser.processSublists()]`
        );
        return sublists;
    }

    /**
     * @description Given a single row, use lineOptionsArray (SublistLineParseOptions) 
     * to update an entry from SublistDictionary
     * where the entry is represented by the params `sublistId` (key) and `sublistLines` (value)
     * @param row `Record<string, any>`
     * @param sublistId `string`
     * @param sublistLines {@link SublistLine}`[]` - The current lines in the sublist
     * @param lineOptionsArray {@link SublistLineParseOptions}`[]` - Options for parsing sublist lines from the row data
     * @returns **`sublistLines`** {@link SublistLine}`[]` - Updated version of `sublistLines` to store in `sublists[sublistId]`
     */
    protected async processSublistLineParseOptions(
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
                newSublistLine.idFields = lineOptions.lineIdOptions.lineIdProp;
            }
            /** filter out parse field-value pairs so they don't get put in the SublistLine */
            const sublistFieldIds = Object.keys(lineOptions).filter((key) => 
                key !== 'lineIdOptions'
            );
            const context: EvaluationContext = {
                ...this.rowContext,
                sublistId,
                currentFieldId: '',
                fields: newSublistLine as FieldDictionary,
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
            if (this.checkSublistLineDuplicates 
                && this.isDuplicateSublistLine(sublistLines, 
                    newSublistLine, lineOptions.lineIdOptions || {}
                )
            ) {
                continue;
            }
            sublistLines.push(newSublistLine);
        }
        return sublistLines;
    }
// ============================================================================
// SUBRECORD METHODS
// ============================================================================

    /**
     * Generate field subrecord options
     */
    protected async generateFieldSubrecordOptions(
        row: Record<string, any>,
        context: EvaluationContext,
        subrecordOptions: SubrecordParseOptions,
    ): Promise<SetFieldSubrecordOptions> {
        const { subrecordType, fieldOptions, sublistOptions} = subrecordOptions;
        const { currentFieldId } = context;
        if (!row || !subrecordType || !currentFieldId || !subrecordOptions) {
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

    /**
     * Generate sublist subrecord options
     */
    protected async generateSublistSubrecordOptions(
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

// ============================================================================
// UTILITY METHODS
// ============================================================================

    /**
     * Check if a sublist line is a duplicate
     */
    protected isDuplicateSublistLine(
        existingLines: SublistLine[],
        newLine: SublistLine,
        lineIdOptions: SublistLineIdOptions = {}
    ): boolean {
        if (!isNonEmptyArray(existingLines)) { // no existing SublistLines, or it's undefined
            return false;
        }
        this.debug.push(
            NL + `[BaseParser.isDuplicateSublistLine()] - checking for duplicate sublist line.`,
        );
        const { lineIdProp, lineIdEvaluator, args } = lineIdOptions;
        const isDuplicateSublistLine = existingLines.some((existingLine, sublistLineIndex) => {
            if (lineIdEvaluator && typeof lineIdEvaluator === 'function') {
                const existingLineId = lineIdEvaluator(existingLine, ...args || []);
                const newLineId = lineIdEvaluator(newLine, ...args || []);
                return equivalentAlphanumeric(existingLineId, newLineId);
            }
            const canCompareUsingLineIdProp = Boolean(lineIdProp
                && existingLine.idFields === lineIdProp
                && Boolean(newLine[lineIdProp])
                && typeof newLine[lineIdProp] === 'string' 
                && typeof existingLine[lineIdProp] === 'string'
            );
            if (lineIdProp && canCompareUsingLineIdProp) {
                this.debug.push(NL + `canCompareUsingLineIdProp === true`,
                    TAB + ` existingLine.lineIdProp: '${existingLine.idFields}'`,
                    TAB + `        param lineIdProp: '${lineIdProp}'`,
                    TAB + `existingLine[lineIdProp]: '${existingLine[lineIdProp]}'`,
                    TAB + `     newLine[lineIdProp]: '${newLine[lineIdProp]}'`,
                );
                return equivalentAlphanumeric(
                    String(existingLine[lineIdProp]), String(newLine[lineIdProp])
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
     * Transform a value based on mappings and type conversion
     */
    protected transformValue(
        originalValue: string, 
        originalKey: string,
        newKey: string,
        valueMapping?: ValueMapping
    ): FieldValue {
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
        try { // try to parse as boolean or Date
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

// ============================================================================
// SHARED ERROR HANDLING METHODS
// ============================================================================

    /**
     * Handle row processing errors
     */
    protected handleRowError(error: Error, row: Record<string, any>, errors: any[]): void {
        const parseError = {
            recordType: this.rowContext.recordType,
            error,
            context: this.rowContext
        };
        errors.push(parseError);
        mlog.error(`[BaseParser.handleRowError()] Row processing error: ${error.message}`, parseError);
    }

    /**
     * Handle field processing errors
     */
    protected handleFieldError(error: Error, row: Record<string, any>, context: EvaluationContext): void {
        mlog.error(`[BaseParser.handleFieldError()] Field processing error for '${context.currentFieldId}': ${error.message}`);
    }

    /**
     * Handle sublist processing errors
     */
    protected handleSublistError(
        error: Error, 
        row: Record<string, any>, 
        sublistId: string,
    ): void {
        mlog.error(`[BaseParser.handleSublistError()] Error evaluating sublist field`,
            TAB+`  rowIndex: ${this.rowContext.rowIndex}`,
            TAB+`recordType: ${this.rowContext.recordType}`,
            TAB+` sublistId: '${sublistId}'`,
            TAB+`   message:${error.message}`
        );
    }
}
