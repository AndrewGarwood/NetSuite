/**
 * @file SuiteScriptEnvironment.ts
 * @module SuiteScriptEnvironment
 * @description strucutres to define/hold the scripts one has uploaded/deployed to NetSuite.
 */


/**
 * @enum {string} AccountEnvironmentEnum
 * @description Enum for NetSuite account environments.
 * @property {string} PRODUCTION - Production environment.
 * @property {string} SANDBOX - Sandbox (development) environment.
 */
export enum AccountEnvironmentEnum {
    PRODUCTION = 'production',
    SANDBOX = 'sandbox',
}

/**
 * @typedefn SuiteScriptEnvironment
 * @description NetSuite Account Environment and Script Type mapping.
 * @property {AccountEnvironmentEnum} production - Production environment.
 * @property {AccountEnvironmentEnum} sandbox - Sandbox environment.
 * @property {Record<ScriptTypeEnum, ScriptDictionary>} production.value
 * @property {Record<ScriptTypeEnum, ScriptDictionary>} sandbox.value
 */
export type SuiteScriptEnvironment = {
    [K in AccountEnvironmentEnum]?: {
        [S in ScriptTypeEnum]?: ScriptDictionary
    }
};
// export type SuiteScriptEnvironment = Partial<{
//     [K in AccountEnvironmentEnum]: Partial<{
//         [S in ScriptTypeEnum]: ScriptDictionary
//     }>
// }>;

/**
 * @typedefn ScriptDeploymentDict
 * @description dictionary mapping a script's label to its details
 * @property {string} key - The shorthand name used when coding the script.
 * @property {ScriptDetails} value - The script details for the script.
 */
export type ScriptDictionary = { 
    [key: string]: ScriptDetails 
};

/**
 * @typedefn ScriptDetails
 * @description Script details for NetSuite SuiteScript. assume that the script has been uploaded, a script record made, and a script deployment record made.
 * @property {string | number} scriptId - The ID of the script.
 * @property {string} [scriptName] - The script record's name field on NetSuite.
 * @property {string | number} deployId - The ID of the script deployment.
 * @property {string} [deployName] - The script deployment record's name field on NetSuite.
 */
export type ScriptDetails = {
    scriptId: string | number;
    scriptName?: string;
    deployId: string | number
    deployName?: string;
};

/**
 * @enum {string} ScriptTypeEnum
 * @description Enum for NetSuite script types.
 * @reference https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_4387172495.html
 * 
 * @property {string} BUNDLE_INSTALLATION_SCRIPT - Bundle installation script.
 * @property {string} CLIENT_SCRIPT - Client script.
 * @property {string} MAP_REDUCE_SCRIPT - Map/Reduce script.
 * @property {string} MASS_UPDATE_SCRIPT - Mass update script.
 * @property {string} PORTLET - Portlet script.
 * @property {string} RESTLET - RESTlet script.
 * @property {string} SCHEDULED_SCRIPT - Scheduled script.
 * @property {string} SDF_INSTALLATION_SCRIPT - SuiteCloud Development Framework (SDF) installation script.
 * @property {string} SUITELET - Suitelet script.
 * @property {string} USER_EVENT_SCRIPT - User event script.
 * @property {string} WORKFLOW_ACTION_SCRIPT - Workflow action script.
 */
export enum ScriptTypeEnum {
    BUNDLE_INSTALLATION_SCRIPT = 'bundleinstallationscript',
    CLIENT_SCRIPT = 'clientscript',
    MAP_REDUCE_SCRIPT = 'mapreducescript',
    MASS_UPDATE_SCRIPT = 'massupdatescript',
    PORTLET = 'portlet',
    RESTLET = 'restlet',
    SCHEDULED_SCRIPT = 'scheduledscript',
    SDF_INSTALLATION_SCRIPT = 'sdfinstallationscript',
    SUITELET = 'suitelet',
    USER_EVENT_SCRIPT = 'usereventscript',
    WORKFLOW_ACTION_SCRIPT = 'workflowactionscript',
}
