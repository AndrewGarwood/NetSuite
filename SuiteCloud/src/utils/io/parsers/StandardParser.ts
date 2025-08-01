/**
 * @file src/utils/io/parsers/StandardParser.ts
 * @description Standard row-by-row CSV parsing strategy
 */

import csv from 'csv-parser';
import fs from 'fs';
import { BaseParser } from "./BaseParser";
import { 
    ParseManagerContext, ParseStrategyEnum 
} from "./types/ParseStrategy";
import { 
    ParseResults, IntermediateParseResults, FieldDictionaryParseOptions,
    SublistDictionaryParseOptions, RecordParseOptions, ParseOptions,
} from "../types";
import { 
    FieldDictionary, SublistDictionary, RecordOptions,
    RecordTypeEnum,
    NOT_DYNAMIC
} from "../../../api";
import {
    isNonEmptyArray,
} from "../../typeValidation";
import { 
    getDelimiterFromFilePath, 
    isValidCsv
} from "../";
import { 
    mainLogger as mlog, 
    parseLogger as plog, 
    INDENT_LOG_LINE as TAB, 
    NEW_LINE as NL,
} from "../../../config";
import { clean } from "../../regex";

/**
 * @class **`StandardParser`**
 * - Uses row-by-row parsing approach
 */
export class StandardParser extends BaseParser {
    private intermediate: IntermediateParseResults = {};
    
    constructor() {
        super();
        this.checkSublistLineDuplicates = true;
    }
    
    getStrategyName(): string {
        return ParseStrategyEnum.STANDARD;
    }
    
    validateInput(context: ParseManagerContext): void {
        const { filePath, parseOptions } = context;
        if (!isValidCsv(filePath)) {
            throw new Error(`[StandardParser.validateInput()] Invalid CSV file: ${filePath}`);
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
                        mlog.info(`[END StandardParser.parseFile()] Successfully parsed ${meta.totalRows} rows from ${filePath}`);
                        resolve(results);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }
    
    /**
     * @param row `Record<string, any>` 
     * @param parseOptions {@link ParseOptions}
     * @param globalCache `{ [recordType: string]: { [recordId: string]: FieldDictionary} }`
     * @param errors `any[]`
     */
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
                    this.rowContext.cache = {
                        ...(globalCache[recordType][recordId] || {}), 
                        ...record.fields
                    };
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
            record.fields = await this.processFields(row, 
                record.fields as FieldDictionary, 
                fieldOptions
            );
        }
        if (isNonEmptyArray(Object.keys(sublistOptions))) {
            record.sublists = await this.processSublists(row, 
                record.sublists as SublistDictionary, 
                sublistOptions
            );
        }
        return record;
    }
}
