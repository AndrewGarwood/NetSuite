/**
 * @file src/config/env.ts
 */
import * as fs from "fs";
import * as dotenv from "dotenv";
import path from "node:path";
import { 
    typeshiLogger as mlog, typeshiSimpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL 
} from "typeshi/dist/config/setupLog";
import { 
    getSourceString, indentedStringify, isDirectory, readJsonFileAsObject as read 
} from "@typeshi/io";
import { extractFileName } from "@typeshi/regex";
import * as validate from "@typeshi/argumentValidation";
import { 
    AccountEnvironmentEnum, SuiteScriptEnvironment, ScriptDictionary,
    ScriptTypeEnum,
    ScriptDetails
} from "../utils/ns/SuiteScript";
import { NetSuiteAccountDictionary, AccountDetails, 
    ProjectConfiguration, ResourceFolderConfiguration, DataLoaderConfiguration, 
    isProjectConfiguration,
    CloudConfiguration,
    isLocalConfiguration,
    isCloudConfiguration,
    isDataLoaderConfiguration,
    isScriptDetails,
    isAccountEnvironmentEnum,
    isSuiteScriptEnvironment
} from "@config/types";
import { isNonEmptyString, isObject } from "@typeshi/typeValidation";
import { formatLogObj, mainLogger, miscLogger, errorLogger } from "@config/setupLog";
import { ILogObj, ILogObjMeta, Logger } from "tslog";
dotenv.config();

let environmentInitialized = false;

export function isEnvironmentInitialized(): boolean {
    return environmentInitialized;
}

/** 
 * = the directory where `package.json` and the `node_modules` folder live
 * - `'./SuiteCloud/{home is here}'`
 * */
const NODE_HOME_DIR = process.cwd() as string;

/** assume directory this file is located in is always NODE_HOME_DIR */
const PROJECT_CONFIG_FILE_NAME = `project.config.json`;
/** = `'{NODE_HOME_DIR}/project.config.json'` */
const DEFAULT_PROJECT_CONFIG_PATH = path.join(NODE_HOME_DIR, PROJECT_CONFIG_FILE_NAME);


let LOG_FILES: string[] = []

/* -------------- Environment Variables With Default Values ---------------- */
let nodeEnv = AccountEnvironmentEnum.SANDBOX;
/** 
 * `default:` `null`
 * - assumes this file is located in `NODE_HOME_DIR`
 * - e.g. `'NODE_HOME_DIR/project.data.config.json'`
 * */
let dataSourceConfigPath: string | null = null;
let projectConfig: ProjectConfiguration | null = null;
let resourceFolderConfiguration: ResourceFolderConfiguration | null = null;
let dataLoaderConfig: DataLoaderConfiguration | null = null;
let accountDetails: AccountDetails | null = null;
let scriptEnvrionment: SuiteScriptEnvironment | null = null;

const nsAccountDictionary: NetSuiteAccountDictionary = {
    [AccountEnvironmentEnum.PRODUCTION]: {
        id: process.env.ACCOUNT_ID ?? '',
        name: 'NetSuite Production',
        type: 'production'
    },
    [AccountEnvironmentEnum.SANDBOX]: {
        id: process.env.ACCOUNT_ID ? `${process.env.ACCOUNT_ID}-sb1` : '',
        name: 'NetSuite Sandbox',
        type: 'sandbox'
    }
}

export async function initializeEnvironment(
    configPath: string = DEFAULT_PROJECT_CONFIG_PATH,
    makeDirs: boolean=false
): Promise<void> {
    const source = getSourceString(__filename, initializeEnvironment.name);
    mlog.info(`${source} (START)`);
    try {
        validate.booleanArgument(source, {makeDirs});
        validate.existingFileArgument(source, '.json', {configPath});
        let config = read(configPath) as ProjectConfiguration;
        /**
         * isProjectConfiguration handles validation of config.dataLoader, 
         * config.scripts, config.cloud, config.local
         */
        validate.objectArgument(source, {config, isProjectConfiguration});
        slog.info([` -- Valid ProjectConfiguration file received, unpacking content...`,
            `project name: '${config.name}'`,
            ` environment: '${config.nodeEnv}'`,
        ].join(TAB));
        scriptEnvrionment = config.scripts;
        resourceFolderConfiguration = await loadResourceFolderConfiguration(config, makeDirs);
        await setLogTransports(resourceFolderConfiguration.logDir, {
            'main.txt': mainLogger,
            'misc.txt': miscLogger,
            'error.txt': errorLogger
        });
        dataLoaderConfig = config.dataLoader;
        dataSourceConfigPath = (path.isAbsolute(dataLoaderConfig.dataSourceConfigFile) 
            ? dataLoaderConfig.dataSourceConfigFile 
            : path.join(NODE_HOME_DIR, dataLoaderConfig.dataSourceConfigFile)
        );
        accountDetails = await loadAccountDetails(config);
        projectConfig = config;
        environmentInitialized = true;  
        slog.info(`${source} ✓ Environment initialized successfully!`)
    } catch (error: any) {
        mlog.error([`${source} ✗ Environment Initialization failed`, 
            `caught: ${error}`
        ].join(TAB));
        STOP_RUNNING(1);
    }
}

/**
 * - `for` `fileName` in `transportDict.keys`, 
 * `transportDict[fileName].attachTransport(...)` that appends `path.join(logDir, fileName)`
 * @param logDir `string`
 * @param transportDict `{ [fileName: string]: Logger<ILogObj> }`
 */
async function setLogTransports(
    logDir: string,
    transportDict: { [fileName: string]: Logger<ILogObj> }
): Promise<void> {
    const source = getSourceString(__filename, setLogTransports.name);
    validate.existingDirectoryArgument(source, {logDir});
    for (let fileName in transportDict) {
        const logger = transportDict[fileName];
        const logFilePath = path.join(logDir, fileName);
        LOG_FILES.push(logFilePath);
        logger.attachTransport((logObj: ILogObj & ILogObjMeta) => {
            fs.appendFileSync(logFilePath, 
                JSON.stringify(formatLogObj(logObj)) + "\n", 
                { encoding: "utf-8" } as fs.WriteFileOptions
            );
        });
    }
    slog.info(`${source} Finished attaching transports: ${Object.keys(transportDict).join(', ')}`)
}



async function loadAccountDetails(
    config: ProjectConfiguration
): Promise<AccountDetails> {
    const source = getSourceString(__filename, loadAccountDetails.name);
    /**validated previously via isProjectConfiguration in initializeEnvironment() */
    nodeEnv = config.nodeEnv as AccountEnvironmentEnum;
    let details: AccountDetails = nsAccountDictionary.sandbox; 
    switch (nodeEnv) {
        case AccountEnvironmentEnum.PRODUCTION:
            Object.assign(details, nsAccountDictionary.production);
            break;
        case AccountEnvironmentEnum.SANDBOX:
            Object.assign(details, nsAccountDictionary.sandbox);
            break;
        default:
            throw new Error(`${source} Invalid Environment Variable: 'NODE_ENV' or (config.nodeEnv) - Expected AccountEnvironmentEnum`);
    }
    for (const value of [details.id]) {
        if (!isNonEmptyString(value) || value.startsWith('MISSING')) {
            throw new Error([`${source} Missing AccountDetails variable(s)`,
                `Expected definition in .env file for AccountDetails variable(s)`,
                `current accountDetails: ${indentedStringify(details)}`
            ].join(TAB));
        }
    }
    return details;
}
/**
 * use config to define folders for retrieving data, writing output, and logging
 */
async function loadResourceFolderConfiguration(
    config: ProjectConfiguration, 
    makeDirs: boolean = false
): Promise<ResourceFolderConfiguration> {
    const source = getSourceString(__filename, loadResourceFolderConfiguration.name);
    slog.info(`${source} Loading project folders...`);
    let root: string | null = null;
    let folders: ResourceFolderConfiguration | null = null;
    if (isCloudConfiguration(config.cloud)) {
        slog.info(` -- CloudConfiguration detected, setting env variables...`);
        folders = config.cloud;
        root = await getCloudDirectory(config.cloud);
    } else if (isLocalConfiguration(config.local)) {
        slog.info(` -- LocalConfiguration detected, setting env variables...`);
        folders = config.local;
        root = NODE_HOME_DIR;
    } else {
        throw new Error([`${source} Unable to load resource folders from ProjectConfiguration;`
            +`Did not receive valid CloudConfiguration or LocalConfiguration`,
        ].join(NL));
    }
    let logDir = isDirectory(folders.logDir) && path.isAbsolute(folders.logDir) 
        ? folders.logDir : path.join(root, folders.logDir);
    let tokDir = isDirectory(folders.tokDir) && path.isAbsolute(folders.tokDir) 
        ? folders.tokDir : path.join(root, folders.tokDir);
    let dataDir = isDirectory(folders.dataDir) && path.isAbsolute(folders.dataDir) 
        ? folders.dataDir : path.join(root, folders.dataDir);
    try {
        await validateResourceFolders(source, {logDir, tokDir, dataDir}, makeDirs);
        slog.info(`${source} Finished loading [logDir, tokDir, dataDir]`)
        return { logDir, tokDir, dataDir } as ResourceFolderConfiguration;
    } catch (error: any) {
        throw new Error(`${source} Unable to load resource folders from configuration, ${error}`)
    }
    
}

async function getCloudDirectory(cloud: CloudConfiguration): Promise<string> {
    const source = getSourceString(__filename, getCloudDirectory.name);
    let configuredCloudDir = '';
    if (isDirectory(cloud.absoluteDirPath) && path.isAbsolute(cloud.absoluteDirPath)) { 
        configuredCloudDir = cloud.absoluteDirPath;
    } else if (isNonEmptyString(cloud.rootName) && isNonEmptyString(cloud.folderName)) { 
        let cloudRootSuffix = (isNonEmptyString(cloud.orgSeparator) 
            && isNonEmptyString(ORGANIZATION) 
            ? `${cloud.orgSeparator}${ORGANIZATION}` 
            : ''
        );
        configuredCloudDir = path.join(
            'C:/Users', USER, cloud.rootName + cloudRootSuffix, cloud.folderName 
        );
    } else {
        throw new Error(
            `${source} Unable to construct cloud directory path from CloudConfiguration`
        );
    }
    validate.existingDirectoryArgument(source, {configuredCloudDir});
    return configuredCloudDir;
}

/**
 * - validate dir existence; throw error if dir not exists and !makeDirs
 * @param dir `string`
 * @param dirLabel `{ [dirLabel: string]: string }`
 * @param makeDirs `boolean (optional)` `default = false`
 * @returns `Promise<void>`
 */
async function validateResourceFolders(
    source: string,
    dirDictionary: { [dirLabel: string]: string },
    makeDirs: boolean = false
): Promise<void> {
    const vSource = getSourceString(__filename, validateResourceFolders.name);
    for (let [dirLabel, dir] of Object.entries(dirDictionary)) {
        if (isDirectory(dir)) continue;
        if (!makeDirs) {
            throw new Error([`${source} -> ${vSource} directory does not exist`,
                `label: '${dirLabel}'`,
                `value: '${dir}'`
            ].join(TAB));
        }
        fs.mkdirSync(dir, { recursive: true });
        slog.info(`   Created '${dirLabel}' at '${dir}'`);
    }
}

/**
 * `sync`
 * @returns 
 */
export function getProjectConfiguration(): ProjectConfiguration {
    const source = getSourceString(__filename, getProjectConfiguration.name);
    if (!projectConfig) {
        throw new Error([`${source} projectConfig is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    return projectConfig;
}

/**
 * `sync`
 * @returns 
 */
export function getProjectFolders(): ResourceFolderConfiguration {
    const source = getSourceString(__filename, getProjectFolders.name);
    if (!resourceFolderConfiguration) {
        throw new Error([`${source} resourceFolderConfiguration is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    return resourceFolderConfiguration;
}
/**
 * `sync`
 * @returns 
 */
export function getDataLoaderConfiguration(): DataLoaderConfiguration {
    const source = getSourceString(__filename, getDataLoaderConfiguration.name);
    if (!dataLoaderConfig) {
        throw new Error([`${source} dataLoaderConfig is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    return dataLoaderConfig;
}


export function getDataSourceConfigPath(): string {
    const source = getSourceString(__filename, getDataSourceConfigPath.name);
    if (!dataSourceConfigPath) {
        throw new Error([`${source} dataSourceConfigPath is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    return dataSourceConfigPath;

}

export function getAccountDetails(): AccountDetails {
    const source = getSourceString(__filename, getAccountDetails.name);
    if (!accountDetails) {
        throw new Error([`${source} accountDetails is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    return accountDetails;
}

export function getScriptEnvironment(): SuiteScriptEnvironment {
    const source = getSourceString(__filename, getScriptEnvironment.name);
    if (!scriptEnvrionment) {
        throw new Error([`${source} scriptEnvrionment is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    return scriptEnvrionment;
}

export function getScripts(
    accountEnv: AccountEnvironmentEnum, 
    scriptType: ScriptTypeEnum
): { [scriptLabel: string]: ScriptDetails } {
    const source = getSourceString(__filename, getScripts.name);
    validate.enumArgument(source, {accountEnv, AccountEnvironmentEnum});
    validate.enumArgument(source, {scriptType, ScriptTypeEnum});
    if (!scriptEnvrionment) {
        throw new Error([`${source} scriptEnvrionment is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    if (!scriptEnvrionment[accountEnv]) {
        throw new Error([`${source} scriptEnvrionment['${accountEnv}'] is undefined`,
            `-> need to define scripts in config file.`
        ].join(NL));
    }
    if (!scriptEnvrionment[accountEnv][scriptType]) {
        throw new Error([`${source} scriptEnvrionment['${accountEnv}']['${scriptType}'] is undefined`,
            `-> need to define scripts in config file.`
        ].join(NL));
    }
    return scriptEnvrionment[accountEnv][scriptType];
}

export function getSandboxRestScript(scriptLabel: string): ScriptDetails {
    const source = getSourceString(__filename, getSandboxRestScript.name);
    if (!scriptEnvrionment) {
        throw new Error([`${source} scriptEnvrionment is undefined`,
            ` -> call initializeEnvironment() first.`
        ].join(NL));
    }
    let accountEnv = AccountEnvironmentEnum.SANDBOX;
    let scriptType = ScriptTypeEnum.RESTLET;
    if (!scriptEnvrionment[accountEnv]) {
        throw new Error([`${source} scriptEnvrionment['${accountEnv}'] is undefined`,
            `-> need to define scripts in config file.`
        ].join(NL));
    }
    if (!scriptEnvrionment[accountEnv][scriptType]) {
        throw new Error([`${source} scriptEnvrionment['${accountEnv}']['${scriptType}'] is undefined`,
            `-> need to define scripts in config file.`
        ].join(NL));
    }
    if (!scriptEnvrionment[accountEnv][scriptType][scriptLabel]) {
        throw new Error([`${source} scriptEnvrionment['${accountEnv}']['${scriptType}']['${scriptLabel}'] is undefined`,
            `-> need to define ScriptDetails in config file.`
        ].join(NL));
    }
    if (!isScriptDetails(scriptEnvrionment[accountEnv][scriptType][scriptLabel])) {
        throw new Error(`${source} Invalid ScriptDetails object -> check config file`)
    }
    return scriptEnvrionment[accountEnv][scriptType][scriptLabel];
}

export function getLogFiles(): string[] {
    return LOG_FILES;
}

/** 
 * assume `user` is at `process.cwd().split(path.sep)[2]` 
 * i.e. `'C:/users/${USER}'` 
 * */
export const USER = process.cwd().split(path.sep)[2];

export const ORGANIZATION = (process.env.ORGANIZATION || '');
export const BASE_ACCOUNT_ID = (process.env.ACCOUNT_ID || 'MISSING_ENV_VARIABLE-ACCOUNT_ID');

/** set by `NODE_ENV` in `.env` file */
export const inSandbox = (process.env.NODE_ENV === AccountEnvironmentEnum.SANDBOX) as boolean;

/** set by `NODE_ENV` in `.env` file */
export const inProduction = (process.env.NODE_ENV === AccountEnvironmentEnum.PRODUCTION) as boolean;

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

export const SERVER_PORT = (process.env.SERVER_PORT || '3000');

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

/** Dependent on `NODE_ENV` value set in `.env` file */
const ACCOUNT_ID = inProduction && BASE_ACCOUNT_ID && !BASE_ACCOUNT_ID.startsWith('MISSING')
    ? BASE_ACCOUNT_ID as string 
    : `${BASE_ACCOUNT_ID}-sb1` as string;

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


/*
===============================================================================
Helper Functions
===============================================================================
*/

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