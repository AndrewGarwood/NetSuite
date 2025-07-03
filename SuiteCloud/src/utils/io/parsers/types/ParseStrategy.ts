/**
 * @file src/utils/io/types/ParseStrategy.ts
 * @description Interface and types for different CSV parsing strategies
 */

import { ParseResults, RowContext, ParseOptions, CleanStringOptions } from "../..";
import type { ParseMetaData, ParseError } from "../../../../ParseManager";
import { EntityRecordTypeEnum, RecordTypeEnum } from "src/utils/api";

/**
 * @interface **`ParseManagerContext`**
 * Shared context for parsing operations
 */
export interface ParseManagerContext {
    filePath: string;
    parseOptions: ParseOptions;
    groupOptions?: HierarchyOptions;
    meta: ParseMetaData;
    errors: ParseError[];
    globalCache: any;
}

/**
 * @interface **`ParseStrategy`**
 * Contract for different CSV parsing approaches
 * A parser implementing this interface should provide:
 * @property **`parseFile`**`(context:`{@link ParseManagerContext}`): Promise<`{@link ParseResults}`>` - Method to parse a CSV file using this strategy
 * @property **`validateInput`**`(context:`{@link ParseManagerContext}`): void` - Method to validate that this strategy can handle the given input
 * @property **`getStrategyName`**`(): string` - Method to get a human-readable name for this strategy
 */
export interface ParseStrategy {
    /**
     * Parse a CSV file using this strategy
     * @param context - Shared parsing context
     * @returns Promise resolving to parsed results
     */
    parseFile(context: ParseManagerContext): Promise<ParseResults>;
    
    /**
     * Validate that this strategy can handle the given input
     * @param context - Parsing context to validate
     * @throws Error if strategy cannot handle the input
     */
    validateInput(context: ParseManagerContext): void;
    
    /**
     * Get a human-readable name for this strategy
     */
    getStrategyName(): string;
}

/**
 * @enum {string }**`ParseStrategyEnum`**
 * Available parsing strategies
 */
export enum ParseStrategyEnum {
    STANDARD = 'STANDARD',
    GROUPED = 'GROUPED'
}

/**
 * @interface **`GroupedParseResult`**
 * Extended result type for grouped parsing with additional metadata
 */
export interface GroupedParseResult {
    results: ParseResults;
    groupStructure?: any; // The hierarchical structure created during grouping
    processingOrder?: string[]; // Order in which records were processed
}

export type HierarchyOptions = {
    groups: RecordKeyOptions[],
    returnType?: GroupReturnTypeEnum
}

export type Ancestor = {
    recordId: string;
    recordType: string | RecordTypeEnum | EntityRecordTypeEnum;
}

export type GroupContext = {
    filePath: string;
    returnType: GroupReturnTypeEnum;
    row: Record<string, any>;
    rowIndex: number;
    groups: RecordKeyOptions[]
}

export type RecordKeyOptions = {
    recordType: string | RecordTypeEnum | EntityRecordTypeEnum;
    keyColumn: string;
    keyOptions?: CleanStringOptions;
}

export enum GroupReturnTypeEnum {
    ROW_INDICES = 'ROW_INDICES',
    INDEXED_ROWS = 'INDEXED_ROWS',
}

/**
 * @typedefn **`RecordRowGroup`**
 */
export type RecordRowGroup = {
    ancestors: Ancestor[];
    rows: RowDictionary;
    recordType: string;
}

export type NodeStructure = {
    [key: string]: NodeStructure | NodeLeaves
}

export type NodeLeaves = number[] | RowDictionary;

export type RowDictionary = { 
    [rowIndex: number]: Record<string, any> 
}