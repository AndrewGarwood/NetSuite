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
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, CLOUD_LOG_DIR, 
    SCRIPT_ENVIRONMENT as SE, DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS, DEBUG_LOGS, 
    indentedStringify, DEFAULT_LOG_FILEPATH, clearLogFile,
    ERROR_LOG_FILEPATH,
    ERROR_DIR
} from "./config";
import { 
    EntityRecordTypeEnum, PostRecordOptions, PostRecordRequest, PostRecordResponse, RecordResult, idPropertyEnum,
    RecordResponseOptions, upsertRecordPayload, getRecordById, GetRecordResponse,
    ScriptDictionary, SAMPLE_POST_CUSTOMER_OPTIONS as SAMPLE_CUSTOMER,
    RecordTypeEnum,
    FieldDictionary,
    idSearchOptions,
    SearchOperatorEnum, 
} from "./utils/api";
import { CUSTOMER_PARSE_OPTIONS, CONTACT_PARSE_OPTIONS, CONTACT_CUSTOMER_POST_PROCESSING_OPTIONS as POST_PROCESSING_OPTIONS } from "src/parses/customer/customerParseDefinition"
import * as customerFiles from './parses/customer/customerConstants';
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { RadioFieldBoolean, RADIO_FIELD_TRUE } from './utils/typeValidation';

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
const TWO_SECONDS = 2000;

async function main() {
    clearLogFile(DEFAULT_LOG_FILEPATH, ERROR_LOG_FILEPATH);
    mlog.info(`Start of main()`);
    const parseOptions: ParseOptions = {
        [RecordTypeEnum.CUSTOMER]: CUSTOMER_PARSE_OPTIONS,
        [RecordTypeEnum.CONTACT]: CONTACT_PARSE_OPTIONS
    };
    const parseResults: ParseResults = await parseRecordCsv(
        customerFiles.SINGLE_COMPANY_FILE, parseOptions
    );
    const validatedResults: ValidatedParseResults = processParseResults(
        parseResults, 
        POST_PROCESSING_OPTIONS as ProcessParseResultsOptions 
    );
    write(validatedResults, path.join(OUTPUT_DIR, 'validatedResults.json'));
    STOP_RUNNING(0);
    const entityResponses: PostRecordResponse[] 
        = await postEntities(validatedResults[RecordTypeEnum.CUSTOMER].valid);
    await DELAY(TWO_SECONDS);
    const companyContacts: PostRecordOptions[] = matchContactsToEntityResponses(
        validatedResults[RecordTypeEnum.CONTACT].valid, 
        entityResponses
    ).companyContacts;

    const contactResponses: PostRecordResponse[] 
        = await postContacts(companyContacts);
    await DELAY(TWO_SECONDS);
    const entityUpdates: PostRecordOptions[] = generateEntityUpdates(
        EntityRecordTypeEnum.CUSTOMER,
        contactResponses
    );

    const entityUpdateResponses: PostRecordResponse[] 
        = await postEntities(entityUpdates);
    write(entityUpdateResponses, 
        path.join(OUTPUT_DIR, 'entityUpdateResponses.json')
    );
    mlog.info(`End of main()`);
    STOP_RUNNING(0);
}
main().catch(error => {
    mlog.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});
/**
 * - next goal: read a salesorder tsv -> parse customers, contacts, addresses
 * - post entities and customers
 * - get customer internalids and use as RecordRef when making salesorder
 * - - in salesorder shipgroup sublist, figure out how to select address from available addresses.
 */

/** = `['entityid', 'companyname', 'isperson', 'email']` */
export const ENTITY_RESPONSE_PROPS = ['entityid', 'isperson', 'companyname', 'email'];
/** = `['entityid', 'company', 'firstname', 'lastname', 'email']` */
export const CONTACT_RESPONSE_PROPS = ['entityid', 'company', 'firstname', 'lastname', 'email'];
/**
 * @description Post entities and their contacts to NetSuite
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @param responseOptions {@link RecordResponseOptions} - properties to return in the response.
 * @returns **`entityResponses`** `Promise<`{@link PostRecordResponse}`[]`
 */
export async function postEntities(
    entities: PostRecordOptions[],
    responseOptions: RecordResponseOptions=entityResponseOptions
): Promise<PostRecordResponse[]> {
    try {
        const entityRequest: PostRecordRequest = {
            postOptions: entities,
            responseOptions
        };
        const entityResponses: PostRecordResponse[] = 
            await upsertRecordPayload(entityRequest);
        return entityResponses;
    } catch (error) {
        mlog.error(`postEntityRecords() Error posting entities and contacts.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            ERROR_DIR, 'ERROR_postEntityRecords.json'
        );
    }
    return [];
}

/**
 * @param contacts `Array<`{@link PostRecordOptions}`>` - should be {@link matchContactsToEntityResponses}'s return value, `companyContacts`
 * @param responseProps {@link RecordResponseOptions} - properties to return in the response.
 * @returns **`contactResponses`** `Promise<`{@link PostRecordResponse}`[]>`
 */
export async function postContacts(
    contacts: PostRecordOptions[],
    responseOptions: RecordResponseOptions={responseFields: CONTACT_RESPONSE_PROPS}
): Promise<PostRecordResponse[]> {
    try {
        const contactRequest: PostRecordRequest = {
            postOptions: contacts,
            responseOptions
        };
        const contactResponses: PostRecordResponse[] = 
            await upsertRecordPayload(contactRequest);
        return contactResponses;
    } catch (error) {
        mlog.error(`postEntityContacts() Error posting contacts.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            ERROR_DIR, 'ERROR_postEntityContacts.json'
        );
    }
    mlog.warn(`postEntityContacts() returning empty array.`);
    return [] as PostRecordResponse[];
}


/** 
 * @param entityType {@link EntityRecordTypeEnum} - type of the primary entity to update
 * @param contactResponses `Array<`{@link PostRecordResponse}`>` - responses from initial contact post.
 * @returns **`entityUpdates`** = `Array<`{@link PostRecordOptions}`>` - represents updates to set entity.contact to internalId of entity-company's corresponding contact 
 * */
export function generateEntityUpdates(
    entityType: EntityRecordTypeEnum,
    contactResponses: PostRecordResponse[]
): PostRecordOptions[] {
    const entityUpdates: PostRecordOptions[] = [];
    const contactResults: RecordResult[] = getPostResults(contactResponses);    
    for (let contactResult of contactResults) {
        entityUpdates.push({
            recordType: entityType,
            idOptions: [
                { 
                    idProp: idPropertyEnum.INTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.RECORD.ANY_OF, 
                    idValue: contactResult?.fields?.company // = ${entityType}'s internalid
                },
                { 
                    idProp: idPropertyEnum.ENTITY_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: contactResult?.fields?.entityid
                } 
            ] as idSearchOptions[],
            fields: {
                contact: contactResult?.internalid 
            } as FieldDictionary,
        } as PostRecordOptions);
    }
    return entityUpdates;
}

/**
 * @param postResponses `Array<`{@link PostRecordResponse}`>`
 * @returns **`postResults`** = `Array<`{@link RecordResult}`>`
 */
export function getPostResults(
    postResponses: PostRecordResponse[]
): RecordResult[] {
    const postResults: RecordResult[] = [];
    for (let entityResponse of postResponses) {
        if (!entityResponse || !entityResponse.results) {
            mlog.error(`entityResponse or entityResponse.results is undefined. Continuing...`);
            continue;
        }
        postResults.push(...entityResponse.results as RecordResult[]);
    }
    if (postResults.length === 0) {
        mlog.warn(`No entityResults found. Returning empty array.`);
        return [];
    }
    return postResults;
}

/**
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @returns **`numCompanyEntities`** - `number`
 */
export function countCompanyEntities(entities: PostRecordOptions[]): number {
    let numCompanyEntities = 0;
    for (let i = 0; i < entities.length; i++) {
        const entity: PostRecordOptions = entities[i];
        
        const isPerson: RadioFieldBoolean = entity?.fields?.isperson as RadioFieldBoolean;
        if (isPerson === RADIO_FIELD_TRUE) {
            continue;
        } // else, this entity: {PostRecordOptions} is a company
        numCompanyEntities++;
    }
    return numCompanyEntities;
}

/**
 * @description match `internalid`s of entity post results to contacts
 * @param contacts `Array<`{@link PostRecordOptions}`>`
 * @param entityResponses `Array<`{@link PostRecordResponse}`>`
 * @returns `{ companyContacts: Array<`{@link PostRecordOptions}`>, unmatchedContacts: Array<`{@link PostRecordOptions}`> }`
 * - **`companyContacts`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - **`unmatchedContacts`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
export function matchContactsToEntityResponses(
    contacts: PostRecordOptions[], 
    entityResponses: PostRecordResponse[]
): {
    companyContacts: PostRecordOptions[], 
    unmatchedContacts: PostRecordOptions[],
} {
    const entityResults: RecordResult[] = getPostResults(entityResponses);
    const companyContacts: PostRecordOptions[] = [];
    const unmatchedContacts: PostRecordOptions[] = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact: PostRecordOptions = contacts[i];
        if (!contact || !contact.fields) {
            mlog.warn(`contact is undefined or has no fields at contacts[index=${i}]. Continuing...`);
            continue;
        }   
        const contactCompany: string = contact?.fields?.company as string;
        if (!contactCompany) {
            // mlog.debug(`contactCompany is undefined -> isPerson(entity)===true -> no need to worry about the select field. continuing...`);
            unmatchedContacts.push(contact);
            continue;
        }
        /**
         * - `if` turn on customer numbering in NetSuite Setup, 
         * `then` responseProp value for `entityid` is: 
         * > `'${customerNumber} ${originalEntityId}'` 
         * - `therefore` extract the `entityid` value to compare in lookup 
         * by using indexOf(' ')+1 and slice() to get the part after the first space.
         * */
        const entityInternalId = entityResults.find(entityResult => {
            let entityId = String(entityResult?.fields?.entityid) || '';
            return entityId.slice(entityId.indexOf(' ')+1) === contactCompany
                || entityResult?.fields?.companyname === contactCompany
        }
        )?.internalid;
        if (!entityInternalId) {
            mlog.warn(
                `entityInternalId is undefined for contact with company '${contactCompany}' at contacts[index=${i}].`, 
                `Adding to unmatchedContacts.`
            );
            unmatchedContacts.push(contact);
            continue;
        }
        contact.fields.company = entityInternalId;
        companyContacts.push(contact);
    }
    return {
        companyContacts: companyContacts,
        unmatchedContacts: unmatchedContacts
    };
}

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