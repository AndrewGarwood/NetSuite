/**
 * @file src/main.ts
 */
import path from 'node:path';
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    ValidatedParseResults,
    ProcessParseResultsOptions, ParseOptions, ParseResults,
    getCurrentPacificTime
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
import { CUSTOMER_PARSE_OPTIONS, CONTACT_PARSE_OPTIONS, 
    CONTACT_CUSTOMER_POST_PROCESSING_OPTIONS as POST_PROCESSING_OPTIONS 
} from "src/parses/customer/customerParseDefinition"
import * as customerConstants from './parses/customer/customerConstants';
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { RadioFieldBoolean, RADIO_FIELD_TRUE, isNonEmptyArray } from './utils/typeValidation';
import { ENTITY_RESPONSE_OPTIONS, CONTACT_RESPONSE_OPTIONS } from './entityProcessor';

const ALL_CUSTOMERS = [
    customerConstants.FIRST_PART_FILE, 
    customerConstants.SECOND_PART_FILE, 
    customerConstants.THIRD_PART_FILE
];
async function main() {

}
main().catch(error => {
    mlog.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});

async function test_getRecordById() {
    mlog.debug(`Start of test_getRecordById()`);
    const recordType = EntityRecordTypeEnum.CUSTOMER;
    // mlog.debug(`recordType: ${recordType}`);
    const id = 41810;
    // mlog.debug(`recordInternalId: ${id}`);
    const response = await getRecordById(
        recordType, id, undefined, ENTITY_RESPONSE_OPTIONS
    ) as GetRecordResponse;
    write(response, path.join(OUTPUT_DIR, 'test_getRecordById_Response.json'));
    mlog.debug(`End of test_getRecordById()`);
}

async function test_upsertRecordPayload() {
    const payload: RecordRequest = {
        postOptions: [SAMPLE_CUSTOMER] as RecordOptions[],
        responseOptions: ENTITY_RESPONSE_OPTIONS,
    };
    const responses = await upsertRecordPayload(payload) as RecordResponse[];
    mlog.debug(`End of testUpsertRecordPayload()`);
    write(responses, path.join(OUTPUT_DIR, 'test_upsertRecordPayload_Response.json'));
}