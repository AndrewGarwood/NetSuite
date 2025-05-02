import { readJsonFileAsObject, writeObjectToJson, getCurrentPacificTime, calculateDifferenceOfDateStrings, TimeUnitEnum, printConsoleGroup } from "./utils/io";
import { callPostRestletWithPayload, MISSION_VIEJO_LIBRARY_CREATE_VENDOR_OPTIONS, UW_LIBRARIES_CREATE_VENDOR_OPTIONS } from "./utils/api";
import { DATA_DIR, OUTPUT_DIR, STOP_RUNNING, SCRIPT_ENVIORNMENT as SE, CLOSE_SERVER } from "./config/env";
import { RecordTypeEnum } from "./utils/api/types/NS/Record";
import { initiateAuthFlow, getAuthCode, exchangeAuthCodeForTokens, exchangeRefreshTokenForNewTokens } from "./server/authServer";
import { TokenResponse } from "./server/types";
import { CreateRecordOptions, CreateRecordResponse, FieldDictionary, SublistFieldDictionary, SetSublistTextOptions, BatchCreateRecordRequest, BatchCreateRecordResponse, SetSubrecordOptions } from "./utils/api/types/Api";
import { parseCsvToCreateOptions } from './parseCsvToRequestBody';
import { 
    PARSE_VENDOR_FROM_VENDOR_CSV_OPTIONS as VENDOR_OPTIONS, 
    PARSE_CONTACT_FROM_VENDOR_CSV_PARSE_OPTIONS as CONTACT_OPTIONS
} from "./vendorParseDefinition";
import { logger as log } from "./config/logging";
import { ScriptDictionary } from "./utils/api/types/NS/SuiteScriptEnvironment";

const SB_REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
const STEP2_TOKENS_PATH = `${OUTPUT_DIR}/STEP2_tokens.json`;
const STEP3_TOKENS_PATH = `${OUTPUT_DIR}/STEP3_tokens.json`;
const REFRESH_TOKEN_IS_AVAILABLE = true;
const REFRESH_TOKEN_IS_NOT_AVAILABLE = false;


async function main() {
    const VENDOR_DIR = `${DATA_DIR}/vendors` as string;
    const SINGLE_COMPANY_FILE = `${VENDOR_DIR}/single_company_vendor.tsv` as string;
    const SINGLE_HUMAN_FILE = `${VENDOR_DIR}/single_human_vendor.tsv` as string;
    const SUBSET_FILE = `${VENDOR_DIR}/vendor_subset.tsv` as string;
    const { vendors, contacts } = await parseVendorFile(SINGLE_HUMAN_FILE);
    const payload: BatchCreateRecordRequest = {
        createRecordDict: {
            [RecordTypeEnum.VENDOR]: vendors,
            [RecordTypeEnum.CONTACT]: contacts,
        }
    }
    const res = await callBatchCreateRecord(payload);
    writeObjectToJson(await res.data, `single_human_vendor_Response.json`, OUTPUT_DIR, 4, true);
    STOP_RUNNING();
}
main().catch(error => {
    console.error('Error executing main.ts main() function:', error);
});

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
        console.error('Error parsing CSV to CreateRecordOptions:', error);
        return { vendors: [], contacts: [] };
    }
}

async function callBatchCreateRecord(
    payload: BatchCreateRecordRequest, 
    scriptId: number=Number(SB_REST_SCRIPTS.POST_BatchCreateRecord.scriptId), 
    deployId: number=Number(SB_REST_SCRIPTS.POST_BatchCreateRecord.deployId),
): Promise<any> {
    let accessToken = readJsonFileAsObject(STEP3_TOKENS_PATH)?.access_token || readJsonFileAsObject(STEP2_TOKENS_PATH)?.access_token ||  '';
    let refreshToken = readJsonFileAsObject(STEP2_TOKENS_PATH)?.refresh_token || '';
    const accessTokenIsExpired = localTokensHaveExpired(STEP3_TOKENS_PATH);
    const refreshTokenIsExpired = localTokensHaveExpired(STEP2_TOKENS_PATH);
    try {
        if ((!accessToken || accessTokenIsExpired) && refreshToken && !refreshTokenIsExpired) {
            console.log(
                'Access token is expired or undefined, Refresh token is available.',
                'Initiating auth flow from exchangeRefreshTokenForNewTokens()...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_IS_AVAILABLE) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else if ((!accessToken || accessTokenIsExpired) && (!refreshToken || refreshTokenIsExpired)) {
            console.log(
                'Access token is expired or undefined. Refresh token is also undefined.', 
                'Initiating auth flow from the beginning...'
            );
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_IS_NOT_AVAILABLE) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else {
            console.log('Access token is valid. Proceeding with RESTlet call...');
        }
        CLOSE_SERVER();
        if (!accessToken) {
            console.error('Access token is undefined. Cannot call RESTlet.');
            STOP_RUNNING();
        }
        return await callPostRestletWithPayload(
            accessToken,
            scriptId,
            deployId,
            payload,
        );
    } catch (error) {
        console.error('Error in main.ts callBatchCreateRecord()', error);
        throw error;
    }
}


/**
 * 
 * @param filePath - path to the local json file containing the {@link TokenResponse}, defaults to {@link STEP2_TOKENS_PATH} = `${OUTPUT_DIR}/STEP2_tokens.json`
 * @description Checks if the TokenResponse stored locally in a json file have expired by comparing the current time with the last updated time and the expiration time.
 * - `TokenResponse.expires_in`'s default value is `3600 seconds` (1 hour) as per OAuth2.0 standard.
 * @returns {boolean} `true` if a duration greater than or equal to the token lifespan (`TokenResponse.expires_in`) has passed since the last updated time, `false` otherwise.
 */
export function localTokensHaveExpired(filePath: string=STEP2_TOKENS_PATH): boolean {
    try {
        const tokenResponse = readJsonFileAsObject(filePath) as TokenResponse;
        if (!tokenResponse) {
            console.error('Token response is undefined. Cannot check expiration.');
            return true;
        }
        if (!tokenResponse?.lastUpdated || !tokenResponse?.expires_in) {
            console.error('lastUpdated or expires_in key in local json file is undefined. Cannot check expiration.');
            return true;
        }
        const currentTime: string = getCurrentPacificTime();
        const lastUpdatedTime = String(tokenResponse?.lastUpdated);
        const tokenLifespan = Number(tokenResponse?.expires_in);
        const msDiff = calculateDifferenceOfDateStrings(lastUpdatedTime, currentTime, TimeUnitEnum.MILLISECONDS, true) as number;
        const haveExpired = (msDiff != 0 && msDiff >= tokenLifespan * 1000)
        console.log(`\t(${msDiff} != 0 && ${msDiff} >= ${tokenLifespan} * 1000) = ${haveExpired}`);
        return haveExpired;
    } catch (error) {
        console.error('Error in localTokensHaveExpired(), return default (true):', error);
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