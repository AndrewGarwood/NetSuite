/**
 * @incomplete
 * @file src/utils/io/parsers/GroupedParser.ts
 * @description Hierarchical grouping CSV parsing strategy
 */
import * as fs from "node:fs";
import { BaseParser } from "./BaseParser";
import { 
    ParseManagerContext, ParseStrategyEnum, 
    NodeStructure,
    RowDictionary,
    HierarchyOptions,
    RecordRowGroup,
    GroupReturnTypeEnum,
    GroupContext,
    Ancestor
} from "./types/ParseStrategy";
import { FieldDependencyResolver } from "./FieldDependencyResolver";
import { 
    ParseResults, EvaluationContext,
    FieldDictionaryParseOptions, SublistDictionaryParseOptions, FieldParseOptions,
    SubrecordParseOptions
} from "../types/ParseOptions";
import {
    isFieldParseOptions
} from "../types/ParseOptions.TypeGuards";
import { 
    isNodeLeaves,
    isRowDictionary,
    isNodeStructure
} from "typeshi:utils/io/types/typeGuards";
import { 
    FieldDictionary, SublistDictionary, SublistLine, RecordOptions,
    RecordTypeEnum, FieldValue, SubrecordValue,
    EntityRecordTypeEnum,
    SetFieldSubrecordOptions,
    NOT_DYNAMIC
} from "../../../api";
import {
    isNonEmptyArray, isEmptyArray, isNullLike as isNull,
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
} from "../../../config";
import { clean } from "typeshi:utils/regex";
import { getDelimiterFromFilePath, getRows, isValidCsvSync, NodeLeaves } from "typeshi:utils/io";
import { ParseDictionary, RecordParseOptions } from "src/services/parse/types/ParseOptions";


/**
 * @class **`GroupedParser`**
 * Implements {@link ParseStrategy} with the hierarchical grouping parsing approach
 */
export class GroupedParser extends BaseParser {
    private groupOptions?: HierarchyOptions;

    constructor(groupOptions?: HierarchyOptions) {
        super();
        this.groupOptions = groupOptions;
        /** GroupedParser does not check for SublistLine duplicates (because of groupRows()...)*/
        this.checkSublistLineDuplicates = false; 
    }
    getStrategyName(): string {
        return ParseStrategyEnum.GROUPED;
    }
    validateInput(context: ParseManagerContext): void {
        const { filePath, parseOptions, groupOptions } = context;
        if (!isValidCsvSync(filePath)) {
            throw new Error(`[GroupedParser.validateInput()] Invalid CSV file: ${filePath}`);
        }
        
        if (!groupOptions || !isNonEmptyArray(groupOptions.groups)) {
            throw new Error(`[GroupedParser.validateInput()] GroupedParser requires valid groupOptions with at least one group`);
        }
        
        for (const [recordType, options] of Object.entries(parseOptions)) {
            if (!options.keyColumn) {
                throw new Error(`[GroupedParser.validateInput()] Missing keyColumn for record type: ${recordType}`);
            }
        }
    }

    async parseFile(context: ParseManagerContext): Promise<ParseResults> {
        this.validateInput(context);
        this.groupOptions = context.groupOptions;
        if (!this.groupOptions || !isNonEmptyArray(this.groupOptions.groups)) {
            throw new Error(`[GroupedParser.parseFile()] No valid groupOptions provided`);
        }
        const { 
            filePath, parseOptions, meta, errors, globalCache 
        } = context as ParseManagerContext;
        const { groups } = this.groupOptions;
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
        const groupedRowDataArray = this.getNodeLeaves(
            rootData, recordTypes
        ) as RecordRowGroup[];
        
        // Step 5: Process each group
        for (const groupData of groupedRowDataArray) {
            try {
                await this.processGroupedData(groupData, parseOptions, results);
                meta.successfulRows++;
            } catch (error) {
                this.handleRowError(error as Error, {}, errors);
            }
        }
        
        for (const recordType of recordTypes) {
            meta.recordTypeCounts[recordType] = results[recordType].length;
        }
        return results;
    }
    
    /** e.g. groupOptions.returnType = INDEXED_ROWS -> `{ customerA: { salesorder100: { 0: <row0>, 1: <row1> }, salesorder108: { 12: <row12>, 13: <row13>, 14: <row14> } } }`
     * @description Groups CSV rows into hierarchical structure based on groupOptions ({@link HierarchyOptions}) from constructor
     * @param filePath `string`
     * @returns **`rootData`** {@link NodeStructure} - hierarchical structure of grouped rows
     */
    private async groupRows(filePath: string): Promise<NodeStructure> {
        if (!this.groupOptions) {
            throw new Error(`[GroupedParser.groupRows()] No groupOptions provided`);
        }
        const { groups, returnType = GroupReturnTypeEnum.INDEXED_ROWS } = this.groupOptions;
        const delimiter = getDelimiterFromFilePath(filePath);
        const context: GroupContext = {
            filePath, 
            returnType, 
            row: {}, 
            rowIndex: 0, 
            groups 
        };
        const { keyColumn: primaryColumn, keyOptions: primaryOptions } = groups[0];
        const rootData: NodeStructure = {};
        const rows = await getRows(filePath);
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            let row = rows[rowIndex];
            const primaryKey = clean(row[primaryColumn], primaryOptions);
            context.row = row;
            context.rowIndex = rowIndex;
            if (!primaryKey) {
                mlog.warn(`Row ${rowIndex} has no primary key value for column '${primaryColumn}'. Skipping row.`);
                rowIndex++;
                continue;
            }
            this.assignGroup(context, 1, rootData, primaryKey);
        }
        return rootData;
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
            mlog.warn(`[GroupedParser.assignGroup()] Row ${context.rowIndex} has no value for column '${childKeyColumn}'. Skipping this grouping level.`);
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
     * @TODO handle returnType = ROW_INDICES
     * @description Extracts leaf nodes (final grouped data) from the hierarchical structure
     */
    private getNodeLeaves(rootData: NodeStructure, recordTypes: string[]): RecordRowGroup[] {
        const groupedData: RecordRowGroup[] = [];
        const maxDepth = recordTypes.length;
        
        const traverse = (branch: NodeStructure, depth: number, ancestors: Ancestor[]) => {
            if (depth === maxDepth - 1) { // Leaf level - extract row data
                for (const [key, value] of Object.entries(branch)) {
                    if (isNodeLeaves(value)) {
                        const currentAncestors = [
                            ...ancestors, 
                            { recordId: key, recordType: recordTypes[depth] }
                        ];
                        if (isRowDictionary(value)) {
                            for (const ancestor of currentAncestors) {
                                groupedData.push({
                                    ancestors: currentAncestors,
                                    rows: value as RowDictionary,
                                    recordType: ancestor.recordType
                                });
                            }
                        } else {
                            throw new Error(`[GroupedParser.getNodeLeaves()] Expected RowDictionary at leaf level but found ${typeof value}`);
                        }
                    } else {
                        throw new Error(`[GroupedParser.getNodeLeaves()] Expected NodeLeaves at depth ${depth} but found ${typeof value}`);
                    }
                }
            } else { // Intermediate node - continue traversal
                for (const [key, subBranch] of Object.entries(branch)) {
                    if (isNodeStructure(subBranch)) {
                        traverse(subBranch as NodeStructure, depth + 1, [...ancestors, { recordId: key, recordType: recordTypes[depth] }]);
                    } else {
                        throw new Error(`[GroupedParser.getNodeLeaves()] Expected NodeStructure at depth ${depth} but found ${typeof subBranch}`);
                    }
                }
            }
        };
        traverse(rootData, 0, []);
        return groupedData;
    }

    /**
     * Processes a single grouped data entry
     * @param groupData {@link RecordRowGroup}
     * @param parseOptions {@link ParseDictionary}
     * @param results {@link ParseResults} - object to populate with parsed records from the groupData
     */
    private async processGroupedData(
        groupData: RecordRowGroup,
        parseOptions: ParseDictionary,
        results: ParseResults,
    ): Promise<void> {
        const { ancestors, rows, recordType } = groupData as RecordRowGroup;
        const recordOptions = parseOptions[recordType] as RecordParseOptions;
        
        if (!recordOptions) {
            mlog.warn(`[GroupedParser.processGroupedData()] No parse options found for record type: ${recordType}`);
            return;
        }
        
        /** the record ID for this record type */
        const recordAncestor = ancestors.find(a => a.recordType === recordType);
        if (!recordAncestor) {
            mlog.warn(`[GroupedParser.processGroupedData()] No ancestor found for record type: ${recordType}`);
            return;
        }
        const recordId = recordAncestor.recordId;
        const record: Required<RecordOptions> = {
            recordType: recordType as RecordTypeEnum,
            idOptions: [],
            fields: {} as FieldDictionary,
            sublists: {} as SublistDictionary,
        };

        
        // Process body fields from a single row in RowDictionary (they should be consistent)
        const repRow = Object.values(rows)[0];
        const repRowIndex = (Object.keys(rows)[0] 
            ? parseInt(Object.keys(rows)[0], 10) 
            : -1
        );
        if (!repRow || isNaN(repRowIndex) || repRowIndex < 0) {
            mlog.error(`[GroupedParser.processGroupedData()]: Error defining representative row`,
                TAB+`recordType: '${recordType}'`,
                TAB+`  recordId: '${recordId}'`,
                TAB+`  filePath: '${this.rowContext.filePath}'`,
            );
            throw new Error(`[GroupedParser.processGroupedData()]: Error defining representative row`);
        }
        this.rowContext.rowIndex = repRowIndex;
        if (repRow && recordOptions.fieldOptions) {
            record.fields = await this.getFieldsFromRepresentativeRow(repRow, 
                recordOptions.fieldOptions,
                recordId,
                recordType
            );
        }
        
        // Process sublists from all rows
        if (recordOptions.sublistOptions) {
            record.sublists = await this.getSublistsFromRowDictionary(rows,
                recordOptions.sublistOptions,
            );
        }
        
        results[recordType].push(record);
    }

    /**
     * @description Given a representative row (e.g. first row in RowDictionary),
     * - resolve evaluationOrder of fields using {@link FieldDependencyResolver}
     */
    private async getFieldsFromRepresentativeRow(
        row: Record<string, any>,
        fieldOptions: FieldDictionaryParseOptions,
        recordId: string,
        recordType: string
    ): Promise<FieldDictionary> {
        const fields: FieldDictionary = {};
        const resolver = new FieldDependencyResolver(fieldOptions);
        const evaluationOrder = resolver.getEvaluationOrder();
        
        this.rowContext.recordType = recordType;
        this.rowContext.recordId = recordId;
        this.rowContext.cache = {
            ...(this.rowContext.cache || {}), 
            ...(this.globalCache[recordType][recordId] || {})
        };
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
     * @description Given a {@link RowDictionary} corresponding to a single record (assume have already used groupRows()), 
     * - `for` each `[rowIndex, row]` of `RowDictionary`: 
     * - - `for` each `sublistId` in `sublistOptions`: 
     * - - - make a {@link SublistLine} entry
     * @param rows {@link RowDictionary} - rows corresponding to a single record
     * @param sublistOptions {@link SublistDictionaryParseOptions} - options for to parse sublist lines from the rows
     * @returns **`sublists`** {@link SublistDictionary} 
     */
    private async getSublistsFromRowDictionary(
        rows: RowDictionary,
        sublistOptions: SublistDictionaryParseOptions,
    ): Promise<SublistDictionary> {
        const sublists: SublistDictionary = {};
        for (const [sublistId] of Object.entries(sublistOptions)) {
            sublists[sublistId] = [];
        }
        for (const [rowIndex, row] of Object.entries(rows)) {
            this.rowContext.rowIndex = parseInt(rowIndex, 10);
            await this.processSublists(row, sublists, sublistOptions);
        }
        return sublists;
    }

// ============================================================================
// VALIDATION
// ============================================================================
    /**
     * Validates the grouped data structure
     */
    private validateGroupData(rootData: NodeStructure, recordTypes: string[]): void {
        if (Object.keys(rootData).length === 0) {
            mlog.warn(`[GroupedParser.validateGroupData()] Empty root data structure`);
            return;
        }
        
        if (!isNonEmptyArray(recordTypes)) {
            throw new Error(`[GroupedParser.validateGroupData()] Invalid recordTypes: expected non-empty array but got ${JSON.stringify(recordTypes)}`);
        }
        
        if (recordTypes.length === 1) {
            return;
        }
        
        for (const [recordId, branches] of Object.entries(rootData)) {
            if (typeof branches !== 'object' || Array.isArray(branches)) {
                throw new Error(`[GroupedParser.validateGroupData()] Invalid structure for recordId '${recordId}':`
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
            throw new Error(`[GroupedParser.validateBranch()] Exceeded maximum expected depth for recordId '${recordId}'`);
        }
        
        if (Object.keys(branch).length === 0) {
            throw new Error(`[GroupedParser.validateBranch()] Empty branch for recordId '${recordId}' at depth ${depth}`);
        }
        
        for (const [key, value] of Object.entries(branch)) {
            if (isNodeStructure(value)) {
                this.validateBranch(value as NodeStructure, recordTypes, depth + 1, recordId);
            } else if (isNodeLeaves(value)) {
                if (depth !== recordTypes.length - 1) {
                    throw new Error(`[GroupedParser.validateBranch()] Expected leaf node at depth ${recordTypes.length - 1} for recordId '${recordId}' but found at depth ${depth}`);
                }
            } else {
                throw new Error(`[GroupedParser.validateBranch()] Invalid value type for key '${key}' in recordId '${recordId}': expected object or array but got ${typeof value}`);
            }
        }
    }
}
