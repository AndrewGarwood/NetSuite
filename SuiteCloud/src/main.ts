/**
 * @file src/main.ts
 */
import * as fs from "fs";
import path from "node:path";
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    ValidatedParseResults,
    ProcessParseResultsOptions, ParseOptions, ParseResults,
    getCurrentPacificTime, FieldParseOptions, FieldDictionaryParseOptions, FieldEvaluator,
    SublistDictionaryParseOptions, SublistLineParseOptions,
    SublistLineIdOptions, SubrecordParseOptions, EvaluationContext, RowContext, 
    RecordKeyOptions, getCsvRows, HierarchyOptions, GroupReturnTypeEnum, 
    RowDictionary, extractSku,
    trimFile, validatePath,
} from "./utils/io";
import { 
    STOP_RUNNING, CLOUD_LOG_DIR, DATA_DIR,
    SCRIPT_ENVIRONMENT as SE, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL,
    indentedStringify, DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, clearFile,
    ERROR_LOG_FILEPATH,
    ERROR_DIR
} from "./config";
import { 
    EntityRecordTypeEnum, RecordOptions, RecordRequest, RecordResponse, RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload, getRecordById, GetRecordResponse, GetRecordRequest,
    RecordTypeEnum,
    FieldDictionary,
    idSearchOptions,
    SearchOperatorEnum, 
} from "./utils/api";
import { SALES_ORDER_PARSE_OPTIONS as SO_PARSE_OPTIONS, 
    SALES_ORDER_POST_PROCESSING_OPTIONS as SALES_ORDER_POST_PROCESSING_OPTIONS 
} from "./parse_configurations/salesorder/salesOrderParseDefinition";
import * as customerConstants from "./parse_configurations/customer/customerConstants";
import * as soConstants from "./parse_configurations/salesorder/salesOrderConstants";
import { 
    processEntityFiles, EntityProcessorOptions, EntityProcessorStageEnum
} from "./entityProcessor";
import { processTransactionFiles, 
    TransactionProcessorOptions, 
    TransactionProcessorStageEnum, TransactionEntityMatchOptions, MatchSourceEnum,
} from "./transactionProcessor";
import { ParseManager } from "./ParseManager";
import { validateFiles } from "./DataReconciler";

async function main() {
    clearFile(DEFAULT_LOG_FILEPATH);
    let dict: Record<string, string> = {};
    try {
        dict = await soConstants.getSkuDictionary();
    } catch (error) {
        mlog.error('Failed to load SKU dictionary:', error);
        STOP_RUNNING(1);
    }
    const ALL_SALES_ORDERS_DIR = path.join(soConstants.SALES_ORDER_DIR, 'all');
    const sourcePath = ALL_SALES_ORDERS_DIR;
    await validatePath(ALL_SALES_ORDERS_DIR);
    const csvFiles = (fs.readdirSync(sourcePath)
        .filter(file => file.toLowerCase().endsWith('.csv') 
            || file.toLowerCase().endsWith('.tsv'))
        .map(file => path.join(sourcePath, file))
    );
    const missingItems = await validateFiles(csvFiles, 'Item', extractSku, dict);
    const missingItemArray = Array.from(new Set(Object.values(missingItems).flat()));
    mlog.info(`Found ${missingItemArray.length} missing items across ${csvFiles.length} files.`,
        TAB + `sourcePath: '${sourcePath}'`,
        // TAB + `missing items: ${indentedStringify(missingItemArray)}`
    );
    write({missingItemsArray: missingItemArray.sort()}, path.join(CLOUD_LOG_DIR, `missingItems.json`));





    // await callTransactionProcessor(
    //     true, 
    //     soConstants.SALES_ORDER_LOG_DIR, 
    //     // TransactionProcessorStageEnum.VALIDATE
    // );
    trimFile(5, DEFAULT_LOG_FILEPATH);
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});
// const request: GetRecordRequest = {
//     recordType: RecordTypeEnum.SALES_ORDER,
//     idOptions:[{idProp: idPropertyEnum.EXTERNAL_ID, searchOperator: SearchOperatorEnum.TEXT.IS, idValue: 'SO:335745_NUM:24-31127_PO:16835(INVOICE)&lt;salesorder&gt;'}],
//     responseOptions: {
//         responseFields: ['externalid', 'tranid', 'entity', 'trandate', 'orderstatus'],
//     }
// }
// const response: GetRecordResponse = await getRecordById(request);
// mlog.debug(`GetRecordResponse: ${indentedStringify(response)}`);
async function callTransactionProcessor(
    useSubset: boolean = true,
    outputDir?: string,
    stopAfter?: TransactionProcessorStageEnum
): Promise<void> {
    const transactionFilePaths = (useSubset 
        ? [soConstants.SINGLE_ORDER_FILE]
        : [soConstants.SMALL_SUBSET_FILE]
    );
    const parseOptions: ParseOptions = { 
        [RecordTypeEnum.SALES_ORDER]: SO_PARSE_OPTIONS 
    };
    const postProcessingOptions: ProcessParseResultsOptions = {
        [RecordTypeEnum.SALES_ORDER]: SALES_ORDER_POST_PROCESSING_OPTIONS
    };
    const tranType = RecordTypeEnum.SALES_ORDER;
    const matchOptions: TransactionEntityMatchOptions = {
        entityType: EntityRecordTypeEnum.CUSTOMER,
        entityFieldId: 'entity',
        matchMethod: MatchSourceEnum.API
    }
    const options: TransactionProcessorOptions = {
        parseOptions,
        postProcessingOptions,
        matchOptions,
        clearLogFiles: [
            DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
        ],
        outputDir, 
        stopAfter
    }
    await processTransactionFiles(tranType, transactionFilePaths, options);
}

async function callEntityProcessor(
    useSubset: boolean = true,
    outputDir?: string,
    stopAfter?: EntityProcessorStageEnum
): Promise<void> {
    const entityType = EntityRecordTypeEnum.CUSTOMER;
    const ALL_CUSTOMERS = [
        customerConstants.FIRST_PART_FILE, 
        customerConstants.SECOND_PART_FILE, 
        customerConstants.THIRD_PART_FILE
    ];
    const customerFilePaths = (useSubset 
        ? [customerConstants.SUBSET_FILE]
        : ALL_CUSTOMERS
    );
    const options: EntityProcessorOptions = {
        clearLogFiles: [
            DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, ERROR_LOG_FILEPATH
        ],
        outputDir, 
        stopAfter
    }
    await processEntityFiles(entityType, customerFilePaths, options);
}



/*

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

export { callEntityProcessor, callTransactionProcessor}