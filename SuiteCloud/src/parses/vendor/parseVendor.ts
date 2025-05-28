/**
 * @file src/parses/vendor/parseVendor.ts
 */
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "src/config/setupLog";
import { 
    readJsonFileAsObject as read, 
    writeObjectToJson as write, 
} from "../../utils/io";
import { parseEntityFile } from "../parseEntity";
import {
    ParseResults, 
    PostRecordOptions, 
    BatchPostRecordRequest, 
    BatchPostRecordResponse, 
    PostRecordResult, 
    SetFieldValueOptions,
    FieldDictionary,
    RecordTypeEnum,
} from "src/utils/api/types";
import { 
    PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS as VENDOR_OPTIONS, 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS
} from "./vendorParseDefinition";
import { DELAY, SCRIPT_ENVIRONMENT as SE, STOP_RUNNING, DATA_DIR, OUTPUT_DIR } from "src/config/env";
import { parseCsvToPostRecordOptions } from "src/parseCsvToRequestBody";
import { partitionArrayBySize, SB_REST_SCRIPTS, BATCH_SIZE, postRecordPayload } from "src/utils/api/callApi";


/** = `['entityid', 'companyname', 'isperson', 'email']` */
const ENTITY_RESPONSE_PROPS = ['entityid', 'isperson', 'companyname', 'email'];
/** = `['entityid', 'company', 'firstname', 'lastname', 'email']` */
const CONTACT_RESPONSE_PROPS = ['entityid', 'company', 'firstname', 'lastname', 'email'];
/** 
 * @deprecated see {@link parseEntityFile}`()` <-------------------
 * contact creation has field dependencies on vendor creation, 
 * so we need to create the vendors first.
 * @param filePath - path to the local csv file containing the vendor data 
 */
export async function parseVendorFile(
    filePath: string
): Promise<void> {
    if (!filePath) {
        log.error('No file path provided. returning...');
        return;
    }
    try {
        const parseResults = await parseCsvToPostRecordOptions(filePath, [VENDOR_OPTIONS, CONTACT_OPTIONS]) as ParseResults;
        const vendors = parseResults[RecordTypeEnum.VENDOR]?.validPostOptions as PostRecordOptions[];
        const contacts = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];

        if (vendors.length === 0 || contacts.length === 0) {
            log.error('No vendors and no contacts were parsed from the CSV file. Exiting...');
            STOP_RUNNING(1);
        }
    } catch (error) {
        log.error('Error parsing CSV to PostRecordOptions:', error);
    }
}