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
import { parseEntityFile } from "./parses/parseEntity";
import { EntityRecordTypeEnum} from "./utils/api/types";
import { parseCsvToPostRecordOptions } from './parseCsvToRequestBody';
import { SB_REST_SCRIPTS, BATCH_SIZE } from "./utils/api/callApi";
import path from 'node:path';

import * as customerFiles from './parses/customer/parseCustomer';

async function main() {
    await parseEntityFile(
        customerFiles.SMALL_SUBSET_FILE, 
        EntityRecordTypeEnum.CUSTOMER, 
        [CUSTOMER_OPTIONS, CONTACT_OPTIONS]
    );
    STOP_RUNNING(0, 'end of main()');
}
main().catch(error => {
    log.error('Error executing main() function:', Object.keys(error));
    STOP_RUNNING(1);
});