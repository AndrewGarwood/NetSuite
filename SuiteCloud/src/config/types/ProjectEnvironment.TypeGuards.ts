/**
 * @file src/config/types/ProjectEnvironment.TypeGuards.ts
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
    const candidate = value as DataLoaderConfiguration;
    return (isObject(candidate)
        && isNonEmptyString(candidate.dataSourceConfigFile)
        && isNonEmptyArray(candidate.domains)
        && candidate.domains.every(d=>Object.values(domainEnum).includes(d))
    );
}

export function isLocalConfiguration(value: any): value is LocalConfiguration {
    const candidate = value as LocalConfiguration;
    return (isObject(candidate)
        && (isNonEmptyString(candidate.dataDir))
        && (isNonEmptyString(candidate.logDir))
        && (isNonEmptyString(candidate.tokDir))
    );
}

export function isCloudConfiguration(value: any): value is CloudConfiguration {
    const candidate = value as CloudConfiguration;
    return (isObject(candidate)
        && (isNonEmptyString(candidate.dataDir))
        && (isNonEmptyString(candidate.logDir))
        && (isNonEmptyString(candidate.tokDir))
        && (( // specify single absolute path
                isNonEmptyString(candidate.absoluteDirPath)
            ) || ( // e.g. `C:/Users/{USER}/{rootName}{orgSeparator || ''}{ORG || ''}/{folderName}`
                isNonEmptyString(candidate.rootName)
                && (!candidate.folderName || isNonEmptyString(candidate.folderName))
                && (!candidate.orgSeparator || typeof candidate.orgSeparator === 'string')
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
    return (isObject(value)
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
    return (isObject(value, false)
        && Object.keys(value).every(
            k=>isNonEmptyString(k) 
                && Object.values(ScriptTypeEnum).includes(k as ScriptTypeEnum)
                && isObject(value[k], false)
                && Object.keys(value[k]).every(
                    subKey=> isNonEmptyString(subKey) 
                        && isScriptDetails(value[k][subKey])
                    )
        )
    )
}