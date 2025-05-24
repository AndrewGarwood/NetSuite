/**
 * @file src/utils/parses/vendor/parseVendor.ts
 */
import { mainLogger as log } from "src/config/setupLog";
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
 * @deprecated see {@link parseEntityFile}`()`
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

        const vendorResults: PostRecordResult[] = [];
        const vendorResponses: any[] = await postRecordPayload({
            upsertRecordArray: vendors,
            responseProps: ENTITY_RESPONSE_PROPS
        } as BatchPostRecordRequest);
        for (let [index, vendorRes] of Object.entries(vendorResponses)) {
            if (!vendorRes || !vendorRes.data) { // continue;
                log.error(`vendorRes.data is undefined at vendor batch index ${index}.`);
                continue;
            }
            vendorResults.push(...((vendorRes.data as BatchPostRecordResponse).results || []));
        }  
        log.debug(`Vendor Results:`,
            `\n\t      vendors.length: ${vendors.length}`,
            `\n\tvendorResults.length: ${vendorResults.length}`
        );
        const removedContacts: PostRecordOptions[] = [];
        const validContacts: PostRecordOptions[] = [];

        const contactResults: PostRecordResult[] = [];
        write({ vendors: vendors}, `${OUTPUT_DIR}parses/vendor`, 'vendor_options.json');
        write({ contacts: contacts}, `${OUTPUT_DIR}parses/vendor`, 'contact_options.json');

    } catch (error) {
        log.error('Error parsing CSV to PostRecordOptions:', error);
    }
}