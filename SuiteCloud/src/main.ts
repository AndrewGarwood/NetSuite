import { readJsonFileAsObject as read, writeObjectToJson as write, 
} from "./utils/io";
import { callPostRestletWithPayload, callGetRestletWithParams, 
} from "./utils/api";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, SCRIPT_ENVIORNMENT as SE, DELAY } from "./config/env";
import { mainLogger as log } from "./config/setupLog";
import { getAccessToken } from "./server/authServer";
import { TokenResponse } from "./server/types/TokenResponse";
import { RecordTypeEnum, UpsertRecordOptions, BatchUpsertRecordRequest, BatchUpsertRecordResponse,
    CreateRecordOptions, BatchCreateRecordRequest, RetrieveRecordByIdRequest, RetrieveRecordByIdResponse, 
    idPropertyEnum, BatchCreateRecordResponse, PostRecordResult, SetFieldValueOptions, FieldDictionary 
} from "./utils/api/types";
import { parseCsvToCreateOptions } from './parseCsvToRequestBody';
import { 
    PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS as VENDOR_OPTIONS, 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS
} from "./utils/parses/vendor_contact/vendorParseDefinition";
import { ScriptDictionary } from "./utils/api/types/NS/SuiteScriptEnvironment";
import path from 'node:path';

const BATCH_SIZE = 100;
const VENDOR_DIR = `${DATA_DIR}/vendors` as string;
const SINGLE_COMPANY_FILE = `${VENDOR_DIR}/single_company_vendor.tsv` as string;
const SINGLE_HUMAN_FILE = `${VENDOR_DIR}/single_human_vendor.tsv` as string;
const SUBSET_FILE = `${VENDOR_DIR}/vendor_subset.tsv` as string;
const SMALL_SUBSET_FILE = `${VENDOR_DIR}/smaller_vendor_subset.tsv` as string;
const COMPLETE_FILE = `${VENDOR_DIR}/vendor.tsv` as string;

const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;



async function main() {
    await parseVendorFile(SMALL_SUBSET_FILE);
    STOP_RUNNING(0, 'end of main()');
}
main().catch(error => {
    log.error('Error executing main() function:', error);
});
/** 
 * contact creation has field dependencies on vendor creation, 
 * so we need to create the vendors first.
 * @param filePath - path to the local csv file containing the vendor data 
 */
async function parseVendorFile(
    filePath: string
): Promise<void> {
    try {
        const vendors = await parseCsvToCreateOptions(filePath, [VENDOR_OPTIONS]) as UpsertRecordOptions[];
        const contacts = await parseCsvToCreateOptions(filePath, [CONTACT_OPTIONS]) as UpsertRecordOptions[];
        write({ vendors: vendors}, 'vendors_option_array.json', OUTPUT_DIR);
        write({ contacts: contacts}, 'contacts_option_array.json', OUTPUT_DIR);

        if (vendors.length === 0 || contacts.length === 0) {
            log.error('No vendors and no contacts were parsed from the CSV file. Exiting...');
            STOP_RUNNING(1);
        }
        const scriptId = Number(SB_REST_SCRIPTS.POST_BatchUpsertRecord.scriptId);
        const deployId = Number(SB_REST_SCRIPTS.POST_BatchUpsertRecord.deployId);

        const vendorBatches: UpsertRecordOptions[][] = partitionArrayBySize(vendors, BATCH_SIZE);
        const vendorResults: PostRecordResult[] = [];
        for (let i = 0; i < vendorBatches.length; i++) {
            const vendorPayload: BatchUpsertRecordRequest = {
                upsertRecordArray: vendorBatches[i],
                responseProps: ['entityid', 'isperson']
            }
            const vendorRes = await callBatchRecord_POST(
                vendorPayload, scriptId, deployId
            );
            const vendorResData = await vendorRes.data as BatchUpsertRecordResponse;        
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
        const removedContacts: UpsertRecordOptions[] = [];
        const validContacts: UpsertRecordOptions[] = [];

        contacts.forEach((contact: UpsertRecordOptions, index: number) => {
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
        const contactBatches: UpsertRecordOptions[][] = partitionArrayBySize(validContacts, BATCH_SIZE);
        const contactResults: PostRecordResult[] = [];
        for (let i = 0; i < contactBatches.length; i++) {
            const contactPayload: BatchUpsertRecordRequest = {
                upsertRecordArray: contactBatches[i],
                responseProps: ['entityid', 'firstname', 'lastname']
            }
            const contactRes = await callBatchRecord_POST(
                contactPayload, scriptId, deployId
            );
            const contactResData = await contactRes.data as BatchUpsertRecordResponse;
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
            `\n\t contactResults.length: ${contactResults.length}`);
        write({removed: removedContacts}, `subset_removed_contact.json`, OUTPUT_DIR);
    } catch (error) {
        log.error('Error parsing CSV to UpsertRecordOptions:', error);
    }
}

async function callBatchRecord_POST(
    payload: BatchCreateRecordRequest, 
    scriptId: number, 
    deployId: number,
): Promise<any> {
    let accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('callBatchCreateRecord() getAccessToken() is undefined. Cannot call RESTlet.');
        STOP_RUNNING();
    }
    try {
        const res = await callPostRestletWithPayload(
            accessToken,
            scriptId,
            deployId,
            payload,
        );
        return res;
    } catch (error) {
        log.error('Error in main.ts callBatchRecord_POST()', error);
        throw error;
    }
}

async function callRetrieveRecordById(
    payload: RetrieveRecordByIdRequest,
    scriptId: number=Number(SB_REST_SCRIPTS.GET_RetrieveRecordById.scriptId),
    deployId: number=Number(SB_REST_SCRIPTS.GET_RetrieveRecordById.deployId),
): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('accessToken is undefined. Cannot call RESTlet.');
        STOP_RUNNING();
    }
    try {
        const res = await callGetRestletWithParams(
            accessToken,
            scriptId,
            deployId,
            payload,
        )
        return res;
    } catch (error) {
        log.error('Error in main.ts callRetrieveRecordById()', error);
        throw error;
    }
}


/**
 * 
 * @param {Array<any>} arr `Array<any>`
 * @param {number} batchSize `number`
 * @returns {Array<Array<any>>} `batches` — `Array<Array<any>>`
 */
function partitionArrayBySize(arr: Array<any>, batchSize: number): Array<Array<any>> {
    let batches = [];
    for (let i = 0; i < arr.length; i += batchSize) {
        batches.push(arr.slice(i, i + batchSize));
    }
    return batches;
}