/**
 * @file src/parses/parseEntity.ts
 */
import {
    getCurrentPacificTime,
    indentedStringify,
    writeObjectToJson as write, 
} from "../utils/io";
import { mainLogger as log, parseLogger as plog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "src/config/setupLog";
import { OUTPUT_DIR, ERROR_DIR, STOP_RUNNING, CLOUD_LOG_DIR } from "src/config/env";
import { RadioFieldBoolean, RADIO_FIELD_TRUE } from "src/utils/typeValidation";
import { parseCsvToPostRecordOptions } from "src/parseCsvToRequestBody";
import { 
    BatchPostRecordRequest, BatchPostRecordResponse, FieldDictionary, 
    idPropertyEnum, idSearchOptions, ParseOptions, ParseResults, PostRecordOptions, 
    upsertRecordPayload, PostRecordResult, SetFieldValueOptions, SetSublistValueOptions, 
    SublistDictionary, SublistFieldDictionary 
} from "src/utils/api";
import { ContactRoleEnum, EntityRecordTypeEnum, RecordTypeEnum, SearchOperatorEnum } from "src/utils/ns";

/** = `['entityid', 'companyname', 'isperson', 'email']` */
export const ENTITY_RESPONSE_PROPS = ['entityid', 'isperson', 'companyname', 'email'];
/** = `['entityid', 'company', 'firstname', 'lastname', 'email']` */
export const CONTACT_RESPONSE_PROPS = ['entityid', 'company', 'firstname', 'lastname', 'email'];


/** 
 * calls {@link parseCsvToPostRecordOptions} to parse a csv file containing entity data,
 * contact record has a `select` field for company,
 * - if a `entityType` is a company, then the associated `contact.company` field should be set to the entity's `internalid`
 * - ...so let's make the entities first and get their `internalid`(s) in the Post Response
 * @param filePath - `string` - path to the csv file containing the entity data 
 * @param entityType - {@link EntityRecordTypeEnum} - type of the primary entity to parse from file at filePath
 * @param parseOptions - `Array<`{@link ParseOptions}`>` - apply parse definitions to the file's rows
 * @returns `Promise<{ entities: `{@link PostRecordOptions}`[], contacts: `PostRecordOptions`[] }>`
 */
export async function parseEntityFile(
    filePath: string,
    entityType: EntityRecordTypeEnum,
    parseOptions: ParseOptions[]
): Promise<{
    entities: PostRecordOptions[], 
    contacts: PostRecordOptions[],
}> { 
    const entityFileParseResults = {
        entities: [] as PostRecordOptions[], 
        contacts: [] as PostRecordOptions[],
    }
    if (!filePath) {
        log.error('No file path provided. returning...');
        return entityFileParseResults;
    }
    if (!entityType
        || !Object.values(EntityRecordTypeEnum).includes(entityType)
    ) {
        log.error('No valid entity type provided. returning...');
        return entityFileParseResults;
    }
    try {
        const parseResults 
            = await parseCsvToPostRecordOptions(filePath, parseOptions) as ParseResults;
        entityFileParseResults.entities 
            = parseResults[entityType]?.validPostOptions as PostRecordOptions[];
        entityFileParseResults.contacts 
            = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];
        if (entityFileParseResults.entities.length === 0 && entityFileParseResults.contacts.length === 0) {
            log.error(`No ${entityType}s and no contacts were parsed from the CSV file. Exiting...`);
        }
        return entityFileParseResults;
    } catch (error) {
        log.error(`main.ts parseEntityFile() Error parsing ${entityType} file:`, error);
        return entityFileParseResults;
    }
}

/**
 * @description Post entities and their contacts to NetSuite
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @param responseProps `Array<string>` - properties to return in the response, defaults to {@link ENTITY_RESPONSE_PROPS}
 * @returns **`entityResponses`** `Promise<`{@link BatchPostRecordResponse}`[]`
 */
export async function postEntities(
    entities: PostRecordOptions[],
    responseProps: string[] = ENTITY_RESPONSE_PROPS,
): Promise<BatchPostRecordResponse[]> {
    try {
        const entityResponses: BatchPostRecordResponse[] = await upsertRecordPayload({
            upsertRecordArray: entities,
            responseProps: responseProps
        } as BatchPostRecordRequest);

        return entityResponses;
    } catch (error) {
        log.error(`postEntityRecords() Error posting entities and contacts.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            ERROR_DIR, 'ERROR_postEntityRecords.json'
        );
    }
    return [];
}

/**
 * @param contacts `Array<`{@link PostRecordOptions}`>` - should be {@link matchContactsToPostEntityResponses}'s return value, `companyContacts`
 * @param responseProps `Array<string>` - properties to return in the response, defaults to {@link CONTACT_RESPONSE_PROPS}
 * @returns **`contactResponses`** `Promise<`{@link BatchPostRecordResponse}`[]>`
 */
export async function postContacts(
    contacts: PostRecordOptions[],
    responseProps: string[] = CONTACT_RESPONSE_PROPS
): Promise<BatchPostRecordResponse[]> {
    try {
        const contactResponses: BatchPostRecordResponse[] = await upsertRecordPayload({
            upsertRecordArray: contacts,
            responseProps: responseProps
        } as BatchPostRecordRequest);
        return contactResponses;
    } catch (error) {
        log.error(`postEntityContacts() Error posting contacts.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            ERROR_DIR, 'ERROR_postEntityContacts.json'
        );
    }
    log.warn(`postEntityContacts() returning empty array.`);
    return [] as BatchPostRecordResponse[];
}

/**
 * @TODO validate params and add if statements to exit method early if a responseArr is empty  
 * @description Post entities and their contacts to NetSuite, then update the entities with 
 * the contact's internalId so the contact shows up on the entities' contacts sublist
 * @param entityType {@link EntityRecordTypeEnum} - type of the primary entity to update
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @param contacts `Array<`{@link PostRecordOptions}`>`
 * @returns `Promise<{ entityResponses: `{@link BatchPostRecordResponse}`[], contactResponses: `{@link BatchPostRecordResponse}`[], entityUpdateResponses: `{@link BatchPostRecordResponse}`[] }>`
 * */
export async function postEntitiesAndContacts(
    entityType: EntityRecordTypeEnum,
    entities: PostRecordOptions[],
    contacts: PostRecordOptions[],
): Promise<{
    entityResponses: BatchPostRecordResponse[],
    contactResponses: BatchPostRecordResponse[],
    entityUpdateResponses: BatchPostRecordResponse[]
}> {
    const entityResponses: BatchPostRecordResponse[] = await postEntities(entities);
    const companyContacts: PostRecordOptions[] 
        = matchContactsToPostEntityResponses(contacts, entityResponses).companyContacts;
    const contactResponses: BatchPostRecordResponse[]
        = await postContacts(companyContacts);
    const entityUpdates: PostRecordOptions[]
        = generateEntityUpdates(entityType, contactResponses);
    if (entityUpdates.length === 0) {
        log.warn(`entityUpdates.length === 0. Exiting.`);
        return {
            entityResponses: entityResponses,
            contactResponses: contactResponses,
            entityUpdateResponses: []
        };
    }
    const entityUpdateResponses = await upsertRecordPayload({ 
        upsertRecordArray: entityUpdates,
        responseProps: ENTITY_RESPONSE_PROPS
    });
    return {
        entityResponses: entityResponses,
        contactResponses: contactResponses,
        entityUpdateResponses: entityUpdateResponses
    };
}

/** 
 * @param entityType {@link EntityRecordTypeEnum} - type of the primary entity to update
 * @param contactResponses `Array<`{@link BatchPostRecordResponse}`>` - responses from initial contact post.
 * @returns **`entityUpdates`** = `Array<`{@link PostRecordOptions}`>` - represents updates to set entity.contact to internalId of entity-company's corresponding contact 
 * */
export function generateEntityUpdates(
    entityType: EntityRecordTypeEnum,
    contactResponses: BatchPostRecordResponse[]
): PostRecordOptions[] {
    const entityUpdates: PostRecordOptions[] = [];
    const contactResults: PostRecordResult[] = getPostResults(contactResponses);    
    for (let contactResult of contactResults) {
        entityUpdates.push({
            recordType: entityType,
            idOptions: [
                { 
                    idProp: idPropertyEnum.INTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.RECORD.ANY_OF, 
                    idValue: contactResult?.company // = ${entityType}'s internalid
                },
                { 
                    idProp: idPropertyEnum.ENTITY_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: contactResult?.entityid
                } 
            ] as idSearchOptions[],
            fieldDict: {
                valueFields: [
                    {
                        fieldId: 'contact', 
                        value: contactResult?.internalId 
                    }
                ] as SetFieldValueOptions[],
            } as FieldDictionary,
        } as PostRecordOptions);
    }
    return entityUpdates;
}

/**
 * @param entityResponses `Array<`{@link BatchPostRecordResponse}`>`
 * @returns **`entityResults`** = `Array<`{@link PostRecordResult}`>`
 */
export function getPostResults(
    entityResponses: BatchPostRecordResponse[]
): PostRecordResult[] {
    const entityResults: PostRecordResult[] = [];
    for (let entityResponse of entityResponses) {
        if (!entityResponse || !entityResponse.results) {
            log.error(`entityResponse or entityResponse.results is undefined. Continuing...`);
            continue;
        }
        entityResults.push(...entityResponse.results as PostRecordResult[]);
    }
    if (entityResults.length === 0) {
        log.warn(`No entityResults found. Returning empty array.`);
        return [];
    }
    return entityResults;
}

/**
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @returns **`numCompanyEntities`** - `number`
 */
export function countCompanyEntities(entities: PostRecordOptions[]): number {
    let numCompanyEntities = 0;
    for (let i = 0; i < entities.length; i++) {
        const entity: PostRecordOptions = entities[i];
        let isPersonField = entity.fieldDict?.valueFields?.find(
            field => field.fieldId === 'isperson'
        ) as SetFieldValueOptions;
        const isPerson: RadioFieldBoolean = isPersonField?.value as RadioFieldBoolean;
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
 * @param entityResponses `Array<`{@link BatchPostRecordResponse}`>`
 * @returns `{ companyContacts: Array<`{@link PostRecordOptions}`>, unmatchedContacts: Array<`{@link PostRecordOptions}`> }`
 * - **`companyContacts`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - **`unmatchedContacts`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
export function matchContactsToPostEntityResponses(
    contacts: PostRecordOptions[], 
    entityResponses: BatchPostRecordResponse[]
): {
    companyContacts: PostRecordOptions[], 
    unmatchedContacts: PostRecordOptions[],
} {
    const entityResults: PostRecordResult[] = getPostResults(entityResponses);
    const companyContacts: PostRecordOptions[] = [];
    const unmatchedContacts: PostRecordOptions[] = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact: PostRecordOptions = contacts[i];
        let contactCompanyField = contact.fieldDict?.valueFields?.find(
            field => field.fieldId === 'company'
        ) as SetFieldValueOptions;
        const contactCompany: string = contactCompanyField?.value as string;
        if (!contactCompany) {
            plog.debug(`contactCompany is undefined -> isPerson(entity)===true -> no need to worry about the select field. continuing...`);
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
            let entityId = String(entityResult?.entityid) || '';
            return entityId.slice(entityId.indexOf(' ')+1) === contactCompany
                || entityResult?.companyname === contactCompany
        }
        )?.internalId;
        if (!entityInternalId) {
            log.warn(
                `entityInternalId is undefined for contact with company '${contactCompany}' at contacts[index=${i}].`, 
                `Adding to unmatchedContacts.`
            );
            unmatchedContacts.push(contact);
            continue;
        }
        contactCompanyField.value = entityInternalId;
        companyContacts.push(contact);
    }
    return {
        companyContacts: companyContacts,
        unmatchedContacts: unmatchedContacts
    };
}