/**
 * @file src/main.ts
 */
import path from 'node:path';
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    parseCsvForOneToMany
} from "./utils/io";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, CLOUD_LOG_DIR, 
    SCRIPT_ENVIRONMENT as SE, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS, 
    indentedStringify, DEFAULT_LOG_FILEPATH, clearLogFile,
    ERROR_LOG_FILEPATH
} from "./config";
import { parseEntityFile, postEntities, postContacts, matchContactsToPostEntityResponses, countCompanyEntities, postEntitiesAndContacts, generateEntityUpdates, getPostResults } from "./parses/parseEntity";
import { 
    EntityRecordTypeEnum, PostRecordOptions, PostRecordRequest, PostRecordResponse, RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload, getRecordById, GetRecordResponse,
    ScriptDictionary, SAMPLE_POST_CUSTOMER_OPTIONS as SAMPLE_CUSTOMER,
    RecordTypeEnum, 
} from "./utils/api";
import { CUSTOMER_PARSE_OPTIONS, CONTACT_PARSE_OPTIONS } from "src/parses/customer/customerParseDefinition"
import * as customerFiles from './parses/customer/customerConstants';
import { parseRecords } from "./csvParser";
import { ParseOptions, ParseResults, RecordParseOptions } from './utils/io';
/**
 * - goal: read a salesorder tsv -> parse customers, contacts, addresses
 * - post entities and customers
 * - get customer internalids and use as RecordRef when making salesorder
 * - - in salesorder shipgroup sublist, figure out how to select address from available addresses.
 */


/**
 * 
 */
async function main() {
    clearLogFile(DEFAULT_LOG_FILEPATH, ERROR_LOG_FILEPATH)
    mlog.info(`Start of main()`);
    const parseOptions: ParseOptions = {
        [RecordTypeEnum.CUSTOMER]: CUSTOMER_PARSE_OPTIONS,
        [RecordTypeEnum.CONTACT]: CONTACT_PARSE_OPTIONS
    }
    const results: ParseResults = await parseRecords(
        customerFiles.SINGLE_COMPANY_FILE, parseOptions
    );
    write(results, path.join(OUTPUT_DIR, 'test_parseRecords_SingleCompany.json'));
    mlog.info(`End of main()`);
    STOP_RUNNING(0);
}
main().catch(error => {
    mlog.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});
/** 
 * {@link RecordResponseOptions}
 * - `responseFields: ['entityid', 'companyname', 'email']` 
 * - `responseSublists: { 'addressbook': [...] }` 
 * */
const entityResponseOptions: RecordResponseOptions = {
    responseFields: ['entityid', 'companyname', 'email'],
    responseSublists: { 'addressbook': [
        'addressid', 'label', 'defaultbilling', 'defaultshipping', // 'addressbookaddress'
    ] }
};
async function test_getRecordById() {
    mlog.debug(`Start of test_getRecordById()`);
    const recordType = EntityRecordTypeEnum.CUSTOMER;
    // mlog.debug(`recordType: ${recordType}`);
    const id = 41810;
    // mlog.debug(`recordInternalId: ${id}`);
    const response = await getRecordById(
        recordType, id, undefined, entityResponseOptions
    ) as GetRecordResponse;
    write(response, path.join(OUTPUT_DIR, 'test_getRecordById_Response.json'));
    mlog.debug(`End of test_getRecordById()`);
}

async function test_upsertRecordPayload() {
    const payload: PostRecordRequest = {
        postOptions: [SAMPLE_CUSTOMER] as PostRecordOptions[],
        responseOptions: entityResponseOptions,
    };
    const responses = await upsertRecordPayload(payload) as PostRecordResponse[];
    mlog.debug(`End of testUpsertRecordPayload()`);
    write(responses, path.join(OUTPUT_DIR, 'test_upsertRecordPayload_Response.json'));
}