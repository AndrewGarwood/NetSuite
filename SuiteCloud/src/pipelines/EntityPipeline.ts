/**
 * @file src/EntityPipeline.ts
 */
import path from "node:path";
import * as fs from "fs";
import {
    writeObjectToJsonSync as write,
    getCurrentPacificTime,
    indentedStringify, clearFileSync,
} from "typeshi:utils/io";
import { 
    STOP_RUNNING,  DELAY, 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, 
    getProjectFolders
} from "../config";
import { 
    EntityRecordTypeEnum, RecordOptions, SingleRecordRequest, RecordResponse, 
    RecordResult, idPropertyEnum, RecordRequest, 
    RecordResponseOptions, upsertRecordPayload, getRecordById, 
    SAMPLE_POST_CUSTOMER_OPTIONS as SAMPLE_CUSTOMER,
    RecordTypeEnum,
    FieldDictionary,
    idSearchOptions,
    SearchOperatorEnum, 
} from "../api";
import { CUSTOMER_PARSE_OPTIONS, CONTACT_PARSE_OPTIONS, 
    CONTACT_CUSTOMER_POST_PROCESSING_OPTIONS as POST_PROCESSING_OPTIONS 
} from "../parse_configurations/customer/customerParseDefinition";
import * as customerConstants from "../parse_configurations/customer/customerConstants";
import { parseRecordCsv } from "../services/parse/csvParser";
import { processParseResults } from "../services/post_process/parseResultsProcessor";
import { isNonEmptyArray, isNonEmptyString } from "typeshi:utils/typeValidation";
import { RadioFieldBoolean, RADIO_FIELD_TRUE, } from "../utils/ns";
import { 
    ParseDictionary, ParseResults, ValidatedParseResults 
} from "../services/parse/types/index";
import {
    PostProcessDictionary
} from "../services/post_process/types/PostProcessing";
/** 
 * {@link RecordResponseOptions}
 * - `responseFields: ['entityid', 'externalid', 'isperson', 'companyname', 'email'];` 
 * - `responseSublists: { 'addressbook': [...] }` 
 * */
export const ENTITY_RESPONSE_OPTIONS: RecordResponseOptions = {
    fields: ['entityid', 'externalid', 'isperson', 'companyname', 'email'],
    sublists: { 'addressbook': [
        'addressid', 'label', 'defaultbilling', 'defaultshipping', // 'addressbookaddress'
    ] }
};
export const CONTACT_RESPONSE_OPTIONS: RecordResponseOptions = {
    fields: ['entityid', 'externalid', 'company', 'firstname', 'lastname', 'email']
}

const TWO_SECONDS = 2000;

export enum EntityPipelineStageEnum {
    PARSE = 'PARSE',
    VALIDATE = 'VALIDATE',
    ENTITIES = 'PUT_ENTITIES',
    CONTACTS = 'PUT_CONTACTS',
    GENERATE = 'GENERATE_UPDATES',
    UPDATE = 'PUT_ENTITY_UPDATES',
}
export type EntityPipelineOptions = {
    clearLogFiles?: string[],
    /**if outputDir is a valid directory, entityProcessor will write output to files here. */
    outputDir?: string,
    /**
     * - stop after specific stage for the first file in filePaths. 
     * - leave undefined to process all files in filePaths 
     * */
    stopAfter?: EntityPipelineStageEnum,
    parseOptions?: ParseDictionary,
    responseOptions?: RecordResponseOptions
}
/**
 * @param options 
 * @param fileName 
 * @param stage 
 * @param stageData 
 * @returns 
 */
function done(
    options: EntityPipelineOptions, 
    fileName: string,
    stage: EntityPipelineStageEnum,
    stageData: Record<string, any>,
): boolean {
    const { stopAfter, outputDir } = options;
    if (outputDir && fs.existsSync(outputDir)) {
        const outputPath = path.join(outputDir, `${fileName}_${stage}.json`);
        write(stageData, outputPath);
    }
    if (stopAfter && stopAfter === stage) {
        mlog.info(`[END runEntityPipeline()] - done(options...) returned true`,
            TAB+`fileName: '${fileName}'`,
            TAB+`   stage: '${stage}'`,
            outputDir 
                ? TAB+`saved to: '`+path.join(outputDir, `${fileName}_${stage}.json`)+`'` 
                : '',
        );
        return true;
    }
    return false;
}



/**
 * @note updating entities might not be necessary any more?
 * @param entityType {@link EntityRecordTypeEnum} (`string`)
 * @param filePaths `string | string[]`
 * @param options {@link EntityPipelineOptions}
 * @returns **`void`**
 */
export async function runEntityPipeline(
    entityType: EntityRecordTypeEnum,
    filePaths: string | string[],
    options: EntityPipelineOptions
): Promise<void> {
    if (!entityType || !filePaths 
        || (typeof filePaths !== 'string' && !isNonEmptyArray(filePaths))) {
        mlog.error(`[runEntityPipeline()] entityType or filePaths is undefined or invalid.`);
    }
    filePaths = isNonEmptyArray(filePaths) ? filePaths : [filePaths];
    if (isNonEmptyArray(options.clearLogFiles)) clearFileSync(...options.clearLogFiles);
    mlog.info(`[START runEntityPipeline()]`);
    for (let i = 0; i < filePaths.length; i++) {
        const csvFilePath = filePaths[i];
        let fileName = path.basename(csvFilePath);
        const parseOptions: ParseDictionary = {
            [entityType]: CUSTOMER_PARSE_OPTIONS,
            [RecordTypeEnum.CONTACT]: CONTACT_PARSE_OPTIONS
        };
        const {parseResults, meta} = await parseRecordCsv(
            csvFilePath, parseOptions
        );
        if (done(options, fileName, EntityPipelineStageEnum.PARSE, {parseResults, meta})) return;
        const validatedResults: ValidatedParseResults = await processParseResults(
            parseResults, 
            POST_PROCESSING_OPTIONS as PostProcessDictionary 
        );
        if (done(options, fileName, EntityPipelineStageEnum.VALIDATE, validatedResults)) return;
        
        const entityResponses: RecordResponse[] 
            = await putEntities(validatedResults[entityType].valid);
        if (done(options, fileName, EntityPipelineStageEnum.ENTITIES, entityResponses)) return;
        
        await DELAY(TWO_SECONDS);
        const matches: RecordOptions[] = matchContactsToEntityResponses(
            validatedResults[RecordTypeEnum.CONTACT].valid, 
            entityResponses
        ).matches;
        const contactResponses: RecordResponse[] = await putContacts(matches);
        if (done(options, fileName, EntityPipelineStageEnum.CONTACTS, contactResponses)) return;
        
        // const entityUpdates: RecordOptions[] = generateEntityUpdates(
        //     entityType,
        //     contactResponses
        // );
        // if (done(options, fileName, EntityProcessorStageEnum.GENERATE, entityUpdates)) return;
        
        // await DELAY(TWO_SECONDS);
        // const updateResponses: RecordResponse[] = await putEntities(
        //     entityUpdates
        // );
        // if (done(options, fileName, EntityProcessorStageEnum.UPDATE, updateResponses)) return;
    }
    mlog.info(`[END runEntityPipeline()]`);
    STOP_RUNNING(0);
}


/**
 * - payload normalization handled by {@link upsertRecordPayload}`()`
 * @param entities `Array<`{@link RecordOptions}`>`
 * @param responseOptions {@link RecordResponseOptions} - properties to return in the response.
 * - `default` = {@link ENTITY_RESPONSE_OPTIONS}
 * @returns **`entityResponses`** `Promise<`{@link RecordResponse}`[]`
 */
export async function putEntities(
    entities: RecordOptions[],
    responseOptions: RecordResponseOptions=ENTITY_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    try {
        const entityRequest: RecordRequest = {
            recordOptions: entities,
            responseOptions
        };
        const entityResponses: RecordResponse[] = 
            await upsertRecordPayload(entityRequest);
        return entityResponses;
    } catch (error) {
        mlog.error(`putEntities() Error putting entities.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            path.join(getProjectFolders().logDir, 'errors', 'ERROR_putEntities.json')
        );
    }
    return [];
}

/**
 * @param contacts `Array<`{@link RecordOptions}`>` - should be {@link matchContactsToEntityResponses}'s return value, `matches`
 * @param responseProps {@link RecordResponseOptions} - properties to return in the response.
 * @returns **`contactResponses`** `Promise<`{@link RecordResponse}`[]>`
 */
export async function putContacts(
    contacts: RecordOptions[],
    responseOptions: RecordResponseOptions= CONTACT_RESPONSE_OPTIONS
): Promise<RecordResponse[]> {
    try {
        const contactRequest: RecordRequest = {
            recordOptions: contacts,
            responseOptions
        };
        const contactResponses: RecordResponse[] = 
            await upsertRecordPayload(contactRequest);
        return contactResponses;
    } catch (error) {
        mlog.error(`putContacts() Error putting contacts.`);
        write({timestamp: getCurrentPacificTime(), caught: error as any}, 
            path.join(getProjectFolders().logDir, 'errors', 'ERROR_putContacts.json')
        );
    }
    return [] as RecordResponse[];
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
 * @description match `internalid`s of entity post results to contacts
 * @param contacts `Array<`{@link RecordOptions}`>`
 * @param entityResponses `Array<`{@link RecordResponse}`>`
 * @returns `{ matches: Array<`{@link RecordOptions}`>, errors: Array<`{@link RecordOptions}`> }`
 * - **`matches`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'F'` (i.e. a company) -> need to make a contact record.
 * - **`errors`**: - contacts corresponding to an entity in netsuite where `entity.isperson === 'T'` (i.e. a person) -> no need to make a contact record.
 */
export function matchContactsToEntityResponses(
    contacts: RecordOptions[], 
    entityResponses: RecordResponse[]
): {
    matches: RecordOptions[], 
    errors: RecordOptions[],
} {
    const entityResults: RecordResult[] = getRecordResults(entityResponses);
    const matches: RecordOptions[] = [];
    const errors: RecordOptions[] = [];
    for (let i = 0; i < contacts.length; i++) {
        const contact: RecordOptions = contacts[i];
        if (!contact || !contact.fields) {
            mlog.warn(`contact is undefined or has no fields at contacts[index=${i}]. Continuing...`);
            continue;
        }   
        const contactCompany: string = contact?.fields?.company as string;
        if (!contactCompany) {
            // mlog.debug(`contactCompany is undefined -> isPerson(entity)===true -> no need to worry about the select field. continuing...`);
            errors.push(contact);
            continue;
        }
        const contactId = String(contact?.fields?.entityid) || '';
        const contactExternalId = String(contact?.fields?.externalid) || '';
        /**
         * - `if` turn on customer numbering in NetSuite Setup, 
         * `then` responseProp value for `entityid` is: 
         * > `'${customerNumber} ${originalEntityId}'` 
         * - `therefore` `if` `(/^\d{4,} /.test(entityId)` extract the `entityid` value to compare in lookup 
         * by using indexOf(' ')+1 and slice() to get the part after the first space.
         * */
        const entityMatch = entityResults.find(entityResult => {
            let entityId = String(entityResult?.fields?.entityid) || '';
            let entityCompany = String(entityResult?.fields?.companyname) || '';
            let entityExternalId = String(entityResult?.fields?.externalid) || '';
            return Boolean(entityId && entityId === contactId 
                || (/^\d{4,} /.test(entityId) ? entityId.slice(entityId.indexOf(' ')+1) : entityId) === contactCompany
                || entityCompany && entityCompany === contactCompany
                || entityId && entityId === contactCompany
                || entityExternalId && entityExternalId.split('<')[0] === contactExternalId.split('<')[0]
            );
        });
        // either no entity match found, 
        // or entity is a person and thus a contact record cannot be made for it.
        if (!entityMatch || !entityMatch.internalid 
            || (entityMatch.fields && entityMatch.fields.isperson === RADIO_FIELD_TRUE)
        ) {
            mlog.debug(`[matchContactsToEntityResponses()] - no entity match for contact`,
                TAB+`contact entityid: '${contactId}'`,
                TAB+` contact company: '${contactCompany}'`,
                TAB+`  no entityMatch ? ${!entityMatch}`,
                TAB+`   no internalid ? ${entityMatch && !entityMatch.internalid}`,
                TAB+`isperson === 'T' ? ${entityMatch && entityMatch.fields && entityMatch.fields.isperson === RADIO_FIELD_TRUE}`,
            ); 
            errors.push(contact);
            continue;
        }
        contact.fields.company = entityMatch.internalid;
        matches.push(contact);
    }
    return {
        matches: matches,
        errors: errors
    };
}


/** 
 * @param entityType `string` - type of the primary entity to update
 * @param contactResponses `Array<`{@link RecordResponse}`>` - responses from initial contact post.
 * @returns **`entityUpdates`** = `Array<`{@link RecordOptions}`>` - updates to set `entity.contact` to `internalid` of entity-company's corresponding contact 
 * */
export function generateEntityUpdates(
    entityType: RecordTypeEnum,
    contactResponses: RecordResponse[]
): RecordOptions[] {
    const entityUpdates: RecordOptions[] = [];
    const contactResults: RecordResult[] = getRecordResults(contactResponses);    
    for (let contactResult of contactResults) {
        if (!contactResult || !contactResult.fields) {
            mlog.warn(`[generateEntityUpdates()] contactResult or contactResult.fields is undefined. Continuing...`);
            continue;
        }
        const update: RecordOptions = {
            recordType: entityType,
            idOptions: [],
            fields: {
                contact: contactResult.internalid 
            } as FieldDictionary,
        };
        update.idOptions?.push(
            { 
                idProp: idPropertyEnum.INTERNAL_ID, 
                searchOperator: SearchOperatorEnum.RECORD.ANY_OF, 
                idValue: contactResult.fields.company as number
                // contact.fields.company = ${entityType}'s internalid
            },
            // { 
            //     idProp: idPropertyEnum.ENTITY_ID, 
            //     searchOperator: SearchOperatorEnum.RECORD.ANY_OF, 
            //     idValue: contactResult.fields.company as string
            // },
            { 
                idProp: idPropertyEnum.ENTITY_ID, 
                searchOperator: SearchOperatorEnum.TEXT.IS, 
                idValue: contactResult.fields.entityid as string
            },
        );
        if (isNonEmptyString(contactResult.fields.externalid)) {
            update.idOptions?.push({
                idProp: idPropertyEnum.EXTERNAL_ID, 
                searchOperator: SearchOperatorEnum.TEXT.IS, 
                idValue: contactResult.fields.externalid.replace(/<.*?>/g, `<${entityType}>`)
            });
        }
        entityUpdates.push(update);
    }
    return entityUpdates;
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
