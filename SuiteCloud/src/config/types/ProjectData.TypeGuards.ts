/**
 * @file src/config/types/ProjectData.TypeGuards.ts
 */
import { isNonEmptyArray, isNonEmptyString, isObject, isStringArray } from "@typeshi/typeValidation";
import { 
    DataDomainEnum, 
    DataSourceDictionary,
    FolderHierarchy, 
    FileDictionary, 
    LoadFileOptions,
    DataSourceConfiguration
} from "./ProjectData";

/**
 * - every `d` of `Object.values(domainEnum)` must be a key of `value`
 * - - every `value[d]` must be {@link FolderHierarchy}` & { options?: `{@link LoadFileOptions}`}`
 * @param value `any`
 * @param domainEnum `Record<string, string | number>` 
 * @returns **`isDataSourceDictionary`** `boolean`
 */
export function isDataSourceDictionary(
    value: any,
    domainEnum: Record<string, string | number> = DataDomainEnum
): value is DataSourceDictionary {
    return (isObject(value)
        && Object.values(domainEnum).every(d=>
            d in value
            && isDataSourceConfiguration(value[d])
        )
    );
}

export function isDataSourceConfiguration(value: any): value is DataSourceConfiguration {
    return (isFolderHierarchy(value) 
        && (!value.options || isLoadFileOptions(value.options))
    );
}

/**
 * - assumes that there is no folder named 'options'
 * - for all `keys` (folder names) in `value` where key !== 'options', 
 * @param value `any`
 * @returns **`isFolderHierarchy`** `boolean`
 */
export function isFolderHierarchy(value: any): value is FolderHierarchy {
    return (isObject(value)
        && Object.keys(value)
            .filter(k=>k !== 'options')
            .every(key=>isNonEmptyString(key) 
                && (isNonEmptyString(value[key])
                    || isStringArray(value[key])
                    || isFileDictionary(value[key]) 
                    || isFolderHierarchy(value[key])
                )
        )
    )
}


/**
 * - each entry is a `fileLabel` mapped to `{fileName}.{fileExtension}`
 * where fileName is not a path, just the part corresponding to `path.basename` 
 * @param value `any`
 * @returns **`isFileDictionary`** `boolean`
 */
export function isFileDictionary(value: any): value is FileDictionary {
    return (isObject(value)
        && Object.keys(value).every(
            k=>isNonEmptyString(k) && (isNonEmptyString(value[k]) || isStringArray(value[k]))
        )
    );
}

/**
 * - isLoadFileOptions = `{ [optionKey: string]: string | number | boolean }` 
 * - use as simple flags/values when loading files of a specific domain
 * @param value `any`
 * @returns **`isLoadFileOptions`** `boolean`
 */
export function isLoadFileOptions(value: any): value is LoadFileOptions {
    return (isObject(value) 
        && Object.keys(value).every(
            k=>isNonEmptyString(k) 
            && (isNonEmptyString(value[k]) 
                || typeof value[k] === 'boolean' 
                || typeof value[k] === 'number'
            )
        )
    );
}

// function isFileOption(value: any): value is string | boolean | number {
//     return (isNonEmptyString(value) 
//         || typeof value === 'boolean' 
//         || typeof value === 'number'
//     );
// }
// export function isLoadFileOptions(value: any): value is LoadFileOptions {
//     return (isObject(value)
//         && isNonEmptyString(value.name)
//     )
// }