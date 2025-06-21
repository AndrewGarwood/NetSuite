/**
 * @file env.ts
 * @description Environment variables for the SuiteCloud project.
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

import { AccountEnvironmentEnum, SuiteScriptEnvironment, ScriptDictionary, ScriptDetails } from '../utils/ns/SuiteScriptEnvironment';

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';



export const BASE_ACCOUNT_ID = (process.env.ACCOUNT_ID || 'MISSING_ENV_VARIABLE-ACCOUNT_ID') as string;

/** set by `NODE_ENV` in .env file */
export const inSandbox = (process.env.NODE_ENV === AccountEnvironmentEnum.SANDBOX) as boolean;
/** set by `NODE_ENV` in .env file */
export const inProduction = (process.env.NODE_ENV === AccountEnvironmentEnum.PRODUCTION) as boolean;

/** Dependent on NODE_ENV value set in .env file */
export const ACCOUNT_ID = inProduction 
    ? BASE_ACCOUNT_ID as string 
    : (`${BASE_ACCOUNT_ID}-sb1` || 'MISSING_ENV_VARIABLE-ACCOUNT_ID') as string;

export const REST_CLIENT_ID = (inProduction 
    ? (process.env.PROD_REST_CLIENT_ID || 'MISSING_ENV_VARIABLE-REST_CLIENT_ID') as string
    : (process.env.SB_REST_CLIENT_ID || 'MISSING_ENV_VARIABLE-REST_CLIENT_ID') as string
);
export const REST_CLIENT_SECRET = (inProduction
    ? (process.env.PROD_REST_CLIENT_SECRET || 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET') as string
    : (process.env.SB_REST_CLIENT_SECRET || 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET') as string
);

/** `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/` 
 * @see {@link ACCOUNT_ID}*/
export const SUITETALK_URL=`https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/` as string;

/** https://${ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl 
 * @see {@link ACCOUNT_ID}*/
export const AUTH_URL = `https://${ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl` as string;

/** https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token 
 * @see {@link ACCOUNT_ID}*/
export const TOKEN_URL = `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token` as string;

/**
 * `https://${ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl` 
 * @see {@link ACCOUNT_ID} 
 * @example specificRestletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`
*/
export const RESTLET_URL_STEM = `https://${ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl` as string;

export const SERVER_PORT = (process.env.SERVER_PORT || '3000') as string;
/**
 * @description `http://localhost:${SERVER_PORT}/callback` 
 * @example `http://localhost:3000/callback` 
 * */
export const REDIRECT_URI = (process.env.REST_REDIRECT_URI || `http://localhost:${SERVER_PORT}/callback`) as string;

export const REST_APPLICATION_ID = (process.env.REST_APPLICATION_ID || 'MISSING_ENV_VARIABLE-REST_APPLICATION_ID') as string;

export const NLAUTH_EMAIL = (process.env.NLAUTH_EMAIL || 'MISSING_ENV_VARIABLE-NLAUTH_EMAIL') as string;
export const NLAUTH_SIGNATURE = (process.env.NLAUTH_SIGNATURE || 'MISSING_ENV_VARIABLE-NLAUTH_SIGNATURE') as string;
export const NLAUTH_ADMIN = '3';
export const NLAUTH_DEV = '55';

export const AUTHORIZATION_HEADER: string = [
    `NLAuth nlauth_account=${BASE_ACCOUNT_ID}`,
    `nlauth_email=${NLAUTH_EMAIL}`,
    `nlauth_signature=${NLAUTH_SIGNATURE}`,
    `nlauth_role=${NLAUTH_ADMIN}`,
    `nlauth_application_id=${REST_APPLICATION_ID}`
].join(', ');

/** restlets //,rest_webservices,webservices,suiteanalytics,full,offline */
export const SCOPE = 'restlets'; //,rest_webservices,webservices,suiteanalytics,full,offline';

/**
 * @reference https://system.netsuite.com/app/help/helpcenter.nl?fid=section_158081944642.html 
 * @description (from reference)
 * - The length of the state parameter must be between 22 and 1024 characters. 
 * - Valid characters are all printable ASCII characters.
 * - The value of the state parameter must be unique for each authorization flow.
 */
export const STATE = require('crypto').randomBytes(32).toString('hex'); // 64 characters long

/** 
 * see {@link SuiteScriptEnvironment}
 * @description instantiate known script deployments from your NetSuite production and sandbox accounts.
 * */
export const SCRIPT_ENVIRONMENT: SuiteScriptEnvironment = {
    production: {},
    sandbox: {
        restlet: {
            POST_StoreFieldIdsOfRecordType: {
                scriptId: 167,
                deployId: 1,
            },
            POST_BatchUpsertRecord: {
                scriptId: 172,
                deployId: 1,
            },
            DELETE_DeleteRecordByType: {
                scriptId: 173,
                deployId: 1,
            },
            POST_UpsertRecord: {
                scriptId: 174,
                deployId: 1,
            },
            GET_Record: {
                scriptId: 175,
                deployId: 1,
            },
        } as ScriptDictionary,
    }
}


/** `./SuiteCloud/` = the directory where the node_modules folder lives*/
export const NODE_HOME_DIR = process.cwd();
/** = {@link NODE_HOME_DIR}`/src` = `SuiteCloud/src` = `process.cwd()/src`*/
export const SRC_DIR = path.join(NODE_HOME_DIR, 'src') as string;
/** = {@link SRC_DIR}`/server/tokens` */
export const TOKEN_DIR = path.join(SRC_DIR, 'server', 'tokens') as string;
export const USER = process.cwd().split(path.sep)[2];
console.log(`USER = '${USER}'`);
const ORGANIZATION = process.env.ORGANIZATION || 'MISSING_ENV_VAR-ORGANIZATION';
/** `C:/Users/${USER}/OneDrive - ${ORGANIZATION}` */
export const ONE_DRIVE_DIR = `C:/Users/${USER}/OneDrive - ${ORGANIZATION}` as string;
/** `${`{@link ONE_DRIVE_DIR}`}/NetSuite/logs` (not part of git repo so no worry about file size) */
export const CLOUD_LOG_DIR = path.join(ONE_DRIVE_DIR, 'NetSuite', 'logs') as string;
/** = {@link NODE_HOME_DIR}`/../data` = `root/data` */
export const DATA_DIR = path.join(NODE_HOME_DIR, '../data') as string;
/** = {@link NODE_HOME_DIR}`/.output` = `/SuiteCloud/.output` */
export const OUTPUT_DIR = path.join(NODE_HOME_DIR, '.output') as string;
/**`/NetSuiteDev/SuiteCloud/.output/error_json` */
export const ERROR_DIR = path.join(OUTPUT_DIR, 'error_json') as string;

/** 
 * @example 
 * import READLINE as rl;
 * const answer = await rl.question('What do you think of Node.js?')
 * */
export const READLINE = readline.createInterface({ input, output });

/**
 * @description Exit the program/script for debugging purposes
 * @param {number} exitCode - The exit code to use when exiting the program. Default is `0`. Use `1` for error.
 * @param {...any} [msg] - `(optional)` The message to log before exiting.
 * @returns {void}
 * */
export const STOP_RUNNING = (exitCode: number=0, ...msg: any[]): void => {
    console.log(` > STOP_RUNNING() called with exitCode ${exitCode}.`, ...(msg || []));
    process.exit(exitCode);
}
/**
 * @description async func to pause execution for specified amount of milliseconds
 * - default message =  `'> Pausing for ${ms} milliseconds.'`
 * - `if` pass in null as second argument, no message will be logged 
 * @param {number} ms - The number of milliseconds to pause execution for.
 * @param {...any} [msg] - `(optional)` The message to log before pausing.
 * @returns {Promise<void>}
 * @example DELAY(1000) // pauses for 1 second
 * */
export const DELAY = async (ms: number, ...msg: any[]): Promise<void> => {
    let pauseMsg = ` > Pausing for ${ms} milliseconds.`;
    let msgArr = Array.isArray(msg) && msg.length > 0 ? msg : [pauseMsg];
    if (msgArr[0] !== null) {console.log(...msgArr);}
    return new Promise(resolve => setTimeout(resolve, ms));
}
const TAB = '\n\t';
console.log(` > Loading env...`,
    TAB + `        USER: ${USER}`,
    TAB + `   inSandbox: ${inSandbox}`,
    TAB + `inProduction: ${inProduction}`
);

validatePath(
    NODE_HOME_DIR, SRC_DIR, TOKEN_DIR, ONE_DRIVE_DIR, CLOUD_LOG_DIR, 
    DATA_DIR, OUTPUT_DIR, ERROR_DIR
);
export async function validatePath(...paths: string[]): Promise<void> {
    for (const path of paths) {
        if (!fs.existsSync(path)) {
            console.error(`ERROR validatePath(): path does not exist: ${path}`);
            STOP_RUNNING(1);
        }
    }
}
