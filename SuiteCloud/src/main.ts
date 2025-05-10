import { readJsonFileAsObject, writeObjectToJson, getCurrentPacificTime, calculateDifferenceOfDateStrings, TimeUnitEnum, printConsoleGroup as print } from "./utils/io";
import { callPostRestletWithPayload, callGetRestletWithParams } from "./utils/api";
import { TOKEN_DIR, DATA_DIR, OUTPUT_DIR, STOP_RUNNING, SCRIPT_ENVIORNMENT as SE } from "./config/env";
import { mainLogger as log } from "./config/setupLog";
import { RecordTypeEnum } from "./utils/api/types/NS/Record/Record";
import { initiateAuthFlow, CLOSE_SERVER } from "./server/authServer";
import { TokenResponse } from "./server/types/TokenResponse";
import { CreateRecordOptions, BatchCreateRecordRequest, RetrieveRecordByIdRequest, RetrieveRecordByIdResponse, idPropertyEnum, BatchCreateRecordResponse, CreateRecordResult, SetFieldValueOptions } from "./utils/api/types/Api";
import { parseCsvToCreateOptions } from './parseCsvToRequestBody';
import { 
    PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS as VENDOR_OPTIONS, 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS
} from "./vendorParseDefinition";
import { ScriptDictionary } from "./utils/api/types/NS/SuiteScriptEnvironment";
import path from 'node:path';

const VENDOR_DIR = `${DATA_DIR}/vendors` as string;
const SINGLE_COMPANY_FILE = `${VENDOR_DIR}/single_company_vendor.tsv` as string;
const SINGLE_HUMAN_FILE = `${VENDOR_DIR}/single_human_vendor.tsv` as string;
const SUBSET_FILE = `${VENDOR_DIR}/vendor_subset.tsv` as string;

const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
const STEP2_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP2_tokens.json') as string;
const STEP3_TOKENS_PATH = path.join(TOKEN_DIR, 'STEP3_tokens.json') as string;
const REFRESH_TOKEN_IS_AVAILABLE = true;
const REFRESH_TOKEN_IS_NOT_AVAILABLE = false;



async function main() {
    const { vendors, contacts } = await parseVendorFile(SINGLE_COMPANY_FILE);
    writeObjectToJson({ vendors: vendors}, 'vendors_option_array.json', OUTPUT_DIR, 4, true);
    writeObjectToJson({ contacts: contacts}, 'contacts_option_array.json', OUTPUT_DIR, 4, true);
    STOP_RUNNING(0, "let's see what they look like");
    log.info(`vendors.length: ${vendors.length}, contacts.length: ${contacts.length}`)
    if (vendors.length === 0 || contacts.length === 0) {
        log.error('No vendors and no contacts were parsed from the CSV file. Exiting...');
        STOP_RUNNING(1);
    }
    const vendorPayload: BatchCreateRecordRequest = {
        createRecordArray: vendors,
        responseProps: ['entityid', 'isperson']
    }
    const vendorRes = await callBatchCreateRecord(vendorPayload);
    const vendorResData = await vendorRes.data as BatchCreateRecordResponse;
    if(!vendorResData) {
        log.error('vendorRes.data is undefined. Exiting...');
        STOP_RUNNING(1);
    }
    log.debug(`vendorResData.results.length `, vendorResData.results.length);
    writeObjectToJson(vendorResData, `subset_vendor_Response.json`, OUTPUT_DIR, 4, true);
    const vendorResults: CreateRecordResult[] = vendorResData?.results as CreateRecordResult[];
    const removedContacts: CreateRecordOptions[] = [];
    contacts.forEach((contact: CreateRecordOptions, index: number) => {
        let contactCompanyField = contact.fieldDict?.valueFields?.find(
            field => field.fieldId === 'company') as SetFieldValueOptions;
        let contactCompany = contactCompanyField?.value as string;
        if (!contactCompany) {
            log.debug(`contactCompany is undefined (vendor is a person). continuing...`);
            return
        }
        let vendorInternalId = vendorResults.find(
            vendorResult => vendorResult?.entityid === contactCompany
        )?.recordId;
        if (!vendorInternalId) {
            // log.error(`vendorInternalId is undefined for contact at index=${index}.`, 
            //     `removing contacts[${index}]. continuing...`);
            removedContacts.push(...contacts.splice(index, 1));
            return
        }
        contactCompanyField.value = vendorInternalId;
    });
    log.debug(`removedContacts.length: ${removedContacts.length}`);
    const contactsPayload: BatchCreateRecordRequest = {
        createRecordArray: contacts,
        responseProps: ['entityid', 'firstname', 'lastname']
    }
    const contactRes = await callBatchCreateRecord(contactsPayload);
    const contactResData = await contactRes.data as BatchCreateRecordResponse;
    if(!contactResData) {
        log.debug('contactRes.data is undefined. Exiting...');
        STOP_RUNNING(1);
    }
    log.debug(`contactResData.results.length `, contactResData.results.length);
    writeObjectToJson({removed: removedContacts}, `subset_removed_contact.json`, OUTPUT_DIR, 4, true);
    writeObjectToJson(contactResData, `subset_contact_Response.json`, OUTPUT_DIR, 4, true);
    STOP_RUNNING(0);
}
main().catch(error => {
    log.error('Error executing main() function:', error);
});


// contact creation has field dependencies on vendor creation, so we need to create the vendors first.
async function parseVendorFile(
    filePath: string
): Promise<{vendors: CreateRecordOptions[], contacts: CreateRecordOptions[]}> {
    try {
        const vendorResult: CreateRecordOptions[] = 
            await parseCsvToCreateOptions(filePath, [VENDOR_OPTIONS]);
        const contactResult: CreateRecordOptions[] = 
            await parseCsvToCreateOptions(filePath, [CONTACT_OPTIONS]);
        return { vendors: vendorResult, contacts: contactResult };
    } catch (error) {
        log.error('Error parsing CSV to CreateRecordOptions:', error);
        return { vendors: [], contacts: [] };
    }
}

async function callBatchCreateRecord(
    payload: BatchCreateRecordRequest, 
    scriptId: number=Number(SB_REST_SCRIPTS.POST_BatchCreateRecord.scriptId), 
    deployId: number=Number(SB_REST_SCRIPTS.POST_BatchCreateRecord.deployId),
): Promise<any> {
    let accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('callBatchCreateRecord() getAccessToken() is undefined. Cannot call RESTlet.');
        STOP_RUNNING();
    }
    try {
        const res = await callPostRestletWithPayload(
            accessToken,
            scriptId,
            deployId,
            payload,
        );
        return res;
    } catch (error) {
        log.error('Error in main.ts callBatchCreateRecord()', error);
        throw error;
    }
}

// const payload: RetrieveRecordByIdRequest = {
//     recordType: RecordTypeEnum.VENDOR,
//     idProperty: idPropertyEnum.ENTITY_ID,
//     searchTerm: 'UW Libraries'
// };
// const res = await callRetrieveRecordById(payload);
// writeObjectToJson(res.data, `vendor_retrieve_by_id.json`, OUTPUT_DIR, 4, true);
async function callRetrieveRecordById(
    payload: RetrieveRecordByIdRequest,
    scriptId: number=Number(SB_REST_SCRIPTS.GET_RetrieveRecordById.scriptId),
    deployId: number=Number(SB_REST_SCRIPTS.GET_RetrieveRecordById.deployId),
): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        log.error('accessToken is undefined. Cannot call RESTlet.');
        STOP_RUNNING();
    }
    try {
        const res = await callGetRestletWithParams(
            accessToken,
            scriptId,
            deployId,
            payload,
        )
        return res;
    } catch (error) {
        log.error('Error in main.ts callRetrieveRecordById()', error);
        throw error;
    }
}

export async function getAccessToken(): Promise<string> {
    let accessToken = readJsonFileAsObject(STEP3_TOKENS_PATH)?.access_token || readJsonFileAsObject(STEP2_TOKENS_PATH)?.access_token ||  '';
    let refreshToken = readJsonFileAsObject(STEP2_TOKENS_PATH)?.refresh_token || '';
    const accessTokenIsExpired = localTokensHaveExpired(STEP3_TOKENS_PATH);
    const refreshTokenIsExpired = localTokensHaveExpired(STEP2_TOKENS_PATH);
    try {
        if ((!accessToken || accessTokenIsExpired) && refreshToken && !refreshTokenIsExpired) {
            log.info(
                'Access token is expired or undefined, Refresh token is available.',
                'Initiating auth flow from exchangeRefreshTokenForNewTokens()...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_IS_AVAILABLE) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else if ((!accessToken || accessTokenIsExpired) && (!refreshToken || refreshTokenIsExpired)) {
            log.info(
                'Access token is expired or undefined. Refresh token is also undefined.', 
                'Initiating auth flow from the beginning...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow() as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else {
            log.info('Access token is valid. Proceeding with RESTlet call...');
        }
        CLOSE_SERVER();
        return accessToken as string;
    } catch (error) {
        log.error('Error in main.ts getAccessToken()', error);
        throw error;
    }
}

/**
 * 
 * @param filePath - path to the local json file containing the {@link TokenResponse}, defaults to {@link STEP2_TOKENS_PATH} = `${OUTPUT_DIR}/STEP2_tokens.json`
 * @description Checks if the TokenResponse stored locally in a json file have expired by comparing the current time with the last updated time and the expiration time.
 * - `TokenResponse.expires_in`'s default value is 3600 seconds (1 hour) as per OAuth2.0 standard.
 * @returns {boolean} `true` if a duration greater than or equal to the token lifespan (`TokenResponse.expires_in`) has passed since the last updated time, `false` otherwise.
 */
export function localTokensHaveExpired(filePath: string=STEP2_TOKENS_PATH): boolean {
    try {
        const tokenResponse = readJsonFileAsObject(filePath) as TokenResponse;
        if (!tokenResponse) {
            log.error('tokenResponse is undefined. Cannot check expiration.');
            return true;
        }
        if (!tokenResponse?.lastUpdated || !tokenResponse?.expires_in) {
            log.error('lastUpdated or expires_in key in local json file is undefined. Cannot check expiration.');
            return true;
        }
        const currentTime: string = getCurrentPacificTime();
        const lastUpdatedTime = String(tokenResponse?.lastUpdated);
        const tokenLifespan = Number(tokenResponse?.expires_in);
        const msDiff = calculateDifferenceOfDateStrings(lastUpdatedTime, currentTime, TimeUnitEnum.MILLISECONDS, true) as number;
        const haveExpired = (msDiff != 0 && msDiff >= tokenLifespan * 1000)
        // print({label: 'localTokensHaveExpired()', details: `(${msDiff} != 0 && ${msDiff} >= ${tokenLifespan} * 1000) = ${haveExpired}`});
        return haveExpired;
    } catch (error) {
        log.error('Error in localTokensHaveExpired(), return default (true):', error);
        return true;
    } 
}

/**
 * 
 * @param {Array<any>} arr `Array<any>`
 * @param {number} batchSize `number`
 * @returns {Array<Array<any>>} `batches` — `Array<Array\<any>>`
 */
function partitionArrayBySize(arr: Array<any>, batchSize: number): Array<Array<any>> {
    let batches = [];
    for (let i = 0; i < arr.length; i += batchSize) {
        batches.push(arr.slice(i, i + batchSize));
    }
    return batches;
}