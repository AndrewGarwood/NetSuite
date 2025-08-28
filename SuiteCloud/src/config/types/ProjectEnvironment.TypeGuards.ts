/**
 * @file src/types/ProjectEnvironment.TypeGuards.ts
 */

import { 
    AccountEnvironmentEnum, 
    SuiteScriptEnvironment, 
    ScriptDictionary,
    ScriptDetails,
    ScriptTypeEnum 
} from "@utils/ns/SuiteScript";
import { 
    ProjectConfiguration, 
    CloudConfiguration, 
    LocalConfiguration, 
    DataLoaderConfiguration
} from "./ProjectEnvironment";
import { 
    isObject, isNonEmptyString, hasKeys, 
    isNonEmptyArray,
    isInteger
} from "@typeshi/typeValidation";
import { DataDomainEnum } from "@config/types/ProjectData";

/** `['dataDir', 'logDir', 'outDir']` 
 * = directory props shared by {@link LocalConfiguration} and {@link CloudConfiguration} 
 * */
const subdirectoryKeys = ['dataDir', 'logDir', 'outDir'];

export function isProjectConfiguration(value: any): value is ProjectConfiguration {
    return (isObject(value)
        && isNonEmptyString(value.name)
        && isNonEmptyString(value.srcDir)
        && isAccountEnvironmentEnum(value.nodeEnv)
        && isDataLoaderConfiguration(value.dataLoader)
        && isSuiteScriptEnvironment(value.scripts)
        && (!value.cloud || isCloudConfiguration(value.cloud))
        && (!value.local || isLocalConfiguration(value.local))
    );
}

/**
 * @param value `any`
 * @param domainEnum `Record<string, string | number>` `default = DataDomainEnum`
 * @returns **`isDataLoaderConfiguration`** `boolean`
 */
export function isDataLoaderConfiguration(
    value: any,
    domainEnum: Record<string, string | number> = DataDomainEnum
): value is DataLoaderConfiguration {
    return (isObject(value)
        && isNonEmptyString(value.dataSourceConfigFile)
        && typeof value.loadFromCloud === 'boolean'
        && isNonEmptyArray(value.domains)
        && value.domains.every(d=>Object.values(domainEnum).includes(d))
    );
}

export function isLocalConfiguration(value: any): value is LocalConfiguration {
    return (isObject(value)
        && subdirectoryKeys.every(k=>isNonEmptyString(k))
    );
}

export function isCloudConfiguration(value: any): value is CloudConfiguration {
    return (isObject(value)
        && subdirectoryKeys.every(k=>isNonEmptyString(k))
        && (( // specify single absolute path
                isNonEmptyString(value.absoluteDirPath)
            ) || ( // e.g. `C:/Users/{USER}/{rootName}{orgSeparator || ''}{ORG || ''}/{folderName}`
                isNonEmptyString(value.rootName)
                && (!value.folderName || isNonEmptyString(value.folderName))
                && (!value.orgSeparator || typeof value.orgSeparator === 'string')
            )
        )
    );
}

/**
 * - every `key` in `value` is an `AccountEnvironmentEnum`
 * - every `value[key]` is a {@link ScriptDictionary} (maps `ScriptTypeEnum` to `{ [scriptLabel: string]: ScriptDetails }`)
 * @param value `any`
 * @returns **`isSuiteScriptEnvironment`** `boolean`
 */
export function isSuiteScriptEnvironment(value: any): value is SuiteScriptEnvironment {
    return (isObject(value, false)
        && Object.keys(value).every(k=> isAccountEnvironmentEnum(k)
            && value[k] === undefined || isScriptDictionary(value[k])
        )
    );
}

export function isAccountEnvironmentEnum(value: any): value is AccountEnvironmentEnum {
    return (isNonEmptyString(value)
        && Object.values(AccountEnvironmentEnum).includes(value as AccountEnvironmentEnum)
    )
}

export function isScriptDetails(value: any): value is ScriptDetails {
    return (isObject(value)
        && isInteger(value.scriptId)
        && isInteger(value.deployId)
        && (!value.scriptName || isNonEmptyString(value.scriptName))
        && (!value.deployName || isNonEmptyString(value.deployName))
    );
}

/**
 * - every `key` in `value` is a {@link ScriptTypeEnum}
 * - every `value[key]` is `{ [scriptLabel: string]: ScriptDetails }`
 * @param value `any`
 * @returns **`isScriptDictionary`** `boolean`
 */
export function isScriptDictionary(value: any): value is ScriptDictionary {
    return (isObject(value)
        && Object.keys(value).every(
            k=>isNonEmptyString(k) 
                && Object.values(ScriptTypeEnum).includes(k as ScriptTypeEnum)
                && isObject(value[k])
                && Object.keys(value[k]).every(
                    subKey=> isNonEmptyString(subKey) 
                        && isScriptDetails(value[k][subKey])
                    )
        )
    )
}