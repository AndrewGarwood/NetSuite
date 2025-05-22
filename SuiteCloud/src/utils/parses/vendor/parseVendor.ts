/**
 * @file src/utils/parses/vendor/parseVendor.ts
 */
import { mainLogger as log } from "src/config/setupLog";
import { 
    readJsonFileAsObject as read, 
    writeObjectToJson as write, 
} from "../../io";
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


const VENDOR_DIR = `${DATA_DIR}/vendors` as string;
const SINGLE_COMPANY_FILE = `${VENDOR_DIR}/single_company_vendor.tsv` as string;
const SINGLE_HUMAN_FILE = `${VENDOR_DIR}/single_human_vendor.tsv` as string;
const SUBSET_FILE = `${VENDOR_DIR}/vendor_subset.tsv` as string;
const SMALL_SUBSET_FILE = `${VENDOR_DIR}/smaller_vendor_subset.tsv` as string;
const COMPLETE_FILE = `${VENDOR_DIR}/vendor.tsv` as string;
const POST_SCRIPT_ID = Number(SB_REST_SCRIPTS.POST_BatchUpsertRecord.scriptId);
const POST_DEPLOY_ID = Number(SB_REST_SCRIPTS.POST_BatchUpsertRecord.deployId);

/** 
 * contact creation has field dependencies on vendor creation, 
 * so we need to create the vendors first.
 * @param filePath - path to the local csv file containing the vendor data 
 */
export async function parseVendorFile(
    filePath: string
): Promise<void> {
    try {
        const parseResults = await parseCsvToPostRecordOptions(filePath, [VENDOR_OPTIONS, CONTACT_OPTIONS]) as ParseResults;
        const vendors = parseResults[RecordTypeEnum.VENDOR]?.validPostOptions as PostRecordOptions[];
        const contacts = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];
        write({ vendors: vendors}, 'vendor_options_array.json', OUTPUT_DIR);
        write({ contacts: contacts}, 'contact_options_array.json', OUTPUT_DIR);

        if (vendors.length === 0 || contacts.length === 0) {
            log.error('No vendors and no contacts were parsed from the CSV file. Exiting...');
            STOP_RUNNING(1);
        }

        const vendorBatches: PostRecordOptions[][] = partitionArrayBySize(vendors, BATCH_SIZE);
        const vendorResults: PostRecordResult[] = [];
        for (let i = 0; i < vendorBatches.length; i++) {
            const vendorPayload: BatchPostRecordRequest = {
                upsertRecordArray: vendorBatches[i],
                responseProps: ['entityid', 'isperson']
            }
            const vendorRes = await postRecordPayload(
                vendorPayload, POST_SCRIPT_ID, POST_DEPLOY_ID
            );
            const vendorResData = await vendorRes.data as BatchPostRecordResponse;        
            if(!vendorResData) {
                log.error(`vendorRes.data is undefined at partition index ${i}.`);
                continue;
            }
            vendorResults.push(...vendorResData.results as PostRecordResult[]);
            await DELAY(2000, `finished vendor batch ${i+1} of ${vendorBatches.length}`);
        }
        log.debug(`Vendor Results:`,
            `\n\t      vendors.length: ${vendors.length}`,
            `\n\tvendorResults.length: ${vendorResults.length}`
        );
        const removedContacts: PostRecordOptions[] = [];
        const validContacts: PostRecordOptions[] = [];

        contacts.forEach((contact: PostRecordOptions, index: number) => {
            let contactCompanyField = contact.fieldDict?.valueFields?.find(
                field => field.fieldId === 'company'
            ) as SetFieldValueOptions;
            let contactCompany = contactCompanyField?.value as string;
            if (!contactCompany) { // log.debug(`contactCompany is undefined (vendor is a person). continuing...`);
                validContacts.push(contact);
                return;
            }
            let vendorInternalId = vendorResults.find(
                vendorResult => vendorResult?.entityid === contactCompany
            )?.internalId;
            if (!vendorInternalId) {
                log.warn(`vendorInternalId is undefined for contact with company '${contactCompany}' at contacts[index=${index}]. Adding to removedContacts.`);
                removedContacts.push(contact);
                return;
            }
            contactCompanyField.value = vendorInternalId;
            validContacts.push(contact);
        });
        const contactBatches: PostRecordOptions[][] = partitionArrayBySize(validContacts, BATCH_SIZE);
        const contactResults: PostRecordResult[] = [];
        for (let i = 0; i < contactBatches.length; i++) {
            const contactPayload: BatchPostRecordRequest = {
                upsertRecordArray: contactBatches[i],
                responseProps: ['entityid', 'firstname', 'lastname']
            }
            const contactRes = await postRecordPayload(
                contactPayload, POST_SCRIPT_ID, POST_DEPLOY_ID
            );
            const contactResData = await contactRes.data as BatchPostRecordResponse;
            if(!contactResData) {
                log.error(`contactRes.data is undefined at partition index ${i}.`);
                continue;
            }
            contactResults.push(...contactResData.results as PostRecordResult[]);
            await DELAY(2000, `finished contact batch ${i+1} of ${contactBatches.length}`);
        }
        log.debug(`Contact Results:`,
            `\n\t       contacts.length: ${contacts.length}`,
            // `\n\tremovedContacts.length: ${removedContacts.length}`, 
            `\n\t  validContacts.length: ${validContacts.length}`,
            `\n\t contactResults.length: ${contactResults.length}`
        );
        write({removed: removedContacts}, `subset_removed_contact.json`, OUTPUT_DIR);
    } catch (error) {
        log.error('Error parsing CSV to UpsertRecordOptions:', error);
    }
}