/**
 * @file src/main.ts
 */
import path from 'node:path';
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    parseCsvForOneToMany
} from "./utils/io";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, CLOUD_LOG_DIR } from "./config/env";
import { mainLogger as log, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS, indentedStringify } from "./config/setupLog";
import {
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS,
    PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS as CUSTOMER_OPTIONS
} from "./parses/customer/customerParseDefinition";
import { parseEntityFile, postEntities, postContacts, matchContactsToPostEntityResponses, countCompanyEntities, postEntitiesAndContacts, generateEntityUpdates, getPostResults } from "./parses/parseEntity";
import { EntityRecordTypeEnum, DeleteRecordByTypeRequest, DeleteExcludeOptions, DeleteRecordByTypeResponse, PostRecordOptions, BatchPostRecordResponse } from "./utils/api/types";
import { parseCsvToPostRecordOptions } from './parseCsvToRequestBody';
import { SB_REST_SCRIPTS, BATCH_SIZE, deleteRecordByType } from "./utils/api/callApi";
import * as customerFiles from './parses/customer/customerParseConstants';

/** 
 * `main()` is same as {@link postEntitiesAndContacts}`(...)`, 
 * but I rewrote the logic here because I wanted to check some log output 
 * */
async function main() {
    const startTime = new Date();
    const filePath = customerFiles.REMAINING_ROWS_FILE;
    const entityType = EntityRecordTypeEnum.CUSTOMER;
    log.info(NL + `main() starting at ${startTime.toLocaleString()}`,
        TAB + `  filePath: "${filePath}"`,
        TAB + `entityType: "${entityType}"`,
    );
    const { entities, contacts } = await parseEntityFile(
        filePath,
        entityType,
        [CUSTOMER_OPTIONS, CONTACT_OPTIONS]
    );
    const firstPostStart = new Date();
    log.info(
        // `Finished parseEntityFile() at after ${((firstPostStart.getTime() - startTime.getTime()) / 1000).toFixed(5)} seconds.`, 
        `calling postEntities() at ${firstPostStart.toLocaleString()}`,
    );
    const entityResponses: BatchPostRecordResponse[] = await postEntities(entities);
    const entityRejects = entityResponses.map(
        response => response.rejects as PostRecordOptions[]
    ).flat();
    log.info(`First Post (entities) Elapsed Time: ${
        ((new Date().getTime() - firstPostStart.getTime()) / 1000).toFixed(5)
    } seconds.`);

    const { companyContacts, unmatchedContacts} 
        = matchContactsToPostEntityResponses(contacts, entityResponses);
    if (companyContacts.length === 0) {
        log.warn(`companyContacts.length === 0. Exiting.`);
        STOP_RUNNING(1);
    }
    const secondPostStart = new Date();
    const contactResponses: BatchPostRecordResponse[] = await postContacts(companyContacts);
    log.info(`Second Post (contacts) Elapsed Time: ${
        ((new Date().getTime() - secondPostStart.getTime()) / 1000).toFixed(5)
    } seconds.`,);
    if (contactResponses.length === 0) {
        log.warn(`contactResponses.length === 0. Exiting.`);
        STOP_RUNNING(1);
    }
    const contactRejects = contactResponses.map(
        response => response.rejects as PostRecordOptions[]
    ).flat();
    
    const entityUpdates: PostRecordOptions[]
        = generateEntityUpdates(EntityRecordTypeEnum.CUSTOMER, contactResponses);
    const thirdPostStart = new Date();
    const entityUpdateResponses: BatchPostRecordResponse[] = await postEntities(entityUpdates);
    log.info(`Third Post (entity updates) Elapsed Time: ${
        ((new Date().getTime() - thirdPostStart.getTime()) / 1000).toFixed(5)
    } seconds.`);
    if (entityUpdateResponses.length === 0) {
        log.warn(`entityUpdateResponses.length === 0. Exiting.`);
        STOP_RUNNING(1);
    }
    const entityUpdateRejects = entityUpdateResponses.map(
        response => response.rejects as PostRecordOptions[]
    ).flat();
    const endTime = new Date();
    log.info(`main() completed at ${endTime.toLocaleString()}`,
        NL + `Total Elapsed Time: ${(
            (endTime.getTime() - startTime.getTime()) / 1000
        ).toFixed(5)} seconds.`,
        NL  + '-'.repeat(80),
        NL  + `parse + post Results for entityType: '${entityType}'`,
        NL  + `[1] upsertRecordPayload = ${entityType}s `,
        TAB + `            ${entityType}s.length: ${entities.length}`,
        TAB + `  ${entityType}PostResults.length: ${getPostResults(entityResponses).length}`,
        TAB + `      ${entityType}Rejects.length: ${entityRejects.length}`,
        NL  + `[2] upsertRecordPayload = companyContacts`,
        TAB + `              contacts.length: ${contacts.length}`,
        TAB + `       companyContacts.length: ${companyContacts.length}`,
        // TAB + `     unmatchedContacts.length: ${unmatchedContacts.length}`,
        TAB + `        contactResults.length: ${getPostResults(contactResponses).length}`,
        TAB + `        contactRejects.length: ${contactRejects.length}`,
        NL  + `[3] upsertRecordPayload = ${entityType}Updates`,
        TAB + `      ${entityType}Updates.length: ${entityUpdates.length}`,
        TAB + `${entityType}UpdateResults.length: ${getPostResults(entityUpdateResponses).length}`,
        TAB + `${entityType}UpdateRejects.length: ${entityUpdateRejects.length}`,
    );
    write(
        {entityRejects, contactRejects, entityUpdateRejects} as Record<string, any>, 
        CLOUD_LOG_DIR, `${entityType}CumulativeRejects.json`
    );
    STOP_RUNNING(0, NL + 'main.ts: End of main()');
}
main().catch(error => {
    log.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});









