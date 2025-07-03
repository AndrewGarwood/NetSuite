/**
 * @inprogress
 * @file src/ParseManager.ts
 */
import { 
    mainLogger as mlog, 
} from "./config";
import { 
    ParseResults,
    ParseOptions,
    RowContext,
    HierarchyOptions
} from "./utils/io";
import { 
    ParseStrategy, ParseStrategyEnum, ParseManagerContext 
} from "./utils/io/parsers/types/ParseStrategy";
import { ParserFactory } from "./utils/io/parsers/ParserFactory";
import csv from 'csv-parser';
import fs from 'fs';
import { FieldDictionary,} from "./utils/api";

/** use to set the field `"isinactive"` to false */
const NOT_DYNAMIC = false;

// ============================================================================
// TYPES
// ============================================================================
/**
 * @interface **`ParseSummary`**
 * @property {ParseResults} results - Parsed results organized by record type
 * @property {ParseError[]} errors - List of errors encountered during parsing
 * @property {ParseMetaData} meta - Metadata about the parsing process, including timing and
 */
export type ParseSummary = {
    results: ParseResults;
    errors: ParseError[];
    meta: ParseMetaData;
}
/**
 * @enum {string} **`ParseStatusEnum`**
 */
enum ParseStatusEnum {
    SETTING_UP = 'SETTING_UP',
    PARSING = 'PARSING',
    EVALUATING = 'EVALUATING',
    FINISHED = 'FINISHED',
    ERROR = 'ERROR',
}

/**
 * @interface **`ParseMetaData`**
 * @property {number} [startTime] - Unix timestamp in milliseconds when parsing started
 * @property {ParseStatusEnum} [status] - Current status of the parsing process
 * @property {string} [filePath] - Path to the CSV file being parsed
 * @property {number} totalRows - Total number of rows processed
 * @property {number} successfulRows - Number of rows successfully parsed
 * @property {number} errorRows - Number of rows that encountered errors during parsing
 * @property {Record<string, number>} recordTypeCounts - Counts of records parsed by type
 * @property {Record<string, number>} fieldErrors - Counts of errors encountered for each field
 * @property {number} processingTimeMs - Total processing time in milliseconds
 */
export interface ParseMetaData {
    startTime?: number; // unix timestamp in milliseconds
    status?: ParseStatusEnum;
    filePath?: string;
    totalRows: number;
    successfulRows: number;
    errorRows: number;
    recordTypeCounts: Record<string, number>;
    fieldErrors: Record<string, number>;
    sublistErrors: Record<string, number>;
    processingTimeMs: number;
}

/**
 * @interface **`ParseError`**
 * @property {string} recordType - Type of record where the error occurred
 * @property {string} [fieldId] - Optional; ID of the field where the error occurred
 * @property {Error} error - The error object containing details about the error
 * @property {RowContext} context - Context information about the row and file being processed
 */
export interface ParseError {
    recordType?: string;
    fieldId?: string; // Optional; if error is specific to a field
    error: Error;
    context: RowContext;
    [key: string]: any; // Allow additional properties to add other info...
}



// ============================================================================
// CLASS: ParseManager
// ============================================================================
/**
 * 
 */
export class ParseManager {
    private parseOptions: ParseOptions;
    private groupOptions?: HierarchyOptions;
    private parseStrategy: ParseStrategyEnum;
    private parser?: ParseStrategy;
    private rowContext: RowContext;
    private meta: ParseMetaData;
    private errors: ParseError[];
    private globalCache: { [recordType: string]: { [recordId: string]: FieldDictionary} };

    constructor(
        parseOptions: ParseOptions, 
        options?: {
            groupOptions?: HierarchyOptions;
            strategy?: ParseStrategyEnum;
        }
    ) {
        this.parseOptions = parseOptions;
        this.groupOptions = options?.groupOptions;
        this.parseStrategy = options?.strategy 
            || ParserFactory.recommendStrategy(this.groupOptions);
        this.rowContext = {
            recordType: '',
            rowIndex: 0,
            filePath: '',
            cache: {}
        }
        this.meta = {
            totalRows: 0,
            successfulRows: 0,
            errorRows: 0,
            recordTypeCounts: {},
            fieldErrors: {},
            sublistErrors: {},
            processingTimeMs: 0
        } as ParseMetaData;
        this.errors = [];
        this.globalCache = {};
        for (const recordType in parseOptions) {
            this.globalCache[recordType] = {};
        }
    }

    async parseRecordCsv(filePath: string): Promise<ParseSummary> {
        const startTime = Date.now();
        this.meta.startTime = startTime;
        this.meta.filePath = filePath;
        this.rowContext.filePath = filePath;
        this.meta.status = ParseStatusEnum.SETTING_UP;
        
        try {
            // Create parser instance based on strategy
            this.parser = ParserFactory.createParser(
                this.parseStrategy, this.groupOptions
            );
            const context: ParseManagerContext = {
                filePath,
                parseOptions: this.parseOptions,
                groupOptions: this.groupOptions,
                meta: this.meta,
                errors: this.errors,
                globalCache: this.globalCache
            };
            
            mlog.info(`Using parsing strategy: ${this.parser.getStrategyName()}`);
            const results = await this.parser.parseFile(context);
            this.meta.processingTimeMs = Date.now() - startTime;
            this.meta.status = ParseStatusEnum.FINISHED; 
            return {
                results: results,
                errors: this.errors,
                meta: this.meta
            };
        } catch (error) {
            this.meta.status = ParseStatusEnum.ERROR;
            mlog.error(`Failed to parse CSV file: ${error}`);
            throw error;
        }
    }

    getStatistics(): ParseMetaData {
        return { ...this.meta };
    }

    getErrors(): ParseError[] {
        return [...this.errors];
    }
}
