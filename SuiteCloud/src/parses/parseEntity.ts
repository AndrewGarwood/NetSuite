/**
 * @file src/parses/parseEntity.ts
 */
import {
    writeObjectToJson as write, 
} from "../utils/io";
import { mainLogger as log, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "src/config/setupLog";
import { OUTPUT_DIR, STOP_RUNNING } from "src/config/env";
import { RadioFieldBoolean, RADIO_FIELD_TRUE } from "src/utils/typeValidation";
import { parseCsvToPostRecordOptions } from "src/parseCsvToRequestBody";
import { 
    BatchPostRecordRequest, BatchPostRecordResponse, FieldDictionary, 
    idPropertyEnum, idSearchOptions, ParseOptions, ParseResults, PostRecordOptions, 
    upsertRecordPayload, PostRecordResult, SetFieldValueOptions, SetSublistValueOptions, 
    SublistDictionary, SublistFieldDictionary 
} from "src/utils/api";
import { ContactRoleEnum, EntityRecordTypeEnum, RecordTypeEnum, SearchOperatorEnum } from "src/utils/NS";

/** = `['entityid', 'companyname', 'isperson', 'email']` */
export const ENTITY_RESPONSE_PROPS = ['entityid', 'isperson', 'companyname', 'email'];
/** = `['entityid', 'company', 'firstname', 'lastname', 'email']` */
export const CONTACT_RESPONSE_PROPS = ['entityid', 'company', 'firstname', 'lastname', 'email'];


/** 
 * contact record has a `select` field for company,
 * - if a `entityType` is a company, then the associated `contact.company` field should be set to the entity's `internalid`
 * - ...so let's make the entities first and get their `internalid`(s) in the Post Response
 * @param filePath - `string` - path to the csv file containing the entity data 
 * @param entityType - {@link EntityRecordTypeEnum} - type of the primary entity to parse from file at filePath
 * @param parseOptions - `Array<`{@link ParseOptions}`>` - apply parse definitions to the file's rows
 * @returns `Promise<{entities: PostRecordOptions[], contacts: PostRecordOptions[], parseResults: ParseResults}>` - returns...
 */
export async function parseEntityFile(
    filePath: string,
    entityType: EntityRecordTypeEnum,
    parseOptions: ParseOptions[]
): Promise<{
    entities: PostRecordOptions[], 
    contacts: PostRecordOptions[], 
    parseResults: ParseResults
}> { 
    if (!filePath) {
        log.error('No file path provided. returning...');
        return {} as { entities: [], contacts: [], parseResults: {} };
    }
    if (!entityType 
        || entityType === EntityRecordTypeEnum.CONTACT 
        || !Object.values(EntityRecordTypeEnum).includes(entityType)
    ) {
        log.error('No valid entity type provided. returning...');
        return {} as { entities: [], contacts: [], parseResults: {} };
    }
    try {
        const parseResults = await parseCsvToPostRecordOptions(
            filePath, parseOptions) as ParseResults;
        const entities = parseResults[entityType]?.validPostOptions as PostRecordOptions[];
        const contacts = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];
        if (entities.length === 0 && contacts.length === 0) {
            log.error(`No ${entityType}s and no contacts were parsed from the CSV file. Exiting...`);
        }
        return {
            entities: entities,
            contacts: contacts,
            parseResults: parseResults
        }
    } catch (error) {
        log.error(`main.ts parseEntityFile() Error parsing ${entityType} file:`, error);
        return {} as { entities: [], contacts: [], parseResults: {} };
    }
}

/**
 * @param entityType - {@link EntityRecordTypeEnum}
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @param contacts `Array<`{@link PostRecordOptions}`>`
 */
export async function postEntityRecords(
    entityType: EntityRecordTypeEnum,
    entities: PostRecordOptions[],
    contacts: PostRecordOptions[],
): Promise<{
    entityResponses: BatchPostRecordResponse[], 
    contactResponses: BatchPostRecordResponse[], 
    entityUpdateResponses: BatchPostRecordResponse[]
}> {
    let debugLogs: any[] = [];
    const entityResponses: BatchPostRecordResponse[] = await upsertRecordPayload({
        upsertRecordArray: entities,
        responseProps: ENTITY_RESPONSE_PROPS
    } as BatchPostRecordRequest);
    const { matchedContacts: companyContacts } 
        = matchContactsToPostEntityResponses(contacts, entityResponses);
    const contactResponses: BatchPostRecordResponse[] = await upsertRecordPayload({
        upsertRecordArray: companyContacts,
        responseProps: CONTACT_RESPONSE_PROPS
    } as BatchPostRecordRequest);

    const entityUpdates: PostRecordOptions[] = [];
    const contactResults: PostRecordResult[] = getPostResults(contactResponses);    
    for (let contactResult of contactResults) {
        entityUpdates.push({
            recordType: entityType,
            idOptions: [
                { 
                    idProp: idPropertyEnum.INTERNAL_ID, 
                    searchOperator: SearchOperatorEnum.RECORD.ANY_OF, 
                    idValue: contactResult?.company // contactResult.company = ${entityType}'s internalid
                },
                { 
                    idProp: idPropertyEnum.ENTITY_ID, 
                    searchOperator: SearchOperatorEnum.TEXT.IS, 
                    idValue: contactResult?.entityid
                } 
            ] as idSearchOptions[],
            fieldDict: {
                valueFields: [
                    // { // included so REST script can use as search term
                    //     fieldId: idPropertyEnum.INTERNAL_ID, 
                    //     value: contactResult?.company // contactResult.company = ${entityType}'s internalid
                    // },
                    // { // (maybe redundant) included so REST script can use as search term
                    //     fieldId: idPropertyEnum.ENTITY_ID, 
                    //     value: contactResult?.entityid 
                    // },
                    { // new SetFieldValueOptions to update ${entityType} with
                        fieldId: 'contact', 
                        value: contactResult?.internalId 
                    }
                ] as SetFieldValueOptions[],
            } as FieldDictionary,
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
    const entityUpdateResponses = await upsertRecordPayload({ 
        upsertRecordArray: entityUpdates,
        responseProps: ENTITY_RESPONSE_PROPS
    });
    // log.debug(...debugLogs);
    return {
        entityResponses: entityResponses,
        contactResponses: contactResponses,
        entityUpdateResponses: entityUpdateResponses,
    };

}


function getPostResults(
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
        log.error(`No entityResults found. Returning empty array.`);
        return [];
    }
    return entityResults;
}

/**
 * @param entities `Array<`{@link PostRecordOptions}`>`
 * @returns `numCompanyEntities` - `number`
 */
function countCompanyEntities(entities: PostRecordOptions[]): number {
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
 * @returns `{ matchedContacts: Array<`{@link PostRecordOptions}`>, unmatchedContacts: Array<`{@link PostRecordOptions}`> }`
 * - `matchedContacts`: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - `unmatchedContacts`: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
export function matchContactsToPostEntityResponses(
    contacts: PostRecordOptions[], 
    entityResponses: BatchPostRecordResponse[]
): {
    matchedContacts: PostRecordOptions[], 
    unmatchedContacts: PostRecordOptions[],
} {
    const entityResults: PostRecordResult[] 
        = getPostResults(entityResponses);

    const unmatchedContacts: PostRecordOptions[] = [];
    const matchedContacts: PostRecordOptions[] = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact: PostRecordOptions = contacts[i];
        let contactCompanyField = contact.fieldDict?.valueFields?.find(
            field => field.fieldId === 'company'
        ) as SetFieldValueOptions;
        const contactCompany: string = contactCompanyField?.value as string;
        if (!contactCompany) {
            log.debug(`contactCompany is undefined -> isPerson(entity)===true -> no need to worry about the select field. continuing...`);
            unmatchedContacts.push(contact);
            continue;
        }
        let entityInternalId = entityResults.find(
            entityResult => entityResult?.entityid === contactCompany
        )?.internalId;
        if (!entityInternalId) {
            log.warn(`entityInternalId is undefined for contact with company '${contactCompany}' at contacts[index=${i}]. Adding to unmatchedContacts.`);
            unmatchedContacts.push(contact);
            continue;
        }
        contactCompanyField.value = entityInternalId;
        matchedContacts.push(contact);
    }
    return {
        matchedContacts: matchedContacts,
        unmatchedContacts: unmatchedContacts
    };
}