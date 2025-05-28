/**
 * @file src/parses/parseEntity.ts
 */
import {
    writeObjectToJson as write, 
} from "../utils/io";
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "src/config/setupLog";
import { OUTPUT_DIR, STOP_RUNNING } from "src/config/env";
import { RadioFieldBoolean, RADIO_FIELD_TRUE } from "src/utils/typeValidation";
import { parseCsvToPostRecordOptions } from "src/parseCsvToRequestBody";
import { 
    BatchPostRecordRequest, BatchPostRecordResponse, FieldDictionary, 
    idPropertyEnum, idSearchOptions, ParseOptions, ParseResults, PostRecordOptions, 
    postRecordPayload, PostRecordResult, SetFieldValueOptions, SetSublistValueOptions, 
    SublistDictionary, SublistFieldDictionary 
} from "src/utils/api";
import { ContactRoleEnum, EntityRecordTypeEnum, RecordTypeEnum, SearchOperatorEnum } from "src/utils/NS";

/** = `['entityid', 'companyname', 'isperson', 'email']` */
export const ENTITY_RESPONSE_PROPS = ['entityid', 'isperson', 'companyname', 'email'];
/** = `['entityid', 'company', 'firstname', 'lastname', 'email']` */
export const CONTACT_RESPONSE_PROPS = ['entityid', 'company', 'firstname', 'lastname', 'email'];

// export async function parseThenMakeEntityRecords(
//     filePath: string,
//     entityType: EntityRecordTypeEnum,
//     parseOptions: ParseOptions[]
// ): Promise<void> {
//     const { entities, contacts, parseResults } = await parseEntityFile(filePath, entityType, parseOptions);

//     // log.debug(`parseThenMakeEntityRecords() parseResults:`, parseResults);
//     log.debug(`parseThenMakeEntityRecords() entities.length: ${entities.length}`);
//     log.debug(`parseThenMakeEntityRecords() contacts.length: ${contacts.length}`);
//     await postEntityRecords(entityType, entities, contacts);
// }

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
): Promise<{entities: PostRecordOptions[], contacts: PostRecordOptions[], parseResults: ParseResults}> { 
    if (!filePath) {
        log.error('No file path provided. returning...');
        return {} as { entities: [], contacts: [], parseResults: {} };
    }
    if (!entityType || entityType === EntityRecordTypeEnum.CONTACT || !Object.values(EntityRecordTypeEnum).includes(entityType)) {
        log.error('No valid entity type provided. returning...');
        return {} as { entities: [], contacts: [], parseResults: {} };
    }
    try {
        const parseResults = await parseCsvToPostRecordOptions(filePath, parseOptions) as ParseResults;
        const entities = parseResults[entityType]?.validPostOptions as PostRecordOptions[];
        const contacts = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];
        write({ [`${entityType}Options`]: entities }, `${OUTPUT_DIR}/parses/${entityType}`, `${entityType}_options.json`);
        write({ contactOptions: contacts }, `${OUTPUT_DIR}/parses/${entityType}`, `contact_options.json`);
        log.debug(`parse(${entityType}) Results:`,
            TAB + `      ${entityType}s.length: ${entities.length}`,
            TAB + `       contacts.length: ${contacts.length}`,
        );
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
    entityResults: PostRecordResult[], 
    entityRejects?: any[],
    contactResults: PostRecordResult[],
    contactRejects?: any[]
}> {
    let debugLogs: any[] = [];
    const entityResults: PostRecordResult[] = [];
    const entityResponses: any[] = await postRecordPayload({
        upsertRecordArray: entities,
        responseProps: ENTITY_RESPONSE_PROPS
    } as BatchPostRecordRequest);
    for (let [index, entityResponse] of Object.entries(entityResponses)) {
        if (!entityResponse || !entityResponse.data) { // continue;
            log.error(`${entityType}Response.data is undefined at batch index ${index}.`);
            continue;
        }
        entityResults.push(...((entityResponse.data as BatchPostRecordResponse).results || []));
    }  
    debugLogs.push(`\n ${entityType} Post Results:`,
        TAB + `      ${entityType}s.length: ${entities.length}`,
        TAB + `${entityType}Results.length: ${entityResults.length}`
    );
    if (entityResults.length === 0) {
        log.error(`${entityType}Results.length === 0 -> No ${entityType}s were created.`, 
            'Exiting before making contacts...');
        STOP_RUNNING(1);
    }
    const { validContacts, removedContacts } = matchContactsToEntityResults(contacts, entityResults);
    const contactResults: PostRecordResult[] = [];
    const contactResponses: any[] = await postRecordPayload({
        upsertRecordArray: validContacts,
        responseProps: CONTACT_RESPONSE_PROPS
    } as BatchPostRecordRequest);
    for (let [index, contactRes] of Object.entries(contactResponses)) {
        if (!contactRes || !contactRes.data) { // continue;
            log.error(`contactRes.data is undefined at contact batch index ${index}.`);
            continue;
        }
        contactResults.push(...((contactRes.data as BatchPostRecordResponse).results || []));
    }
    const entityUpdates: PostRecordOptions[] = [];
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
    const entityUpdateResponses = await postRecordPayload({ 
        upsertRecordArray: entityUpdates,
        responseProps: ENTITY_RESPONSE_PROPS
    });
    debugLogs.push(`\n Contact Post Results:`,
        TAB + `       contacts.length: ${contacts.length}`,
        TAB + ` num Company ${entityType}s: ${countCompanyEntities(entities)}`, 
        TAB + `  validContacts.length: ${validContacts.length}`,
        TAB + ` contactResults.length: ${contactResults.length}`,
        // TAB + `${entityType}Updates.length: ${entityUpdates.length}`,
        TAB + `${entityType}UpdateResponses.length: ${entityUpdateResponses.length}`,
    );
    log.debug(...debugLogs);
    const entityDir = `${OUTPUT_DIR}/parses/${entityType}`;
    write({ validContacts: validContacts }, entityDir, 
        `contact_options.json`);
    write({ removedContacts: removedContacts }, entityDir, 
        `removed_contacts.json`);
    write({ [`${entityType}Rejects`]: entityResponses.map(res => (res.data as BatchPostRecordResponse).rejects) }, 
        entityDir, `${entityType}_results.json`);
    write({ [`${entityType}Results`]: entityResults }, entityDir, 
        `${entityType}_results.json`);
    write({ contactResults: contactResults }, entityDir, 
        `contact_results.json`);
    write({ [`${entityType}UpdateResponses`]: entityUpdateResponses }, entityDir, 
        `${entityType}_update_responses.json`);
    return {
        entityResults: entityResults,
        entityRejects: entityResponses.map(res => (res.data as BatchPostRecordResponse).rejects) || [] as PostRecordOptions[],
        contactResults: contactResults,
        contactRejects: contactResponses.map(res => (res.data as BatchPostRecordResponse).rejects) || [] as PostRecordOptions[],
    };

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
 * @param entityResults `Array<`{@link PostRecordResult}`>`
 * @returns `{ validContacts: Array<`{@link PostRecordOptions}`>, removedContacts: Array<`{@link PostRecordOptions}`> }`
 * - `validContacts`: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - `removedContacts`: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
export function matchContactsToEntityResults(
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