/**
 * @file env.ts
 * @description Environment variables for the SuiteCloud project.
 */
import { AccountEnvironmentEnum, SuiteScriptEnvironment } from '../types/NS/SuiteScriptEnvironment';
import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export const READLINE = readline.createInterface({ input, output });
// @example import READLINE as rl; const answer = await rl.question('What do you think of Node.js? ');


/**@description Exit the program/script for debugging purposes @returns {void}*/
export const STOP_RUNNING = (): void => {
    process.exit(1);
}

export const BASE_ACCOUNT_ID = (process.env.ACCOUNT_ID || 'MISSING_ENV_VARIABLE-ACCOUNT_ID') as string;

/** .env NODE_ENV */
export const inSandbox = (process.env.NODE_ENV === AccountEnvironmentEnum.SANDBOX) as boolean;
/** .env NODE_ENV */
export const inProduction = (process.env.NODE_ENV === AccountEnvironmentEnum.PRODUCTION) as boolean;

/** Dependent on NODE_ENV value set in .env file */
export const ACCOUNT_ID = inProduction 
    ? BASE_ACCOUNT_ID as string 
    : (`${BASE_ACCOUNT_ID}-sb1` || 'MISSING_ENV_VARIABLE-ACCOUNT_ID') as string;

export const REST_CLIENT_ID = inProduction 
    ? (process.env.PROD_REST_CLIENT_ID || 'MISSING_ENV_VARIABLE-REST_CLIENT_ID') as string
    : (process.env.SB_REST_CLIENT_ID || 'MISSING_ENV_VARIABLE-REST_CLIENT_ID') as string;
export const REST_CLIENT_SECRET = inProduction
    ? (process.env.PROD_REST_CLIENT_SECRET || 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET') as string
    : (process.env.SB_REST_CLIENT_SECRET || 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET') as string;

/** `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/` @see {@link ACCOUNT_ID}*/
export const SUITETALK_URL=`https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/` as string;

/** https://${ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl @see {@link ACCOUNT_ID}*/
export const AUTH_URL = `https://${ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl` as string;

/** https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token @see {@link ACCOUNT_ID}*/
export const TOKEN_URL = `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token` as string;

/**
 * `https://${ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl` @see {@link ACCOUNT_ID} 
 * @example specificRestletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`
*/
export const RESTLET_URL_STEM = `https://${ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl` as string;

export const SERVER_PORT = (process.env.SERVER_PORT || '3000') as string;
/**@description `http://localhost:${SERVER_PORT}/callback` @example `http://localhost:3000/callback` */
export const REDIRECT_URI = (process.env.REST_REDIRECT_URI || `http://localhost:${SERVER_PORT}/callback`) as string;

export const REST_APPLICATION_ID = (process.env.REST_APPLICATION_ID || 'MISSING_ENV_VARIABLE-REST_APPLICATION_ID') as string;

export const NLAUTH_EMAIL = (process.env.NLAUTH_EMAIL || 'MISSING_ENV_VARIABLE-NLAUTH_EMAIL') as string;
export const NLAUTH_SIGNATURE = (process.env.NLAUTH_SIGNATURE || 'MISSING_ENV_VARIABLE-NLAUTH_SIGNATURE') as string;
export const NLAUTH_ADMIN = '3';
export const NLAUTH_DEV = '55';

export const AUTHORIZATION_HEADER = `\
NLAuth nlauth_account=${BASE_ACCOUNT_ID}, \
nlauth_email=${NLAUTH_EMAIL}, \
nlauth_signature=${NLAUTH_SIGNATURE}, \
nlauth_role=${NLAUTH_ADMIN}, \
nlauth_application_id=${REST_APPLICATION_ID}\
` as string;

// export const SB_HITC_UPLOADER_TOKEN_ID = (process.env.HITC_UPLOADER_TOKEN_ID || 'MISSING_ENV_VARIABLE-HITC_UPLOADER_TOKEN_ID') as string;
// export const SB_HITC_UPLOADER_TOKEN_SECRET = (process.env.HITC_UPLOADER_TOKEN_SECRET || 'MISSING_ENV_VARIABLE-HITC_UPLOADER_TOKEN_SECRET') as string;

/** restlets */
export const SCOPE = 'restlets'; //,rest_webservices,webservices,suiteanalytics,full,offline';

// export const STATE = 'ykv2XLx1BpT5Q0F3MRPHb94j';
/**https://9866738-sb1.app.netsuite.com/app/help/helpcenter.nl?fid=section_158081944642.html 
 * The length of the state parameter must be between 22 and 1024 characters. Valid characters are all printable ASCII characters.

 * The value of the state parameter must be unique for each authorization flow.
*/
export const STATE = require('crypto').randomBytes(32).toString('hex'); // 64 characters long

/** @description instantiate known script deployments */
export const SCRIPT_ENVIORNMENT: SuiteScriptEnvironment = {
    production: {},
    sandbox: {
        restlet: {
            POST_StoreFieldIdsOfRecordType: {
                scriptId: 167,
                deployId: 1,
            },
            POST_CreateRecord: {
                scriptId: 168,
                deployId: 1,
            },
        }
    }
}

/**Define in .env use in path stem C:/Users/${USER} */
export const USER = process.env.CURRENT_USER || 'MISSING_ENV_VARIABLE-CURRENT_USER';

/** ~/OneDrive - ENTITY_NAME */
export const ONE_DRIVE_DIR = `C:/Users/${USER}/OneDrive - ENTITY_NAME`;

/** ~/NetSuite/data */
export const DATA_DIR = `C:/Users/${USER}/path/to/NetSuite/data`;

/** ~/NetSuiteDev/SuiteCloud/.output */
export const OUTPUT_DIR =`C:/Users/${USER}/path/to/NetSuite/SuiteCloud/.output`;