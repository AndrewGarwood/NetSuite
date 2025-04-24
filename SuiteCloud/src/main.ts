import { readJsonFileAsObject, writeObjectToJson, getCurrentPacificTime, calculateDifferenceOfDateStrings, TimeUnitEnum, printConsoleGroup } from "./utils/io";
import { callPostRestletWithPayload, MISSION_VIEJO_LIBRARY_CREATE_VENDOR_OPTIONS, UW_LIBRARIES_CREATE_VENDOR_OPTIONS } from "./utils/api";
import { DATA_DIR, OUTPUT_DIR, STOP_RUNNING, SCRIPT_ENVIORNMENT as SE, CLOSE_SERVER } from "./config/env";
import { RecordTypeEnum } from "./types/NS/Record";
import { initiateAuthFlow, getAuthCode, exchangeAuthCodeForTokens, exchangeRefreshTokenForNewTokens } from "./server/authServer";
import { TokenResponse } from "./types/auth/TokenResponse";
import { CreateRecordOptions, CreateRecordResponse, FieldDictionary, SublistFieldDictionary, SetSublistTextOptions, BatchCreateRecordRequest, BatchCreateRecordResponse, SetSubrecordOptions } from "./types/api/Api";
import { ScriptDictionary } from "./types/NS/SuiteScriptEnvironment";

const REST_SCRIPTS = SE.sandbox?.restlet || {} as ScriptDictionary;
const STEP2_TOKENS_PATH = `${OUTPUT_DIR}/STEP2_tokens.json`;
const STEP3_TOKENS_PATH = `${OUTPUT_DIR}/STEP3_tokens.json`;
const REFRESH_TOKEN_AVAILABLE = true;
const NO_REFRESH_TOKEN_AVAILABLE = false;


async function main() {
    let accessToken = readJsonFileAsObject(STEP3_TOKENS_PATH)?.access_token || readJsonFileAsObject(STEP2_TOKENS_PATH)?.access_token ||  '';
    let refreshToken = readJsonFileAsObject(STEP2_TOKENS_PATH)?.refresh_token || '';
    let areTokensExpired = localTokensHaveExpired(STEP3_TOKENS_PATH) && localTokensHaveExpired(STEP2_TOKENS_PATH);
    try {
        if ((!accessToken || areTokensExpired) && refreshToken) {
            console.log('Access token is expired or undefined. Initiating auth flow from exchangeRefreshTokenForNewTokens()...');
            let tokenRes: TokenResponse = await initiateAuthFlow(REFRESH_TOKEN_AVAILABLE, STEP2_TOKENS_PATH) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else if ((!accessToken || areTokensExpired) && !refreshToken) {
            console.log('Access token is expired or undefined. Refresh token is also undefined. Initiating auth flow from the beginning...');
            let tokenRes: TokenResponse = await initiateAuthFlow(NO_REFRESH_TOKEN_AVAILABLE, STEP2_TOKENS_PATH) as TokenResponse;
            accessToken = tokenRes?.access_token || '';
        } else {
            console.log('Access token is valid. Proceeding with RESTlet call...');
        }
        CLOSE_SERVER();
        if (!accessToken) {
            console.error('Access token is undefined. Cannot call RESTlet.');
            STOP_RUNNING();
        }
    
        const scriptId = REST_SCRIPTS.POST_BatchCreateRecord.scriptId as number;
        const deployId = REST_SCRIPTS.POST_BatchCreateRecord.deployId as number;  
        const vendorBatch: BatchCreateRecordRequest = {
            createRecordArray: [
                MISSION_VIEJO_LIBRARY_CREATE_VENDOR_OPTIONS, 
                UW_LIBRARIES_CREATE_VENDOR_OPTIONS
            ],
        }
        let response = await callPostRestletWithPayload(
            accessToken,
            scriptId,
            deployId,
            vendorBatch
        );
        writeObjectToJson(await response.data, 'BatchCreateRecordResponse.json', OUTPUT_DIR, 4, true);
        // console.log('Response.data.length', await response.data.length);
    } catch (error) {
        console.error('Error in main.ts main()', error);
        throw error;
    }
    STOP_RUNNING();
}

main().catch(error => {
    console.error('Error executing main.ts main() function:', error);
});

/**
 * 
 * @param filePath - path to the local json file containing the {@link TokenResponse}, defaults to {@link STEP2_TOKENS_PATH} = `${OUTPUT_DIR}/STEP2_tokens.json`
 * @description Checks if the TokenResponse stored locally in a json file have expired by comparing the current time with the last updated time and the expiration time.
 * - TokenResponse.expires_in's default value is 3600 seconds (1 hour) as per OAuth2.0 standard.
 * @returns {boolean} true if a duration greater than or equal to the token lifespan (TokenResponse.expires_in) has passed since the last updated time, false otherwise.
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
        const haveExpired = (msDiff != 0 && msDiff >= tokenLifespan * 1000) ? true : false;
        console.log(`(msDiff != 0 && msDiff >= tokenLifespan * 1000) ? true : false -> needToRefresh = ${haveExpired}`);
        return haveExpired;
    } catch (error) {
        console.error('Error in localTokensHaveExpired(), return default (true):', error);
        return true;
    } 
}
