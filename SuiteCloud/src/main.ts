import { 
    readJsonFileAsObject as read, 
    writeObjectToJson as write, 
} from "./utils/io";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, SCRIPT_ENVIRONMENT as SE, DELAY } from "./config/env";
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "./config/setupLog";
import { 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS,
    PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS as CUSTOMER_OPTIONS 
} from "./utils/parses/customer/customerParseDefinition";
import { RecordTypeEnum, PostRecordOptions, BatchPostRecordRequest, BatchPostRecordResponse,
    idPropertyEnum, PostRecordResult, SetFieldValueOptions, FieldDictionary, 
    ParseResults, SetSubrecordOptions,
    SublistFieldDictionary,
    SublistDictionary,
    SetSublistValueOptions,
    ContactRoleEnum
} from "./utils/api/types";
import { parseCsvToPostRecordOptions } from './parseCsvToRequestBody';
import { SB_REST_SCRIPTS, BATCH_SIZE, postRecordPayload, partitionArrayBySize } from "./utils/api/callApi";
import path from 'node:path';
import { RADIO_FIELD_TRUE, RadioFieldBoolean } from "./utils/typeValidation";

const CUSTOMER_DIR = `${DATA_DIR}/customers` as string;
const SINGLE_COMPANY_FILE = `${CUSTOMER_DIR}/company.tsv` as string;
const SINGLE_HUMAN_FILE = `${CUSTOMER_DIR}/human.tsv` as string;
const SUBSET_FILE = `${CUSTOMER_DIR}/subset.tsv` as string;
// const SMALL_SUBSET_FILE = `${CUSTOMER_DIR}/small_subset.tsv` as string;
const COMPLETE_FILE = `${CUSTOMER_DIR}/customer.tsv` as string;
const POST_SCRIPT_ID = SB_REST_SCRIPTS.POST_BatchUpsertRecord.scriptId as number;
const POST_DEPLOY_ID = SB_REST_SCRIPTS.POST_BatchUpsertRecord.deployId as number;

async function main() {
    await parseCustomerFile(SINGLE_COMPANY_FILE);
    STOP_RUNNING(0, 'end of main()');
}
main().catch(error => {
    log.error('Error executing main() function:', Object.keys(error));
    write({error: error}, 'main_error.json', OUTPUT_DIR)
    STOP_RUNNING(1);
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
    let debugArr: any[] = [];
    try {
        const parseResults = await parseCsvToPostRecordOptions(filePath, [CUSTOMER_OPTIONS, CONTACT_OPTIONS]) as ParseResults;
        const customers = parseResults[RecordTypeEnum.CUSTOMER]?.validPostOptions as PostRecordOptions[];
        const contacts = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];
        // log.debug('customers.length:', customers.length, 'contacts.length:', contacts.length);
        debugArr.push(`Parse Results:`,
            TAB + `           customers.length: ${customers.length}`,
            // TAB + `num invalid customer parses: ${parseResults[RecordTypeEnum.CUSTOMER]?.invalidParseOptions.length}`,
            TAB + `            contacts.length: ${contacts.length}`,
            // TAB + ` num invalid contact parses: ${parseResults[RecordTypeEnum.CONTACT]?.invalidParseOptions.length}`
        );
        // write({ invalidCustomers: parseResults[RecordTypeEnum.CUSTOMER]?.invalidParseOptions}, 'customer_invalid_parse_options.json', OUTPUT_DIR);
        // write({ invalidContacts: parseResults[RecordTypeEnum.CONTACT]?.invalidParseOptions}, 'contact_invalid_parse_options.json', OUTPUT_DIR);
        // STOP_RUNNING(0, `let's check the parse results...`);
        if (customers.length === 0 && contacts.length === 0) {
            log.error('No customers and no contacts were parsed from the CSV file. Exiting...');
            STOP_RUNNING(1);
        }
        const customerBatches: PostRecordOptions[][] = partitionArrayBySize(customers, BATCH_SIZE);
        const customerResults: PostRecordResult[] = [];
        for (let i = 0; i < customerBatches.length; i++) {
            const payload: BatchPostRecordRequest = {
                upsertRecordArray: customerBatches[i],
                responseProps: ['entityid', 'companyname', 'isperson', 'email']
            }
            const res = await postRecordPayload(
                payload, POST_SCRIPT_ID, POST_DEPLOY_ID
            );
            const customerResData = await res.data as BatchPostRecordResponse;        
            if(!customerResData) {
                log.error(`customerRes.data is undefined at partition index ${i}.`);
                continue;
            }
            customerResults.push(...customerResData.results as PostRecordResult[]);
            await DELAY(1000, `finished customer batch ${i+1} of ${customerBatches.length}`);
        }        
        debugArr.push(`\n Customer Post Results:`,
            TAB + `      customers.length: ${customers.length}`,
            TAB + `customerResults.length: ${customerResults.length}`
        );
        if (customerResults.length === 0) {
            log.error('customerResults.length === 0 -> No customers were created. Exiting before making contacts...');
            STOP_RUNNING(1);
        }
        const { validContacts, removedContacts } 
            = matchContactsToEntityResults(contacts, customerResults);
        const contactBatches: PostRecordOptions[][] = partitionArrayBySize(validContacts, BATCH_SIZE);
        const contactResults: PostRecordResult[] = [];
        for (let i = 0; i < contactBatches.length; i++) {
            const contactPayload: BatchPostRecordRequest = {
                upsertRecordArray: contactBatches[i],
                responseProps: ['entityid', 'company', 'firstname', 'lastname', 'email']
            }
            const contactRes = await postRecordPayload(
                contactPayload, POST_SCRIPT_ID, POST_DEPLOY_ID
            );
            const contactResData = await contactRes.data as BatchPostRecordResponse;
            if(!contactResData) {
                log.error(`contactRes.data is undefined at batch index ${i}.`);
                continue;
            }
            contactResults.push(...contactResData.results as PostRecordResult[]);
            await DELAY(1000, 
                `finished contact batch ${i+1} of ${contactBatches.length}\n`,
                `now attempting to update the customer records with contactrole=primary after making the customer's contact`);
            const updateCustomerBatch: PostRecordOptions[] = [];
            for (let contactResult of contactResults) {
                updateCustomerBatch.push({
                    recordType: RecordTypeEnum.CUSTOMER,
                    fieldDict: {
                        valueFields: [
                            { // included so REST script can use as search term
                                fieldId: idPropertyEnum.INTERNAL_ID, 
                                value: contactResult?.company // contactResult.company = customer's internalid
                            },
                            { // (maybe redundant) included so REST script can use as search term
                                fieldId: idPropertyEnum.ENTITY_ID, 
                                value: contactResult?.entityid 
                            },
                            { // new value to update customer with
                                fieldId: 'contact', 
                                value: contactResult?.internalId 
                            }
                        ]
                    },
                    sublistDict: {
                        contactroles: { 
                            valueFields: [
                                { sublistId: 'contactroles', line: 0 , fieldId: 'role', value: ContactRoleEnum.PRIMARY_CONTACT },
                                { sublistId: 'contactroles', line: 0 , fieldId: 'contact', value: contactResult?.internalId  }
                            ] as SetSublistValueOptions[] 
                        } as SublistFieldDictionary
                    } as SublistDictionary
                } as PostRecordOptions);
            }
            const updateCustomerRes = await postRecordPayload(
                { 
                    upsertRecordArray: updateCustomerBatch,
                    responseProps: ['entityid', 'companyname', 'isperson', 'email'] 
                } as BatchPostRecordRequest, 
                POST_SCRIPT_ID, POST_DEPLOY_ID
            )
            log.debug(`Update Customers Response:`,
                TAB + `res.status: ${updateCustomerRes.status}`,
                TAB + `res.message ${updateCustomerRes.message}`,
                TAB + `res.error ${updateCustomerRes.error}`,
              //  `...updateCustomerRes.data`, updateCustomerRes.data
            );
        }
        debugArr.push(`\n Contact Post Results:`,
            TAB + `      contacts.length: ${contacts.length}`,
            TAB + `num Company Customers: ${countCompanyCustomers(customers)}`, 
            TAB + ` validContacts.length: ${validContacts.length}`,
            TAB + `contactResults.length: ${contactResults.length}`
        );
        log.debug(...debugArr);
        write({ customers: customers}, 'customer_options.json', OUTPUT_DIR);
        write({validContacts: validContacts}, 'contact_options.json', OUTPUT_DIR);
        write({removed: removedContacts}, `removed_contacts.json`, OUTPUT_DIR);

        write({ customerResults: customerResults }, 'customer_results.json', OUTPUT_DIR);
        write({ contactResults: contactResults }, 'contact_results.json', OUTPUT_DIR);

        // make request for customerRecord.setSublistValue({fieldId: 'contact', value: ${the internalid returned in contact results 
        // for the entry with contactResult.company === customerResult.internalId}})
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
    removedContacts: PostRecordOptions[],
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
            log.debug(`contactCompany is undefined -> isPerson(entity)===true -> no need to worry about the select field. continuing...`);
            removedContacts.push(contact);
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