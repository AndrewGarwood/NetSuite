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
    indentedStringify, DEFAULT_LOG_FILEPATH, PARSE_LOG_FILEPATH, clearLogFile,
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
import * as customerFiles from './parses/customer/customerConstants';
import { parseRecordCsv } from "./csvParser";
import { processParseResults } from "./parseResultsProcessor";
import { RadioFieldBoolean, RADIO_FIELD_TRUE, isNonEmptyArray } from './utils/typeValidation';

/** 
 * {@link RecordResponseOptions}
 * - `responseFields: ['entityid', 'isperson', 'companyname', 'email'];` 
 * - `responseSublists: { 'addressbook': [...] }` 
 * */
const ENTITY_RESPONSE_OPTIONS: RecordResponseOptions = {
    responseFields: ['entityid', 'isperson', 'companyname', 'email'],
    responseSublists: { 'addressbook': [
        'addressid', 'label', 'defaultbilling', 'defaultshipping', // 'addressbookaddress'
    ] }
};
const TWO_SECONDS = 2000;
const allData = [
    customerFiles.FIRST_PART_FILE, 
    customerFiles.SECOND_PART_FILE, 
    customerFiles.THIRD_PART_FILE
];
async function main() {
    clearLogFile(DEFAULT_LOG_FILEPATH, ERROR_LOG_FILEPATH, PARSE_LOG_FILEPATH);
    const entityType = RecordTypeEnum.CUSTOMER;
    const filePaths = 
        // [customerFiles.SMALL_SUBSET_FILE];
        allData; 
    mlog.info(`[START main()]`);
    await DELAY(TWO_SECONDS);
    for (let i = 0; i < filePaths.length; i++) {
        const csvFilePath = filePaths[i];
        let fileName = path.basename(csvFilePath);
        const parseOptions: ParseOptions = {
            [entityType]: CUSTOMER_PARSE_OPTIONS,
            [RecordTypeEnum.CONTACT]: CONTACT_PARSE_OPTIONS
        };
        const parseResults: ParseResults = await parseRecordCsv(
            csvFilePath, parseOptions
        );
        // write(parseResults, 
        //     path.join(OUTPUT_DIR, `${fileName}_parseResults.json`)
        // );
        const validatedResults: ValidatedParseResults = processParseResults(
            parseResults, 
            POST_PROCESSING_OPTIONS as ProcessParseResultsOptions 
        );
        const invalidOptions = Object.keys(validatedResults).reduce((acc, recordType) => {
            const invalid = validatedResults[recordType].invalid;
            if (isNonEmptyArray(invalid)) {
                acc[recordType] = invalid;
            }
            return acc;
        }, {} as Record<string, RecordOptions[]>);
        // write(validatedResults[entityType].valid, 
        //     path.join(CLOUD_LOG_DIR, `${fileName}_validOptions.json`)
        // );
        write(invalidOptions, 
            path.join(CLOUD_LOG_DIR, `${fileName}_invalidOptions.json`)
        );
        // STOP_RUNNING(0);
        // await DELAY(TWO_SECONDS);
        const entityResponses: RecordResponse[] 
            = await putEntities(validatedResults[entityType].valid);
        // write(entityResponses, 
        //     path.join(OUTPUT_DIR, `${fileName}_entityResponses.json`)
        // );
        await DELAY(TWO_SECONDS);
        const companyContacts: RecordOptions[] = matchContactsToEntityResponses(
            validatedResults[RecordTypeEnum.CONTACT].valid, 
            entityResponses
        ).companyContacts;

        const contactResponses: RecordResponse[] 
            = await putContacts(companyContacts);
        await DELAY(TWO_SECONDS);
        const entityUpdates: RecordOptions[] = generateEntityUpdates(
            EntityRecordTypeEnum.CUSTOMER,
            contactResponses
        );

        const entityUpdateResponses: RecordResponse[] 
            = await putEntities(entityUpdates);
        await DELAY(TWO_SECONDS);
    }
    mlog.info(`[END main()]`);
    STOP_RUNNING(0);
}
main().catch(error => {
    mlog.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});

/** = `['entityid', 'companyname', 'isperson', 'email']` */
export const ENTITY_RESPONSE_PROPS = ['entityid', 'isperson', 'companyname', 'email'];
/** = `['entityid', 'company', 'firstname', 'lastname', 'email']` */
export const CONTACT_RESPONSE_PROPS = ['entityid', 'company', 'firstname', 'lastname', 'email'];
/**
 * @description Post entities and their contacts to NetSuite
 * @param entities `Array<`{@link RecordOptions}`>`
 * @param responseOptions {@link RecordResponseOptions} - properties to return in the response.
 * @returns **`entityResponses`** `Promise<`{@link RecordResponse}`[]`
 */
export async function putEntities(
    entities: RecordOptions[],
    responseOptions: RecordResponseOptions=ENTITY_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    try {
        const entityRequest: RecordRequest = {
            postOptions: entities,
            responseOptions
        };
        const entityResponses: RecordResponse[] = 
            await upsertRecordPayload(entityRequest);
        return entityResponses;
    } catch (error) {
        mlog.error(`putEntities() Error putting entities.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            ERROR_DIR, 'ERROR_puttEntities.json'
        );
    }
    return [];
}

/**
 * @param contacts `Array<`{@link RecordOptions}`>` - should be {@link matchContactsToEntityResponses}'s return value, `companyContacts`
 * @param responseProps {@link RecordResponseOptions} - properties to return in the response.
 * @returns **`contactResponses`** `Promise<`{@link RecordResponse}`[]>`
 */
export async function putContacts(
    contacts: RecordOptions[],
    responseOptions: RecordResponseOptions={responseFields: CONTACT_RESPONSE_PROPS}
): Promise<RecordResponse[]> {
    try {
        const contactRequest: RecordRequest = {
            postOptions: contacts,
            responseOptions
        };
        const contactResponses: RecordResponse[] = 
            await upsertRecordPayload(contactRequest);
        return contactResponses;
    } catch (error) {
        mlog.error(`putContacts() Error putting contacts.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            ERROR_DIR, 'ERROR_putContacts.json'
        );
    }
    return [] as RecordResponse[];
}


/** 
 * @param entityType {@link EntityRecordTypeEnum} - type of the primary entity to update
 * @param contactResponses `Array<`{@link RecordResponse}`>` - responses from initial contact post.
 * @returns **`entityUpdates`** = `Array<`{@link RecordOptions}`>` - updates to set `entity.contact` to `internalid` of entity-company's corresponding contact 
 * */
export function generateEntityUpdates(
    entityType: EntityRecordTypeEnum,
    contactResponses: RecordResponse[]
): RecordOptions[] {
    const entityUpdates: RecordOptions[] = [];
    const contactResults: RecordResult[] = getRecordResults(contactResponses);    
    for (let contactResult of contactResults) {
        if (!contactResult || !contactResult.fields) {
            mlog.warn(`[generateEntityUpdates()] contactResult or contactResult.fields is undefined. Continuing...`);
            continue;
        }
        entityUpdates.push({
            recordType: entityType,
            idOptions: [
                { 
                    idProp: idPropertyEnum.INTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.RECORD.ANY_OF, 
                    idValue: contactResult.fields.company // = ${entityType}'s internalid
                },
                { 
                    idProp: idPropertyEnum.ENTITY_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: contactResult.fields.entityid
                } 
            ] as idSearchOptions[],
            fields: {
                contact: contactResult.internalid 
            } as FieldDictionary,
        } as RecordOptions);
    }
    return entityUpdates;
}

/**
 * @param postResponses `Array<`{@link RecordResponse}`>`
 * @returns **`recordResults`** = `Array<`{@link RecordResult}`>`
 */
export function getRecordResults(
    postResponses: RecordResponse[]
): RecordResult[] {
    const recordResults: RecordResult[] = [];
    for (let entityResponse of postResponses) {
        if (!entityResponse || !entityResponse.results) {
            mlog.error(`[getRecordResults()] entityResponse or entityResponse.results is undefined. Continuing...`);
            continue;
        }
        recordResults.push(...entityResponse.results as RecordResult[]);
    }
    return recordResults;
}

/**
 * @param entities `Array<`{@link RecordOptions}`>`
 * @returns **`numCompanyEntities`** - `number`
 */
export function countCompanyEntities(entities: RecordOptions[]): number {
    let numCompanyEntities = 0;
    for (let i = 0; i < entities.length; i++) {
        const entity: RecordOptions = entities[i];
        
        const isPerson: RadioFieldBoolean = entity?.fields?.isperson as RadioFieldBoolean;
        if (isPerson === RADIO_FIELD_TRUE) {
            continue;
        } // else, this (entity: RecordOptions) is a company
        numCompanyEntities++;
    }
    return numCompanyEntities;
}

/**
 * @description match `internalid`s of entity post results to contacts
 * @param contacts `Array<`{@link RecordOptions}`>`
 * @param entityResponses `Array<`{@link RecordResponse}`>`
 * @returns `{ companyContacts: Array<`{@link RecordOptions}`>, unmatchedContacts: Array<`{@link RecordOptions}`> }`
 * - **`companyContacts`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - **`unmatchedContacts`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
export function matchContactsToEntityResponses(
    contacts: RecordOptions[], 
    entityResponses: RecordResponse[]
): {
    companyContacts: RecordOptions[], 
    unmatchedContacts: RecordOptions[],
} {
    const entityResults: RecordResult[] = getRecordResults(entityResponses);
    const companyContacts: RecordOptions[] = [];
    const unmatchedContacts: RecordOptions[] = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact: RecordOptions = contacts[i];
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
        const entityMatch = entityResults.find(entityResult => {
            let entityId = String(entityResult?.fields?.entityid) || '';
            return entityId.slice(entityId.indexOf(' ')+1) === contactCompany
                || entityResult?.fields?.companyname === contactCompany
        });
        // either no entity match found, 
        // or entity is a person and thus a contact record cannot be made for it.
        if (!entityMatch || !entityMatch.internalid 
            || (entityMatch.fields && entityMatch.fields.isperson === RADIO_FIELD_TRUE)
        ) {
            mlog.debug(`matchContactsToEntityResponses() - no entity match for contactCompany: '${contactCompany}'`,
                TAB+`  no entityMatch ? ${!entityMatch}`,
                TAB+`   no internalid ? ${entityMatch && !entityMatch.internalid}`,
                TAB+`isperson === 'T' ? ${entityMatch && entityMatch.fields && entityMatch.fields.isperson === RADIO_FIELD_TRUE}`,
            ); 
            unmatchedContacts.push(contact);
            continue;
        }
        contact.fields.company = entityMatch.internalid;
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