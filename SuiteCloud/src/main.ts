import { 
    readJsonFileAsObject as read, 
    writeObjectToJson as write, 
} from "./utils/io";
import { POST } from "./utils/api";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY } from "./config/env";
import { mainLogger as log } from "./config/setupLog";
import { getAccessToken, TokenResponse } from "./server";
import { 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS,
    PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS as CUSTOMER_OPTIONS 
} from "./utils/parses/customer/customerParseDefinition";
import { RecordTypeEnum, PostRecordOptions, BatchPostRecordRequest, BatchPostRecordResponse,
    idPropertyEnum, PostRecordResult, SetFieldValueOptions, FieldDictionary 
} from "./utils/api/types";
import { parseCsvToPostOptions } from './parseCsvToRequestBody';
import { SB_REST_SCRIPTS, BATCH_SIZE, postPayload, partitionArrayBySize } from "./utils/api/callApi";
import { ScriptDictionary } from "./utils/api/types/NS/SuiteScriptEnvironment";
import path from 'node:path';
import { RADIO_FIELD_TRUE, RadioFieldBoolean } from "./utils/typeValidation";

const CUSTOMER_DIR = `${DATA_DIR}/customers` as string;
const SINGLE_COMPANY_FILE = `${CUSTOMER_DIR}/company.tsv` as string;
const SINGLE_HUMAN_FILE = `${CUSTOMER_DIR}/human.tsv` as string;
const SUBSET_FILE = `${CUSTOMER_DIR}/subset.tsv` as string;
// const SMALL_SUBSET_FILE = `${CUSTOMER_DIR}/small_subset.tsv` as string;
const COMPLETE_FILE = `${CUSTOMER_DIR}/customer.tsv` as string;
const POST_SCRIPT_ID = Number(SB_REST_SCRIPTS.POST_BatchUpsertRecord.scriptId);
const POST_DEPLOY_ID = Number(SB_REST_SCRIPTS.POST_BatchUpsertRecord.deployId);

async function main() {
    await parseCustomerFile(SINGLE_COMPANY_FILE);
    STOP_RUNNING(0, 'end of main()');
}
main().catch(error => {
    log.error('Error executing main() function:', error);
});

/** 
 * contact record has a `select` field for company,
 * - if a customer is a company, then the associated `contact.company` field should be set to the customer's `internalid`
 * - ...so let's make the customers first and get their internalids in the Post Response
 * @param filePath - path to the local csv file containing the vendor data 
 */
async function parseCustomerFile(
    filePath: string
): Promise<void> {
    if (!filePath) {
        log.error('No file path provided. returning...');
        return;
    }
    try {
        const customers = await parseCsvToPostOptions(filePath, [CUSTOMER_OPTIONS]) as PostRecordOptions[];
        const contacts = await parseCsvToPostOptions(filePath, [CONTACT_OPTIONS]) as PostRecordOptions[];
        log.debug('customers.length:', customers.length, 'contacts.length:', contacts.length);
        write({ customers: customers}, 'customer_options.json', OUTPUT_DIR);
        write({ contacts: contacts}, 'contact_options.json', OUTPUT_DIR);
        const customerBatches: PostRecordOptions[][] = partitionArrayBySize(customers, BATCH_SIZE);
        const customerResults: PostRecordResult[] = [];
        for (let i = 0; i < customerBatches.length; i++) {
            const payload: BatchPostRecordRequest = {
                upsertRecordArray: customerBatches[i],
                responseProps: ['entityid', 'isperson']
            }
            const res = await postPayload(
                payload, POST_SCRIPT_ID, POST_DEPLOY_ID
            );
            const customerResData = await res.data as BatchPostRecordResponse;        
            if(!customerResData) {
                log.error(`customerRes.data is undefined at partition index ${i}.`);
                continue;
            }
            customerResults.push(...customerResData.results as PostRecordResult[]);
            await DELAY(2000, `finished customer batch ${i+1} of ${customerBatches.length}`);
        }        
        log.debug(`Customer Results:`,
            `\n\t       customers.length: ${customers.length}`,
            `\n\t customerResults.length: ${customerResults.length}`
        );
        const { validContacts, removedContacts } 
            = matchContactsToEntityResults(contacts, customerResults);
        const contactBatches: PostRecordOptions[][] = partitionArrayBySize(validContacts, BATCH_SIZE);
        const contactResults: PostRecordResult[] = [];
        for (let i = 0; i < contactBatches.length; i++) {
            const contactPayload: BatchPostRecordRequest = {
                upsertRecordArray: contactBatches[i],
                responseProps: ['entityid', 'firstname', 'lastname']
            }
            const contactRes = await postPayload(
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
            `\n\t   numCompanyCustomers: ${countCompanyCustomers(customers)}`, 
            `\n\t  validContacts.length: ${validContacts.length}`,
            `\n\t contactResults.length: ${contactResults.length}`
        );
        write({removed: removedContacts}, `removed_contacts.json`, OUTPUT_DIR);
        return;

    } catch (error) {
        log.error('main.ts parseCustomerFile() Error parsing customer file:', error);
        throw error;
    }
}
/**
 * 
 * @param customers `Array<`{@link PostRecordOptions}`>`
 * @returns `numCompanyCustomers` - `number`
 */
function countCompanyCustomers(customers: PostRecordOptions[]): number {
    let numCompanyCustomers = 0;
    for (let i = 0; i < customers.length; i++) {
        const customer: PostRecordOptions = customers[i];
        let isPersonField = customer.fieldDict?.valueFields?.find(
            field => field.fieldId === 'isperson'
        ) as SetFieldValueOptions;
        const isPerson: RadioFieldBoolean = isPersonField?.value as RadioFieldBoolean;
        if (isPerson === RADIO_FIELD_TRUE) {
            continue;
        } // else, this customer {PostRecordOptions} is a company
        numCompanyCustomers++;
    }
    return numCompanyCustomers;
}

/**
 * @description match internalids of entity results to contacts
 * @param contacts `Array<`{@link PostRecordOptions}`>`
 * @param entityResults `Array<`{@link PostRecordResult}`>`
 * @returns `{ validContacts: Array<`{@link PostRecordOptions}`>, removedContacts: Array<`{@link PostRecordOptions}`> }`
 * - `validContacts`: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - `removedContacts`: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
function matchContactsToEntityResults(
    contacts: PostRecordOptions[], 
    entityResults: PostRecordResult[]
): {
    validContacts: PostRecordOptions[], 
    removedContacts: PostRecordOptions[]
} {
    const removedContacts: PostRecordOptions[] = [];
    const validContacts: PostRecordOptions[] = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact: PostRecordOptions = contacts[i];
        let contactCompanyField = contact.fieldDict?.valueFields?.find(
            field => field.fieldId === 'company'
        ) as SetFieldValueOptions;
        const contactCompany: string = contactCompanyField?.value as string;
        if (!contactCompany) {
            log.debug(`contactCompany is undefined (isPerson(entity)===true), so no need to worry about the select field. continuing...`);
            validContacts.push(contact);
            continue;
        }
        let entityInternalId = entityResults.find(
            entityResult => entityResult?.entityid === contactCompany
        )?.internalId;
        if (!entityInternalId) {
            log.warn(`entityInternalId is undefined for contact with company '${contactCompany}' at contacts[index=${i}]. Adding to removedContacts.`);
            removedContacts.push(contact);
            continue;
        }
        contactCompanyField.value = entityInternalId;
        validContacts.push(contact);
    }
    return {
        validContacts: validContacts,
        removedContacts: removedContacts
    };
}