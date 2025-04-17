/**
 * @file main.ts
 * @description make http requests to NetSuite RESTlet scripts by using functions in api.ts
 */
import { initiateAuthFlow } from "./server/authServer";
import { callPostRestletWithPayload } from "./api";
import { STOP_RUNNING, SCRIPT_ENVIORNMENT as SE } from "./config/env";
import { RecordTypeEnum } from "./types/NS/Record";
import { getAuthCode, exchangeAuthCodeForTokens, refreshTokens } from "./server/authServer";
import { TokenResponse } from "./types/auth/TokenResponse";



async function main() {
    let accessToken = "ACCESS_TOKEN"; // Replace with your actual access token after running the auth flow
    try {
        const scriptId = SE.sandbox?.restlet?.POST_StoreFieldIdsOfRecordType?.scriptId as number;
        const deployId = SE.sandbox?.restlet?.POST_StoreFieldIdsOfRecordType?.deployId as number;
        const payload = { recordType: RecordTypeEnum.VENDOR };
        const response = await callPostRestletWithPayload(accessToken, scriptId, deployId, payload);
        console.log('RESTlet response:', response);
    } catch (error) {
        console.error('Error in main.ts main() after calling callPostRestletWithPayload():', error);
        throw error;
    }
}

main().catch(error => {
    console.error('Error executing main() function:', error);
});
