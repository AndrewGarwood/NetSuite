/**
 * @file src/main.ts
 */
import path from 'node:path';
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    ValidatedParseResults,
    ProcessParseResultsOptions, ParseOptions, ParseResults,
    getCurrentPacificTime, FieldParseOptions, FieldDictionaryParseOptions, FieldEvaluator,
    SublistDictionaryParseOptions, SublistLineParseOptions,
    SublistLineIdOptions, SubrecordParseOptions, EvaluationContext, RowContext, 
    RecordKeyOptions, getCsvRows, HierarchyOptions, GroupReturnTypeEnum, 
    RowDictionary,
    trimFile,
} from "./utils/io";
import { 
    TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, CLOUD_LOG_DIR, 
    SCRIPT_ENVIRONMENT as SE, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS, DEBUG_LOGS, 
    indentedStringify, DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, clearFile,
    ERROR_LOG_FILEPATH,
    ERROR_DIR
} from "./config";
import { 
    EntityRecordTypeEnum, RecordOptions, RecordRequest, RecordResponse, RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload, getRecordById, GetRecordResponse,
    SAMPLE_POST_CUSTOMER_OPTIONS as SAMPLE_CUSTOMER,
    RecordTypeEnum,
    FieldDictionary,
    idSearchOptions,
    SearchOperatorEnum, 
} from "./utils/api";
import { SALES_ORDER_PARSE_OPTIONS as SO_OPTIONS } from './parse_configurations/salesorder/salesOrderParseDefinition';
import * as customerConstants from './parse_configurations/customer/customerConstants';
import * as soConstants from './parse_configurations/salesorder/salesOrderConstants';
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { RadioFieldBoolean, RADIO_FIELD_TRUE, isNonEmptyArray } from './utils/typeValidation';
import { ENTITY_RESPONSE_OPTIONS, CONTACT_RESPONSE_OPTIONS, 
    processEntityFiles, EntityProcessorOptions, EntityProcessorStageEnum
} from './entityProcessor';
import { ParseManager } from './ParseManager';

async function main() {
    const entityType = EntityRecordTypeEnum.CUSTOMER;
    const ALL_CUSTOMERS = [
        customerConstants.FIRST_PART_FILE, 
        customerConstants.SECOND_PART_FILE, 
        customerConstants.THIRD_PART_FILE
    ];
    const customerFilePaths = [
        // customerConstants.SUBSET_FILE,
        ...ALL_CUSTOMERS
    ];
    const options: EntityProcessorOptions = {
        clearLogFiles: [
            DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
        ],
        // outputDir: CLOUD_LOG_DIR,
        // stopAfter: EntityProcessorStageEnum.CONTACTS,
    }
    await processEntityFiles(entityType, customerFilePaths, options);

    trimFile(undefined, DEFAULT_LOG_FILEPATH);
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});



/*

    const filePath = soConstants.SMALL_SUBSET_FILE;
    const parseOptions: ParseOptions = {
        [RecordTypeEnum.SALES_ORDER]: SO_OPTIONS,
    }
    const parseResults = await parseRecordCsv(filePath, parseOptions);
    write(parseResults, path.join(CLOUD_LOG_DIR, 'SO_ParseResults.json'));
*/

const entityId: FieldEvaluator = (
    row: Record<string, any>, 
    context: EvaluationContext, 
    entityIdColumn: string
): string => {
        return '';
}
const testParseOptions: ParseOptions = {
    [RecordTypeEnum.CUSTOMER]: {
        keyColumn: 'Customer',
        fieldOptions: {
            // isperson: {
            //     dependencies: [], priority: 1, cache: true, evaluator: (row, context}}
            entityid: {
                dependencies: [], priority: 1, cache: true, evaluator: entityId 
            } as FieldParseOptions
        },
        sublistOptions: {}
    },
}

function test_ParseManager() {}