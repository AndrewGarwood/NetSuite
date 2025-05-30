import { 
    readJsonFileAsObject as read, 
    writeObjectToJson as write,
    parseCsvForOneToMany 
} from "./utils/io";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING } from "./config/env";
import { mainLogger as log, INDENT_LOG_LINE as TAB } from "./config/setupLog";
import { 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS,
    PARSE_CUSTOMER_FROM_CUSTOMER_CSV_OPTIONS as CUSTOMER_OPTIONS 
} from "./parses/customer/customerParseDefinition";
import { parseEntityFile, postEntityRecords } from "./parses/parseEntity";
import { EntityRecordTypeEnum, DeleteRecordByTypeRequest, DeleteExcludeOptions, DeleteRecordByTypeResponse  } from "./utils/api/types";
import { parseCsvToPostRecordOptions } from './parseCsvToRequestBody';
import { SB_REST_SCRIPTS, BATCH_SIZE, deleteRecordByType } from "./utils/api/callApi";
import path from 'node:path';

import * as customerFiles from './parses/customer/parseCustomer';

async function main() {
    const {entities: customers, contacts } = await parseEntityFile(
        customerFiles.SINGLE_COMPANY_FILE, 
        EntityRecordTypeEnum.CUSTOMER, 
        [CUSTOMER_OPTIONS, CONTACT_OPTIONS]
    );
    try {
        const { 
            entityResponses: customerResponses,
            contactResponses: contactResponses,
            entityUpdateResponses: customerUpdateResponses, 
        } = await postEntityRecords(
            EntityRecordTypeEnum.CUSTOMER, customers, contacts
        );
    } catch (error) {
        log.error('Error posting entity records', error);
    }
    STOP_RUNNING(0, 'main.ts: End of main()');
}
main().catch(error => {
    log.error('Error executing main() function', Object.keys(error));
    STOP_RUNNING(1);
});
// const res = await deleteRecordByType(
//     { recordType: EntityRecordTypeEnum.CUSTOMER } as DeleteRecordByTypeRequest
// );
// const resData = await res.data as DeleteRecordByTypeResponse;
// write(resData, path.join(OUTPUT_DIR, 'deleteCustomers.json'));








