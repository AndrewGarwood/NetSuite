/**
 * @file src/config/env.ts
 * @description Environment variables for the SuiteCloud project.
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as readline from 'node:readline/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { 
    AccountEnvironmentEnum, SuiteScriptEnvironment, ScriptDictionary
} from 'src/utils/ns/SuiteScriptEnvironment';
dotenv.config();

export const BASE_ACCOUNT_ID = (process.env.ACCOUNT_ID 
    || 'MISSING_ENV_VARIABLE-ACCOUNT_ID'
);

/** set by `NODE_ENV` in `.env` file */
export const inSandbox = (process.env.NODE_ENV === AccountEnvironmentEnum.SANDBOX) as boolean;

/** set by `NODE_ENV` in `.env` file */
export const inProduction = (process.env.NODE_ENV === AccountEnvironmentEnum.PRODUCTION) as boolean;

/** Dependent on `NODE_ENV` value set in `.env` file */
export const ACCOUNT_ID = inProduction 
    ? BASE_ACCOUNT_ID as string 
    : (`${BASE_ACCOUNT_ID}-sb1` || 'MISSING_ENV_VARIABLE-ACCOUNT_ID') as string;

/*
===============================================================================
API Config
===============================================================================
*/
export const REST_CLIENT_ID = (inProduction 
    ? (process.env.PROD_REST_CLIENT_ID || 'MISSING_ENV_VARIABLE-REST_CLIENT_ID') as string
    : (process.env.SB_REST_CLIENT_ID || 'MISSING_ENV_VARIABLE-REST_CLIENT_ID') as string
);

export const REST_CLIENT_SECRET = (inProduction
    ? (process.env.PROD_REST_CLIENT_SECRET || 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET') as string
    : (process.env.SB_REST_CLIENT_SECRET || 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET') as string
);

export const SERVER_PORT = (process.env.SERVER_PORT 
    || '3000'
);

/**
 * @description `http://localhost:${SERVER_PORT}/callback` 
 * @example `http://localhost:3000/callback` 
 * */
export const REDIRECT_URI = (
    process.env.REST_REDIRECT_URI || `http://localhost:${SERVER_PORT}/callback`
);

/** restlets //,rest_webservices,webservices,suiteanalytics,full,offline */ // could do [].join(',')
export const SCOPE = 'restlets';

/**
 * @reference https://system.netsuite.com/app/help/helpcenter.nl?fid=section_158081944642.html 
 * @description (from reference)
 * - The length of the state parameter must be between 22 and 1024 characters. 
 * - Valid characters are all printable ASCII characters.
 * - The value of the state parameter must be unique for each authorization flow.
 */
export const STATE = require('crypto').randomBytes(32).toString('hex'); // 64 characters long

/** 
 * `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/` 
 * @see {@link ACCOUNT_ID}
 * */
export const SUITETALK_URL=`https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/` as string;

/** 
 * `https://${ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl` 
 * @see {@link ACCOUNT_ID}
 * */
export const AUTH_URL = `https://${ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl` as string;

/** 
 * `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token` 
 * @see {@link ACCOUNT_ID}
 * */
export const TOKEN_URL = `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token` as string;

/**
 * `https://${ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl` 
 * @see {@link ACCOUNT_ID} 
 * @example specificRestletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`
 * */
export const RESTLET_URL_STEM = `https://${ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl` as string;

export const REST_APPLICATION_ID = (process.env.REST_APPLICATION_ID 
    || 'MISSING_ENV_VARIABLE-REST_APPLICATION_ID'
);

export const NLAUTH_EMAIL = (process.env.NLAUTH_EMAIL 
    || 'MISSING_ENV_VARIABLE-NLAUTH_EMAIL'
);

export const NLAUTH_SIGNATURE = (process.env.NLAUTH_SIGNATURE 
    || 'MISSING_ENV_VARIABLE-NLAUTH_SIGNATURE'
);

export const NLAUTH_ADMIN = '3';

export const NLAUTH_DEV = '55';

export const AUTHORIZATION_HEADER: string = [
    `NLAuth nlauth_account=${BASE_ACCOUNT_ID}`,
    `nlauth_email=${NLAUTH_EMAIL}`,
    `nlauth_signature=${NLAUTH_SIGNATURE}`,
    `nlauth_role=${NLAUTH_ADMIN}`,
    `nlauth_application_id=${REST_APPLICATION_ID}`
].join(', ');

/** 
 * see {@link SuiteScriptEnvironment}
 * @description instantiate known script deployments from your NetSuite 
 * production and sandbox accounts.
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
            GET_Record: {
                scriptId: 175,
                deployId: 1,
            },
            PUT_UpsertRecord: {
                scriptId: 176,
                deployId: 1,
            },
        } as ScriptDictionary,
    }
}
/*
===============================================================================
Dev Environment Config
===============================================================================
*/
/** 
 * assume `user` is at `process.cwd().split(path.sep)[2]` 
 * i.e. `'C:/users/${USER}'` 
 * */
export const USER = process.cwd().split(path.sep)[2];

export const ORGANIZATION = (process.env.ORGANIZATION 
    || 'MISSING_ENV_VAR-ORGANIZATION'
);

/** 
 * = the directory where the `node_modules` folder lives
 * - `'./SuiteCloud/{home is here}'` 
 * - it's a child of `SuiteCloud`
 * */
export const NODE_HOME_DIR = process.cwd() as string;

/** 
 * = `'`{@link NODE_HOME_DIR}`/src'` 
 * = `'process.cwd()/src'`
 * */
export const SRC_DIR = path.join(NODE_HOME_DIR, 'src') as string;

/** = `'`{@link SRC_DIR}`/server/tokens'` */
export const TOKEN_DIR = path.join(SRC_DIR, 'server', 'tokens') as string;

/** `'C:/Users/${USER}/OneDrive - ${ORGANIZATION}'` */ 
export const ONE_DRIVE_DIR = path.join('C:', 'Users', USER, `OneDrive - ${ORGANIZATION}`);

/** `'`{@link ONE_DRIVE_DIR}`/NetSuite/logs'` */
export const CLOUD_LOG_DIR = path.join(ONE_DRIVE_DIR, 'NetSuite', 'logs') as string;

/** `'/NetSuite/data'`  */
export const DATA_DIR = path.join(NODE_HOME_DIR, '..', 'data') as string;

/** `''/NetSuite/SuiteCloud/.output''` */
export const OUTPUT_DIR = path.join(NODE_HOME_DIR,'.output') as string;

/**`'CLOUD_LOG_DIR/errors'` */
export const ERROR_DIR = path.join(CLOUD_LOG_DIR, 'errors') as string;

validatePath(
    NODE_HOME_DIR, SRC_DIR, TOKEN_DIR, ONE_DRIVE_DIR, CLOUD_LOG_DIR, 
    DATA_DIR, OUTPUT_DIR, ERROR_DIR
);

/*
===============================================================================
Helper Functions
===============================================================================
*/

function validatePath(...paths: string[]): void {
    for (const path of paths) {
        if (!fs.existsSync(path)) {
            throw new Error(
                `[ERROR validatePath()]: path does not exist: ${path}`
            );
        }
    }
}
/** 
 * @example 
 * import READLINE as rl;
 * const answer = await rl.question('What do you think of Node.js?')
 * */
export const READLINE = readline.createInterface({ input, output });

/**
 * @description Exit the program/script for debugging purposes
 * @param exitCode `number` - The exit code to use when exiting the program. Default is `0`. Use `1` for error.
 * @param msg `any[]` `(optional)` - The message to log before exiting.
 * @returns {void}
 * */
export const STOP_RUNNING = (exitCode: number=0, ...msg: any[]): void => {
    console.log(` > STOP_RUNNING() called with exitCode ${exitCode} at (${new Date().toLocaleString()}).`, ...(msg || []));
    process.exit(exitCode);
}
/**
 * @description async func to pause execution for specified amount of milliseconds
 * - default message =  `'> Pausing for ${ms} milliseconds.'`
 * - `if` pass in `null` as second argument, no message will be logged 
 * @param ms `number` - milliseconds to pause execution for.
 * @param  msg `any[]` `(optional)` The message to log before pausing.
 * @returns {Promise<void>}
 * @example DELAY(1000) // pauses for 1 second
 * */
export const DELAY = async (ms: number, ...msg: any[]): Promise<void> => {
    let pauseMsg = ` > Pausing for ${ms} milliseconds.`;
    let msgArr = Array.isArray(msg) && msg.length > 0 ? msg : [pauseMsg];
    if (msgArr[0] !== null) {console.log(...msgArr);}
    return new Promise(resolve => setTimeout(resolve, ms));
}

const TAB = '\n\t• ';
console.log(`[env.ts] Loading env at (${new Date().toLocaleString()})`,
    TAB + `PC User: '${USER}'`,
    TAB + `Account: ${inSandbox ? 'sandbox' : 'production'}`,
);

