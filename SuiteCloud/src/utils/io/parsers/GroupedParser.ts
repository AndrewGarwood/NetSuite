/**
 * @incomplete
 * @file src/utils/io/parsers/GroupedParser.ts
 * @description Hierarchical grouping CSV parsing strategy
 */
import csv from 'csv-parser';
import fs from 'fs';
import { 
    ParseStrategy, ParseManagerContext, ParseStrategyEnum, 
    NodeStructure,
    RowDictionary
} from "./types/ParseStrategy";
import { FieldDependencyResolver } from "./FieldDependencyResolver";
import { 
    ParseResults, EvaluationContext, RowContext,
    FieldDictionaryParseOptions, SublistDictionaryParseOptions, FieldParseOptions,
    SubrecordParseOptions
} from "../types";
import { 
    FieldDictionary, SublistDictionary, SublistLine, RecordOptions,
    RecordTypeEnum, FieldValue, SubrecordValue,
    EntityRecordTypeEnum
} from "../../api";
import {
    isNonEmptyArray, isEmptyArray, anyNull, 
    isFieldParseOptions, isNodeLeaves, isNodeStucture, isRowDictionary
} from "../../typeValidation";
import { 
    getDelimiterFromFilePath, isValidCsv, NodeLeaves, 
    ParseOptions, RecordParseOptions, CleanStringOptions, RecordRowGroup, 
    GroupReturnTypeEnum, GroupContext, Ancestor, HierarchyOptions 
} from "../";
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
    indentedStringify
} from "../../../config";
import { clean } from "../regex/index";
/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;


/**
 * @class **`GroupedParser`**
 * Implements {@link ParseStrategy} with the hierarchical grouping parsing approach
 */
export class GroupedParser implements ParseStrategy {
    private groupOptions?: HierarchyOptions;
    private rowContext: RowContext;
    private globalCache: { 
        [recordType: string]: { [recordId: string]: FieldDictionary } 
    } = {};

    constructor(groupOptions?: HierarchyOptions) {
        this.groupOptions = groupOptions;
        this.rowContext = {
            recordType: '',
            rowIndex: 0,
            filePath: '',
            cache: {}
        };
    }
    getStrategyName(): string {
        return ParseStrategyEnum.GROUPED;
    }
    validateInput(context: ParseManagerContext): void {
        const { filePath, parseOptions, groupOptions } = context;
        
        if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
            throw new Error(`Invalid file path: ${filePath}`);
        }
        
        if (!isValidCsv(filePath)) {
            throw new Error(`Invalid CSV file: ${filePath}`);
        }
        
        if (!groupOptions || !isNonEmptyArray(groupOptions.groups)) {
            throw new Error(`GroupedParser requires valid groupOptions with at least one group`);
        }
        
        for (const [recordType, options] of Object.entries(parseOptions)) {
            if (!options.keyColumn) {
                throw new Error(`Missing keyColumn for record type: ${recordType}`);
            }
        }
    }

    async parseFile(context: ParseManagerContext): Promise<ParseResults> {
        this.validateInput(context);
        this.groupOptions = context.groupOptions;
        
        const { filePath, parseOptions, meta, errors, globalCache } = context;
        const { groups } = this.groupOptions!;
        const recordTypes = groups.map(g => g.recordType);
        
        // Step 1: Group rows hierarchically
        const rootData = await this.groupRows(filePath);
        
        // Step 2: Validate the grouped structure
        this.validateGroupData(rootData, recordTypes);
        
        // Step 3: Initialize results
        const results: ParseResults = {};
        for (const recordType of recordTypes) {
            results[recordType] = [];
            meta.recordTypeCounts[recordType] = 0;
            if (!globalCache[recordType]) {
                globalCache[recordType] = {};
            }
        }
        this.globalCache = globalCache;
        // Step 4: Extract and process grouped data
        const groupedRowDataArray = this.getNodeLeaves(rootData, recordTypes);
        
        // Step 5: Process each group
        for (const groupData of groupedRowDataArray) {
            try {
                await this.processGroupedData(groupData, parseOptions, results);
                meta.successfulRows++;
            } catch (error) {
                this.handleGroupError(error as Error, groupData, errors);
            }
        }
        
        for (const recordType of recordTypes) {
            meta.recordTypeCounts[recordType] = results[recordType].length;
        }
        return results;
    }

    /**
     * Groups CSV rows into hierarchical structure based on groupOptions
     */
    private async groupRows(filePath: string): Promise<NodeStructure> {
        const { groups, returnType = GroupReturnTypeEnum.INDEXED_ROWS } = this.groupOptions!;
        const delimiter = getDelimiterFromFilePath(filePath);
        const context: GroupContext = {
            filePath, 
            returnType, 
            row: {}, 
            rowIndex: 0, 
            groups 
        };
        const { keyColumn: primaryColumn, keyOptions: primaryOptions } = groups[0];
        const result: NodeStructure = {};
        return new Promise((resolve, reject) => {
            let rowIndex = 0;
            fs.createReadStream(filePath)
                .pipe(csv({ separator: delimiter }))
                .on('data', (row: Record<string, any>) => {
                    const primaryKey = clean(row[primaryColumn], primaryOptions);
                    context.row = row;
                    context.rowIndex = rowIndex;
                    if (!primaryKey) {
                        mlog.warn(`Row ${rowIndex} has no primary key value for column '${primaryColumn}'. Skipping row.`);
                        rowIndex++;
                        return;
                    }
                    this.assignGroup(context, 1, result, primaryKey);
                    rowIndex++;
                })
                .on('end', () => resolve(result))
                .on('error', reject);
        });
    }

    /**
     * Recursively assigns a row to its hierarchical group
     */
    private assignGroup(
        context: GroupContext,
        childGroupIndex: number,
        parent: NodeStructure,
        parentKey: string,
    ): void {
        const { keyColumn: childKeyColumn, keyOptions: childKeyOptions } = context.groups[childGroupIndex];
        const childKey = clean(context.row[childKeyColumn], childKeyOptions);
        if (!childKey) {
            mlog.warn(`Row ${context.rowIndex} has no value for column '${childKeyColumn}'. Skipping this grouping level.`);
            return;
        }
        // Ensure parent structure exists
        if (!parent[parentKey]) {
            parent[parentKey] = {} as NodeStructure;
        }
        
        if (childGroupIndex === context.groups.length - 1) { 
            // Leaf node - store row data
            const parentBranch = parent[parentKey] as NodeStructure;
            if (!parentBranch[childKey]) {
                parentBranch[childKey] = (
                    context.returnType === GroupReturnTypeEnum.ROW_INDICES 
                        ? [] as number[]
                        : {} as RowDictionary
                ) as NodeLeaves;
            }
            
            if (context.returnType === GroupReturnTypeEnum.ROW_INDICES) {
                (parentBranch[childKey] as number[]).push(context.rowIndex);
            } else if (context.returnType === GroupReturnTypeEnum.INDEXED_ROWS) {
                (parentBranch[childKey] as RowDictionary)[context.rowIndex] = context.row;
            }
        } else { 
            // Intermediate node - continue recursion
            const parentBranch = parent[parentKey] as NodeStructure;
            if (!parentBranch[childKey]) {
                parentBranch[childKey] = {} as NodeStructure;
            }
            this.assignGroup(context, childGroupIndex + 1, parentBranch, childKey);
        }
    }

    /**
     * Extracts leaf nodes (final grouped data) from the hierarchical structure
     */
    private getNodeLeaves(rootData: NodeStructure, recordTypes: string[]): RecordRowGroup[] {
        const groupedData: RecordRowGroup[] = [];
        const maxDepth = recordTypes.length;
        
        const traverse = (branch: NodeStructure, depth: number, ancestors: Ancestor[]) => {
            if (depth === maxDepth - 1) { 
                // Leaf level - extract row data
                for (const [key, value] of Object.entries(branch)) {
                    if (isNodeLeaves(value)) {
                        const currentAncestors = [
                            ...ancestors, 
                            { recordId: key, recordType: recordTypes[depth] }
                        ];
                        if (isRowDictionary(value)) {
                            // For each ancestor, create a record
                            for (const ancestor of currentAncestors) {
                                groupedData.push({
                                    ancestors: currentAncestors,
                                    rows: value as RowDictionary,
                                    recordType: ancestor.recordType
                                });
                            }
                        } else {
                            throw new Error(`Expected RowDictionary at leaf level but found ${typeof value}`);
                        }
                    } else {
                        throw new Error(`Expected NodeLeaves at depth ${depth} but found ${typeof value}`);
                    }
                }
            } else { 
                // Intermediate node - continue traversal
                for (const [key, subBranch] of Object.entries(branch)) {
                    if (isNodeStucture(subBranch)) {
                        traverse(subBranch as NodeStructure, depth + 1, [...ancestors, { recordId: key, recordType: recordTypes[depth] }]);
                    } else {
                        throw new Error(`Expected NodeStructure at depth ${depth} but found ${typeof subBranch}`);
                    }
                }
            }
        };
        traverse(rootData, 0, []);
        return groupedData;
    }

    /**
     * Processes a single grouped data entry
     */
    private async processGroupedData(
        groupData: RecordRowGroup,
        parseOptions: ParseOptions,
        results: ParseResults,
    ): Promise<void> {
        const { ancestors, rows, recordType } = groupData as RecordRowGroup;
        const recordOptions = parseOptions[recordType] as RecordParseOptions;
        
        if (!recordOptions) {
            mlog.warn(`No parse options found for record type: ${recordType}`);
            return;
        }
        
        /** the record ID for this record type */
        const recordAncestor = ancestors.find(a => a.recordType === recordType);
        if (!recordAncestor) {
            mlog.warn(`No ancestor found for record type: ${recordType}`);
            return;
        }
        const recordId = recordAncestor.recordId;
        const record: RecordOptions = {
            recordType: recordType as RecordTypeEnum,
            isDynamic: NOT_DYNAMIC,
            fields: {} as FieldDictionary,
            sublists: {} as SublistDictionary,
        };

        
        // Process body fields from a single row in RowDictionary (they should be consistent)
        const representativeRow = Object.values(rows)[0];
        if (representativeRow && recordOptions.fieldOptions) {
            record.fields = await this.processFieldsFromRow(
                representativeRow, 
                recordOptions.fieldOptions,
                recordId,
                recordType
            );
        }
        
        // Process sublists from all rows
        if (recordOptions.sublistOptions) {
            record.sublists = await this.processSublistsFromRows(
                rows,
                recordOptions.sublistOptions,
                recordId,
                recordType
            );
        }
        
        results[recordType].push(record);
    }

    /**
     * @TODO field subrecords
     * @description Process body fields from a single representative row
     */
    private async processFieldsFromRow(
        row: Record<string, any>,
        fieldOptions: FieldDictionaryParseOptions,
        recordId: string,
        recordType: string
    ): Promise<FieldDictionary> {
        const fields: FieldDictionary = {};
        
        this.rowContext.recordType = recordType;
        this.rowContext.recordId = recordId;
        this.rowContext.cache = {
            ...(this.rowContext.cache || {}), 
            ...this.globalCache[recordType][recordId] || {}
        };
        const evalContext: EvaluationContext = {
            ...this.rowContext,
            currentFieldId: '',
            fields
        };
        
        // Simple field processing - could be enhanced with dependency resolution
        for (const [fieldId, valueOptions] of Object.entries(fieldOptions)) {
            evalContext.currentFieldId = fieldId;
            try {
                if (isFieldParseOptions(valueOptions)) {
                    const fieldValue = await this.processFieldValue(row, evalContext, valueOptions);
                    fields[fieldId] = fieldValue;
                }
                // Handle subrecord options if needed
            } catch (error) {
                mlog.error(`Error processing field '${fieldId}': ${error}`);
            }
        }
        
        return fields;
    }

    /**
     * @TODO sublist subrecords
     * Process sublists from all grouped rows
     */
    private async processSublistsFromRows(
        rows: RowDictionary,
        sublistOptions: SublistDictionaryParseOptions,
        recordId: string,
        recordType: string
    ): Promise<SublistDictionary> {
        const sublists: SublistDictionary = {};
        
        for (const [sublistId, lineOptionsArray] of Object.entries(sublistOptions)) {
            const sublistLines: SublistLine[] = [];
            
            // Process each row as a potential sublist line
            for (const [rowIndex, row] of Object.entries(rows)) {
                for (const lineOptions of lineOptionsArray) {
                    const sublistLine: SublistLine = {};
                    
                    // Process each field in the sublist line
                    for (const [sublistFieldId, valueOptions] of Object.entries(lineOptions)) {
                        if (sublistFieldId === 'lineIdOptions') continue;
                        
                        try {
                            if (isFieldParseOptions(valueOptions)) {
                                const evalContext: EvaluationContext = {
                                    ...this.rowContext,
                                    sublistId,
                                    currentFieldId: sublistFieldId,
                                    fields: sublistLine,
                                };
                                
                                const fieldValue = await this.processFieldValue(
                                    row, evalContext, valueOptions
                                );
                                sublistLine[sublistFieldId] = fieldValue;
                            }
                        } catch (error) {
                            mlog.error(`[GroupedParser.processSublistsFromRows()] Error processing sublist field`,
                                TAB+`recordType: '${recordType}', recordId: '${recordId}'`,
                                TAB+`rowIndex: ${rowIndex}, filePath: '${this.rowContext.filePath}'`,
                                TAB+`sublistId: '${sublistId}'`,
                                TAB+`sublistFieldId: '${sublistFieldId}'`,
                                error
                            );
                        }
                    }
                    // Only add non-empty sublist lines
                    if (Object.keys(sublistLine).length > 0) {
                        sublistLines.push(sublistLine);
                    }
                }
            }
            sublists[sublistId] = sublistLines;
        }
        return sublists;
    }

    /**
     * Process a single field value (simplified version)
     */
    private async processFieldValue(
        row: Record<string, any>,
        context: EvaluationContext,
        valueOptions: FieldParseOptions,
    ): Promise<FieldValue> {
        const { colName, evaluator, defaultValue, args } = valueOptions;
        
        if (evaluator) {
            return evaluator(row, context, ...(args || []));
        } else if (colName) {
            const value = row[colName];
            return value !== undefined ? value : (defaultValue || '');
        }
        
        return defaultValue || '';
    }

    /**
     * Validates the grouped data structure
     */
    private validateGroupData(rootData: NodeStructure, recordTypes: string[]): void {
        if (Object.keys(rootData).length === 0) {
            mlog.warn(`Empty root data structure`);
            return;
        }
        
        if (!isNonEmptyArray(recordTypes)) {
            throw new Error(`Invalid recordTypes: expected non-empty array but got ${JSON.stringify(recordTypes)}`);
        }
        
        if (recordTypes.length === 1) {
            return;
        }
        
        for (const [recordId, branches] of Object.entries(rootData)) {
            if (typeof branches !== 'object' || Array.isArray(branches)) {
                throw new Error(`Invalid structure for recordId '${recordId}':`
                    +`expected object but got ${typeof branches}`
                );
            }
            this.validateBranch(branches, recordTypes, 0, recordId);
        }
    }

    /**
     * Recursively validates a branch of the grouped structure
     */
    private validateBranch(
        branch: NodeStructure,
        recordTypes: string[],
        depth: number,
        recordId: string,
    ): void {
        if (depth >= recordTypes.length) {
            throw new Error(`Exceeded maximum expected depth for recordId '${recordId}'`);
        }
        
        if (Object.keys(branch).length === 0) {
            throw new Error(`Empty branch for recordId '${recordId}' at depth ${depth}`);
        }
        
        for (const [key, value] of Object.entries(branch)) {
            if (isNodeStucture(value)) {
                this.validateBranch(value as NodeStructure, recordTypes, depth + 1, recordId);
            } else if (isNodeLeaves(value)) {
                if (depth !== recordTypes.length - 1) {
                    throw new Error(`Expected leaf node at depth ${recordTypes.length - 1} for recordId '${recordId}' but found at depth ${depth}`);
                }
            } else {
                throw new Error(`Invalid value type for key '${key}' in recordId '${recordId}': expected object or array but got ${typeof value}`);
            }
        }
    }

    private handleGroupError(error: Error, groupData: RecordRowGroup, errors: any[]): void {
        const parseError = {
            recordType: groupData.recordType,
            error,
            context: this.rowContext
        };
        errors.push(parseError);
        mlog.error(`Group processing error: ${error.message}`, parseError);
    }
}
