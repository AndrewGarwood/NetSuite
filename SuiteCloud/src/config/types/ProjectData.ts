/**
 * @file src/config/types/ProjectData.ts
 */

import { WarehouseDictionary, WarehouseRow } from "src/pipelines/types/Warehouse";


/**
 * @enum {string} **`DataDomainEnum`**
 * @property **`ACCOUNTING`** = `'accounting'`
 * @property **`SUPPLY`** = `'supply'`
 * @property **`RELATIONSHIPS`** = `'relationships'`
 */
export enum DataDomainEnum {
    ACCOUNTING = 'accounting',
    SUPPLY = 'supply',
    RELATIONSHIPS = 'relationships'
}


export type DataSourceDictionary = {
    [key in DataDomainEnum]: DataSourceConfiguration
};

export type DataSourceConfiguration = FolderHierarchy & { options?: LoadFileOptions }

/**
 * @key is folderName or fileLabel
 * @value is child FolderHierarchy or fileName
 */
export type FolderHierarchy = {
    [folderName: string]: FolderHierarchy
} & FileDictionary

export type LoadFileOptions = { 
    [key: string]: string | number | boolean 
};

export type FileDictionary = { 
    [fileKey: string]: string | string[]
};

// export type CompositeFileDictionary = {
//     [domain: string]: { 
//         [fileKey:string]: string[] 
//     }
// };

/**
 * map file key to `string[]` such that path to file is
 * `path.join(...CompositeFileDictionary[fileKey])`
 */
// export type CompositeFileDictionary = {
//     [fileKey: string]: string[]
// }

// export type LoadFileOptions = {
//     name: string,
//     [key: string]: any
// }

export interface WarehouseData {
    dictionary: WarehouseDictionary;
    rows: WarehouseRow[]
}
export interface CustomerData {
    /** map `category` to corresponding netsuite category's `'internalid'` */
    categoryDictionary: Record<string, number>;
}
export interface VendorData {
    humanVendors: string[]
}
