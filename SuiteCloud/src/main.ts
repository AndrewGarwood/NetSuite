import { initiateAuthFlow } from "./server/authServer";
import { callPostRestletWithPayload } from "./api";
import { STOP_RUNNING, SCRIPT_ENVIORNMENT as SE } from "./config/env";
import { RecordTypeEnum } from "./types/NS/Record";
import { getAuthCode, exchangeAuthCodeForTokens, refreshTokens } from "./server/authServer";
import { TokenResponse } from "./types/auth/TokenResponse";



async function main() {
    let refreshedTokens = undefined;
    // let accessToken = undefined;
    // try {
    //     let authCode = await getAuthCode();
    //     let initialTokenResponse = await exchangeAuthCodeForTokens(authCode);
    //     console.log('main.ts main() Initial TokenResponse:', initialTokenResponse);
    //     accessToken = initialTokenResponse?.access_token || '';
    // } catch (error) {
    //     console.error('Error in main.ts main() when calling manually calling authServer functions:', error);
    //     throw error;
    // }
    // try {
    //     res = await initiateAuthFlow(false);
    //     console.log('initiateAuthFlow(false) tokenResponse:', res);
    //     accessToken = res?.access_token || '';
    // } catch (error) {
    //     console.error('Error in main.ts main() after calling initiateAuthFlow(false):', error);
    //     throw error;
    // }
    // refreshedTokens = await initiateAuthFlow(true) as TokenResponse;
    // accessToken = refreshedTokens?.access_token || accessToken;
    // Step 4: Call the RESTlet with the access token
    // if (!accessToken) {
    //     console.error('Access token is undefined. Cannot call RESTlet.');
    //     STOP_RUNNING();
    // }
    let accessToken = "***REMOVED***.eyJzdWIiOiIzOzMiLCJhdWQiOlsiNDEwREQ0NDctM0RBNy00ODI0LUE5QTQtMkIyQTNCQTczNkQyOzk4NjY3MzhfU0IxIiwiN2ZmMTM5NDQ4NjkwMGQwZjc5ZDgyZDQwYzExMDYyNTZjMjM1ZWY1NzQwM2ZkZDEwYTBiNTg4NjQ2YTlkMzhlNSJdLCJzY29wZSI6WyJyZXN0bGV0cyJdLCJpc3MiOiJodHRwczovL3N5c3RlbS5uZXRzdWl0ZS5jb20iLCJvaXQiOjE3NDQ3NDczMDUsImV4cCI6MTc0NDc1MDkwNSwiaWF0IjoxNzQ0NzQ3MzA1LCJqdGkiOiI5ODY2NzM4X1NCMS5hLWEuNGE0ZWVlZTUtY2VjOC00MzMxLWFkNzgtYmFiNzlhYTFkYTBiXzE3NDQ3NDczMDUwMTEuMTc0NDc0NzMwNTAxMSJ9.fdIieo8y_a6Ci8vuZYIqhaO0-XJXeLGtKhP8lRvn_i0fAJuKRPuO_QJmW5jn7eAvJPNaqlDppb_wdfPlU-ZG0G9RYsQwuKmQwe1MIlgkyXTPalXa4j5BJY20e0hM_2pjSKHixJC0YYFTRI9-tYiPuACvRCM6Y1J6e2HRg30WPJkJBIPuUKyEXSHgyCevyjSLyTgqWOY7ea95VqzCs2NZg-CZb8oXOHZ2czB_pTlgTPe8paHmsGUY7chlJRghSEpKs46awrlqoEgIi5yRWMSjKLtrXk5UIJmiT9zoZxIvotD1D06ajyzqGJbKfxhFzjGTegT8HVH9S3iLo3fBbXgam06L_kLEH3g1NcW_KtlrUKSTRaq7TvZoRkXBO5fueJxPSR03W1btCYgJcEDJfM8TG7yS__lvE1cXcUG-PJb36Q6UNln1brqxfyPhP51PiviTTt6tZBFxMgB-PGcvRf-I7vdCVzMf5W8FGjFa-JHscAqX3cv6AVlshuOmgbZL49tZzeb0ad-I9yLoWmf4a0HxRe6Lmue5X4BaIWo6iHawvkjmd0CRC86JnxUVOWr4qymLAvE2FGDzVBcPzTzr_t9iy1LtPLJB1UsL7DxEr2A0hSbxQUtrwRTOdgTiEuVBPp9hag6d6ZDq09B5JVViERIFssIVEV6-nN14jm1MwWdEpUU"
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
