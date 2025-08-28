/**
 * @file src/types/ProjectEnvironment.ts
 */

import { DataDomainEnum } from "@config/types/ProjectData";
import { AccountEnvironmentEnum, SuiteScriptEnvironment } from "@utils/ns/SuiteScript";

/**
 * @typedefn **`ProjectConfiguration`**
 */
export type ProjectConfiguration = {
    name: string;
    nodeEnv: string;
    srcDir: string;
    dataLoader: DataLoaderConfiguration;
    scripts: SuiteScriptEnvironment;
    [key: string]: any;
} & ({
    cloud: CloudConfiguration;
    local: never;
} | {
    cloud: never;
    local: LocalConfiguration;
})

/**
 * @interface **`ResourceFolderConfiguration`**
 * - values are either folder names or complete directory paths
 */
export interface ResourceFolderConfiguration {
    dataDir: string;
    logDir: string;
    outDir: string;
}

export type CloudConfiguration = ResourceFolderConfiguration & ({
    /**`C:/Users/{USER}`/**{rootName}**`{orgSeparator || ''}{ORG || ''}/{folderName}` */
    rootName: string;
    /**`C:/Users/{USER}/{rootName}`**{orgSeparator || ''}**`{ORG || ''}/{folderName}` */
    orgSeparator?: string;
    /**`C:/Users/{USER}/{rootName}{orgSeparator || ''}{ORG || ''}`/**`{folderName}`** */
    folderName?: string;
    absoluteDirPath: never;
} | {
    /** `absolute/path/to/dir` */
    absoluteDirPath: string;
    rootName: never;
    orgSeparator: never;
    folderName: never;
}) 

export type LocalConfiguration = ResourceFolderConfiguration & {
    [key: string]: any;
}

/**
 * @interface **`DataLoaderConfiguration`**
 * use in dataLoader.ts to determine which data domains to load and from where
 * - `dataSourceConfigFile` should be the name of a `DataSourceDictionary` json file
 */
export interface DataLoaderConfiguration {
    loadFromCloud: boolean;
    /**`the name of a `DataSourceDictionary` json file` */
    dataSourceConfigFile: string;
    domains: DataDomainEnum[]
    [key: string]: any;
}


export type AccountDetails = {
    id: string;
    name: string;
    type: string;
    [key: string]: any;
}

export type NetSuiteAccountDictionary = {
    [accountEnv in AccountEnvironmentEnum]: AccountDetails;
}