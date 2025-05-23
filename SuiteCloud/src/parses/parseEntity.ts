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
    idPropertyEnum, ParseOptions, ParseResults, PostRecordOptions, 
    postRecordPayload, PostRecordResult, SetFieldValueOptions, SetSublistValueOptions, 
    SublistDictionary, SublistFieldDictionary 
} from "src/utils/api";
import { ContactRoleEnum, EntityRecordTypeEnum, RecordTypeEnum } from "src/utils/NS";

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
 * @returns `Promise<void>` - returns nothing
 */
export async function parseEntityFile(
    filePath: string,
    entityType: EntityRecordTypeEnum,
    parseOptions: ParseOptions[]
): Promise<void> {
    if (!filePath) {
        log.error('No file path provided. returning...');
        return;
    }
    if (!entityType || entityType === EntityRecordTypeEnum.CONTACT || !Object.values(EntityRecordTypeEnum).includes(entityType)) {
        log.error('No valid entity type provided. returning...');
        return;
    }
    let debugLogs: any[] = [];
    try {
        const parseResults = await parseCsvToPostRecordOptions(filePath, parseOptions) as ParseResults;
        const entities = parseResults[entityType]?.validPostOptions as PostRecordOptions[];
        const contacts = parseResults[RecordTypeEnum.CONTACT]?.validPostOptions as PostRecordOptions[];
        debugLogs.push(`parseCsvToPostRecordOptions(${entityType}) Results:`,
            TAB + `      ${entityType}s.length: ${entities.length}`,
            TAB + `       contacts.length: ${contacts.length}`,
        );
        STOP_RUNNING(0, `let's check the parse results...`);
        if (entities.length === 0 && contacts.length === 0) {
            log.error(`No ${entityType}s and no contacts were parsed from the CSV file. Exiting...`);
            STOP_RUNNING(1);
        }
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
                fieldDict: {
                    valueFields: [
                        { // included so REST script can use as search term
                            fieldId: idPropertyEnum.INTERNAL_ID, 
                            value: contactResult?.company // contactResult.company = ${entityType}'s internalid
                        },
                        { // (maybe redundant) included so REST script can use as search term
                            fieldId: idPropertyEnum.ENTITY_ID, 
                            value: contactResult?.entityid 
                        },
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
            TAB + `${entityType}Updates.length: ${entityUpdates.length}`,
            TAB + `${entityType}UpdateResponses.length: ${entityUpdateResponses.length}`,
        );
        log.debug(...debugLogs);
        write({ [`${entityType}Options`]: entities }, `${entityType}_options.json`, `${OUTPUT_DIR}/parses/${entityType}`);
        write({ validContacts: validContacts }, `contact_options.json`, `${OUTPUT_DIR}/parses/${entityType}`);
        write({ removedContacts: removedContacts }, `removed_contacts.json`, `${OUTPUT_DIR}/parses/${entityType}`);

        write({ [`${entityType}Results`]: entityResults }, `${entityType}_results.json`, `${OUTPUT_DIR}/parses/${entityType}`);
        write({ contactResults: contactResults }, `contact_results.json`, `${OUTPUT_DIR}/parses/${entityType}`);
        // write({ [`${entityType}UpdateResponses`]: updateResponses }, `${entityType}_update_responses.json`, `${OUTPUT_DIR}/parses/${entityType}`);
        return;

    } catch (error) {
        log.error(`main.ts parseEntityFile() Error parsing ${entityType} file:`, error);
        throw error;
    }
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