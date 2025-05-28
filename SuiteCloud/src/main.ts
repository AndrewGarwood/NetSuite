import { 
    readJsonFileAsObject as read, 
    writeObjectToJson as write, 
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
        customerFiles.COMPLETE_FILE, 
        EntityRecordTypeEnum.CUSTOMER, 
        [CUSTOMER_OPTIONS, CONTACT_OPTIONS]
    );
    await postEntityRecords(
        EntityRecordTypeEnum.CUSTOMER,
        customers, contacts
    );
    log.info(`Parsed ${customers.length} customers and ${contacts.length} contacts from file`);
    STOP_RUNNING(0, 'end of main()');
}
main().catch(error => {
    log.error('Error executing main() function. error.keys=', Object.keys(error));
    STOP_RUNNING(1);
});

// const res = await deleteRecordByType(
//     { recordType: EntityRecordTypeEnum.CUSTOMER } as DeleteRecordByTypeRequest
// );
// const resData = await res.data as DeleteRecordByTypeResponse;
// write(resData, path.join(OUTPUT_DIR, 'deleteCustomers.json'));








