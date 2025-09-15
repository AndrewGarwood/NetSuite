/**
 * @file src/config/dataLoader.ts
 * @description Centralized data loading to avoid circular dependencies 
 * and ensure proper initialization order
 */
import path from "node:path";
import { 
    STOP_RUNNING, isEnvironmentInitialized,
    getDataLoaderConfiguration, 
    getDataSourceConfigPath,
    getProjectFolders,
} from "./env";
import { 
    mainLogger as mlog, simpleLogger as slog, INDENT_LOG_LINE as TAB, NEW_LINE as NL 
} from "./setupLog";
import { 
    readJsonFileAsObject as read, 
    isValidCsvSync,
    getOneToOneDictionary, getRows, 
    writeObjectToJsonSync as write, 
    getSourceString,
    isFile
} from "typeshi:utils/io";
import { 
    DataSourceDictionary,
    isDataSourceDictionary,
    isFolderHierarchy, isLoadFileOptions 
} from "@config/types";
import {
    isNonEmptyArray, isNonEmptyString, 
    isNullLike as isEmpty, isStringArray, 
    isObject,
    isInteger,
    isEmptyArray
} from "typeshi:utils/typeValidation";
import { AccountTypeEnum, AccountDictionary } from "../utils/ns";
import { WarehouseDictionary, WarehouseRow, WarehouseColumnEnum } from "src/pipelines";
import { clean, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION, extractFileName } from "typeshi:utils/regex";
import * as validate from "typeshi:utils/argumentValidation"
import { 
    DataDomainEnum, 
    DataSourceConfiguration,
    LoadFileOptions, 
    FolderHierarchy 
} from "@config/types/ProjectData";


/**
 * `sync` Check if data has been initialized
 * @returns **`dataInitialized`** `boolean`
 */
export function isDataInitialized(): boolean {
    return dataInitialized;
}
/** Global state to track if data has been loaded */
let dataInitialized = false;
const F = extractFileName(__filename);
/* ------------------------------ ACCOUNTING ------------------------------ */
let skuDictionary: Record<string, string> | null = null;
let inventoryRows: Record<string, any>[] | null = null;
let inventoryCache: Record<string, string> | null = null;
/** map `account` to `'internalid'` */
let accountDictionary: Record<string, any> | null = null;
/** map `className` to `'internalid'` */
let classDictionary: Record<string, string> | null = null;
/** units of measure type to `internalid` */
let unitTypeDictionary: Record<string, number> | null = null;

/* -------------------------------- SUPPLY -------------------------------- */
/** map `binnumber` to `internalid` */
let binDictionary: Record<string, string> | null = null;
/** heirarchical relationship of locations->bins->items->lot_numbers */
let warehouseDictionary: WarehouseDictionary | null = null;
/** `{ `{@link WarehouseColumnEnum}`: any }[]` */
let warehouseRows: WarehouseRow[] | null = null;

let bomRows: Record<string, any>[] | null = null;

/* ---------------------------- RELATIONSHIPS ----------------------------- */
let customerCategoryDictionary: Record<string, number> | null = null;
let entityValueOverrides: Record<string, string> | null = null;
let humanVendorList: string[] | null = null;
let dataSources: DataSourceDictionary | null = null;


/* ------------------------- MAIN FUNCTION ----------------------------- */
/** `['.tsv', '.csv']` */
const delimitedFileExtensions = ['.tsv', '.csv'];

/**
 * @note **Requires** `initializeEnviornment()` to be called first
 * - Initialize all data required by the application.
 * - This should be called once at the start of the application.
 * - sets {@link dataInitialized} to `true`
 */
export async function initializeData(): Promise<void> {
    const source = getSourceString(F, initializeData.name);
    if (!isEnvironmentInitialized()) {
        throw new Error(`${source} Unable to load data. Please  call initializeEnvironment() first.`)
    }
    if (dataInitialized) {
        mlog.info(`${source} Data already initialized, skipping...`);
        return;
    }
    let dataDir = getProjectFolders().dataDir;
    let { domains } = getDataLoaderConfiguration();

    /**path to project.data.config.json */
    let dataSourceConfigPath = getDataSourceConfigPath();
    validate.existingFileArgument(source, '.json', {dataSourceConfigPath});
    dataSources = read(dataSourceConfigPath) as DataSourceDictionary;
    validate.objectArgument(source, {dataSources, isDataSourceDictionary});
    for (let d of Object.values(DataDomainEnum)) { // @TODO change Object.values(DataDomainEnum) to domains ?
        validate.existingDirectoryArgument(source, {[`dataDir/${d}`]: path.join(dataDir, d) });
    }
    let accountingOptions = getDomainLoadFileOptions(DataDomainEnum.ACCOUNTING)
    validate.objectArgument(source, {accountingOptions, isLoadFileOptions});
    mlog.info(`${source} Initializing application data...`);
    try {
        for (const d of domains) {
            switch (d) {
                case DataDomainEnum.ACCOUNTING:
                    inventoryRows = await loadInventoryRows();
                    inventoryCache = await loadInventoryCache();
                    skuDictionary = (
                        (!accountingOptions.overwriteCache && accountingOptions.useCache) 
                        ? inventoryCache 
                        : await loadOneToOneDictionary(
                            inventoryRows, 
                            accountingOptions.itemIdColumn as string, 
                            accountingOptions.internalIdColumn as string
                        )
                    );
                    unitTypeDictionary = await loadUnitTypeDictionary();
                    classDictionary = await loadClassDictionary();
                    accountDictionary = await loadAccountDictionary();
                    if (accountingOptions.overwriteCache) {
                        // TODO: implement this...
                    }
                    break;
                case DataDomainEnum.SUPPLY:
                    binDictionary = await loadBinDictionary();
                    warehouseRows = await loadWarehouseRows()
                    warehouseDictionary = await loadWarehouseDictionary(warehouseRows);
                    bomRows = await loadBomRows();
                    break;
                case DataDomainEnum.RELATIONSHIPS:
                    entityValueOverrides = await loadEntityOverrides();
                    customerCategoryDictionary = await loadCustomerCategoryDictionary();
                    humanVendorList = await loadHumanVendorList();
                    break;
                default:
                    mlog.warn(
                        `${source} Unrecognized/unsupported data domain: '${d}'. Skipping...`
                    );
                    continue;
            }
            slog.info(` -- Finished loading domain '${d}'`)
        }
        dataInitialized = true;
        slog.info(`${source} ✓ All data initialized successfully`);
    } catch (error) {
        mlog.error(`${source} ✗ Failed to initialize data:`, error);
        STOP_RUNNING(1, 'Data initialization failed');
    }
}


function getDomainFilePath(
    domain: DataDomainEnum,
    fileLabel: string,
    folderName?: string
): string {
    const source = getSourceString(F, getDomainFilePath.name);
    if (!dataSources) {
        throw new Error([`${source} Unable to get domain filepath`,
            `dataSources (DataSourceDictionary) is not defined.`,
        ].join(TAB));
    }
    const dataDir = getProjectFolders().dataDir;
    let domainConfig = dataSources[domain];
    let ancestors = [dataDir, domain];
    let filePath = getDescendant(ancestors, domainConfig, fileLabel, folderName);
    if (!isNonEmptyString(filePath)) {
        throw new Error([`${source} Invalid fileLabel (string)`,
            `  domiain: '${domain}'`,
            `fileLabel: '${fileLabel}'`,
            `DataSourceConfiguration for '${domain}' does not have key`
            +`or descendant with key equal to provided fileLabel`+(isNonEmptyString(folderName) ? `at folderName: '${folderName}'`: ''),
            `please review data.config file`
        ].join(TAB));
    }
    return filePath;
}

/**
 * - get descendant filepath from a FolderHierarchy
 * @param ancestors 
 * @param parent 
 * @param targetKey 
 * @param targetParent 
 * @returns 
 */
function getDescendant(
    ancestors: string[],
    parent: DataSourceConfiguration | FolderHierarchy, 
    targetKey: string,
    /** if want child of specific subfolder (useful if have duplicate key names) */
    targetParent?: string
): string | undefined {
    if (targetKey in parent) {
        let targetValue: string[] | undefined = (isNonEmptyString(parent[targetKey]) 
            ? [parent[targetKey]] 
            : isStringArray(parent[targetKey]) 
            ? parent[targetKey] 
            : undefined
        );
        if (!targetValue) { return '' } // if targetValue reached last case
        let parts = [...ancestors, ...targetValue];
        if (isNonEmptyString(targetParent) && parts[parts.length-2] !== targetParent) {
            // if have found targetKey under a different parent
            return '';
        }
        return path.join(...parts);
    }
    let folderKeys = Object.keys(parent).filter(k=>
        k !== 'options' && isObject(parent[k])
    );
    for (let k of folderKeys) {
        if (isNonEmptyString(targetParent) && k !== targetParent) { continue }
        let childResult = getDescendant([...ancestors, k], parent[k], targetKey, targetParent)
        if (childResult) { return childResult }
    }
    return;
}


function getDomainLoadFileOptions(
    domain: DataDomainEnum
): LoadFileOptions {
    const source = getSourceString(F, getDomainLoadFileOptions.name);
    if (!dataSources) {
        throw new Error([`${source} Unable to get domainOptions, dataSources (DataSourceDictionary) is not defined yet.`].join(TAB));
    }
    let domainConfig = dataSources[domain];
    if (domainConfig && domainConfig.options) {
        return domainConfig.options;
    }
    mlog.warn([`${source} No options (LoadFileOptions) found for domain '${domain}'`,
        `defined keys in dataSources['${domain}']: ${Object.keys(domainConfig).join(', ')}`
    ].join(TAB))
    return {}
}

async function loadInventoryRows(
    domain: DataDomainEnum = DataDomainEnum.ACCOUNTING,
    fileLabel: string = "inventoryExport",
    folderName: string = 'items',
): Promise<Record<string, any>[]> {
    const source = getSourceString(F, loadInventoryRows.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, delimitedFileExtensions, {filePath});
    const rows = await getRows(filePath);
    if (!isNonEmptyArray(rows)) {
        throw new Error([`${source} No inventory rows read from file`,
            `filePath: '${filePath}'`
        ].join(TAB));
    }
    return rows;
}

async function loadUnitTypeDictionary(
    domain: DataDomainEnum = DataDomainEnum.ACCOUNTING,
    fileLabel = 'unitTypeDictionary',
    folderName?: string
): Promise<Record<string, number>> {
    const source = getSourceString(F, loadUnitTypeDictionary.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, '.json', {filePath});
    let data = read(filePath);
    if (!Object.keys(data).every(k=>isNonEmptyString(k) && isInteger(data[k]))) {
        throw new Error([`${source} Invalid unitTypeDictionary`,
            `filePath: '${filePath}'`,
            `expected json with string keys and integer values`
        ].join(TAB));
    }
    return data as Record<string, number>;
}

/**
 * @param fileLabel `string`
 * @param folderName `string` `default` = 'binnumbers' (subfolder of `'{dataDir}/supply'`)
 * @returns **`binDictionary`** `Promise<Record<string, string>>`
 */
async function loadBinDictionary(
    domain: DataDomainEnum = DataDomainEnum.SUPPLY,
    fileLabel: string = 'binDictionary',
    folderName: string = 'binnumbers',
): Promise<Record<string, string>> {
    const source = getSourceString(F, loadBinDictionary.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, delimitedFileExtensions, {filePath});
    let options = getDomainLoadFileOptions(domain);
    const dict = await loadOneToOneDictionary(filePath, 
        options.binNumberColumn as string, 
        options.internalIdColumn as string
    );
    if (isEmpty(dict)) {
        throw new Error([`${source} No bin entries read from file`,
            `filePath: '${filePath}'`
        ].join(TAB));
    }
    return dict;
}

/**
 * @param fileLabel `string`
 * @param folderName `string`
 * @returns **`classDictionary`** `Promise<Record<string, string>>`
 */
async function loadClassDictionary(
    domain: DataDomainEnum = DataDomainEnum.ACCOUNTING,
    fileLabel: string = "classDictionary",
    folderName?: string,
): Promise<Record<string, string>> {
    const source = getSourceString(F, loadClassDictionary.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, delimitedFileExtensions, {filePath});
    let options = getDomainLoadFileOptions(domain);
    const dict = await loadOneToOneDictionary(filePath,
        options.classNameColumn as string, 
        options.internalIdColumn as string
    );
    if (isEmpty(dict)) {
        throw new Error([`${source} No class entries read from file`,
            `filePath: '${filePath}'`
        ].join(TAB));
    }
    return dict;
}

async function loadInventoryCache(
    domain: DataDomainEnum = DataDomainEnum.ACCOUNTING,
    fileLabel: string = "inventoryCache",
    folderName: string = 'items',
): Promise<Record<string, string>> {
    const source = getSourceString(F, loadInventoryCache.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, '.json', {filePath});
    let jsonData = read(filePath);
    let keys = Object.keys(jsonData);
    if (keys.length === 0) {
        mlog.warn([`${source} No data read into inventoryCache`,
            `filePath: '${filePath}'`
        ].join(TAB));
        return {}
    }
    for (let i = 0; i < keys.length; i++) {
        let itemId = keys[i];
        let internalId = jsonData[itemId];
        if (!isNonEmptyString(itemId) || !isNonEmptyString(internalId)) {
            throw new Error([`${source} Invalid entry in inventoryCache at keyIndex ${i}`,
                `      itemId (key): '${itemId}'`,
                `internalId (value): '${internalId}'`,
                `          filePath: '${filePath}'`
            ].join(TAB));
        }
    }
    return jsonData as Record<string, string>;
}

async function loadBomRows(
    domain: DataDomainEnum = DataDomainEnum.SUPPLY,
    fileLabel: string = 'bomExport',
    folderName: string = 'billofmaterials'
): Promise<Record<string, any>[]> {
    const source = getSourceString(F, loadBomRows.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, delimitedFileExtensions, {filePath});
    const rows = await getRows(filePath) as Record<string, any>[];
    validate.arrayArgument(source, {rows, isObject});
    return rows;
}

async function loadWarehouseRows(
    domain: DataDomainEnum = DataDomainEnum.SUPPLY,
    fileLabel: string = 'warehouseData',
    folderName: string = 'binnumbers',
): Promise<WarehouseRow[]> {
    const source = getSourceString(F, loadWarehouseRows.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, delimitedFileExtensions, {filePath});
    const rows = await getRows(filePath) as WarehouseRow[];
    return rows;
}

async function loadWarehouseDictionary(
    rows: Record<string, any>[]
): Promise<WarehouseDictionary> {
    const source = getSourceString(F, loadWarehouseDictionary.name);
    validate.arrayArgument(source, {rows, isObject})
    const dict: WarehouseDictionary = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let locNumber = Number(row[WarehouseColumnEnum.LOCATION_INTERNAL_ID]);
        let binId = String(row[WarehouseColumnEnum.BIN_INTERNAL_ID]);
        let itemId = String(row[WarehouseColumnEnum.ITEM_ID]);
        if (!isInteger(locNumber)) {
            mlog.error(`${source} Invalid LOCATION_INTERNAL_ID at warehouseRows[${i}]`);
            continue;
        }
        if (!isNonEmptyString(binId)) {
            mlog.error(`${source} Invalid BIN_INTERNAL_ID at warehouseRows[${i}]`);
            continue;
        }
        if (!isNonEmptyString(itemId)) {
            mlog.error(`${source} Invalid ITEM_ID at warehouseRows[${i}]`);
            continue;
        }
        if (!dict[locNumber]) {
            dict[locNumber] = {};
        }
        if (!dict[locNumber][binId]) {
            dict[locNumber][binId] = {};
        }
        if (!dict[locNumber][binId][itemId]) {
            dict[locNumber][binId][itemId] = {
                description: String(row[WarehouseColumnEnum.ITEM_DESCRIPTION]),
                lotNumbers: [],
            };
        }
        let lotNumber = String(row[WarehouseColumnEnum.LOT_NUMBER]);
        if (isNonEmptyString(lotNumber) 
                && !dict[locNumber][binId][itemId].lotNumbers.includes(lotNumber)) {
            dict[locNumber][binId][itemId].lotNumbers.push(lotNumber);
        }
    }
    return dict;
}


async function loadEntityOverrides(
    domain: DataDomainEnum = DataDomainEnum.RELATIONSHIPS,
    fileLabel: string = 'entityOverrides',
    folderName: string = 'customers',
): Promise<Record<string, string>> {
    const source = getSourceString(F, loadEntityOverrides.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, '.json', {filePath});
    let jsonData = read(filePath);
    let keys = Object.keys(jsonData);
    if (keys.length === 0) {
        throw new Error([`${source} No data read into entityOverrides`,
            `filePath: '${filePath}'`
        ].join(TAB));
    }
    for (let i = 0; i < keys.length; i++) {
        let initialValue = keys[i];
        let overrideValue = jsonData[initialValue];
        if (!isNonEmptyString(initialValue) || !isNonEmptyString(overrideValue)) {
            throw new Error([`${source} Invalid entry in entityOverrides at keyIndex ${i}`,
                `   initialValue (key): '${initialValue}'`,
                `overrideValue (value): '${overrideValue}'`,
                `filePath: '${filePath}'`
            ].join(TAB));
        }
    }
    return jsonData as Record<string, string>;
}

async function loadHumanVendorList(
    domain: DataDomainEnum = DataDomainEnum.RELATIONSHIPS,
    fileLabel: string = 'humanVendors',
    folderName: string = 'vendors'
): Promise<string[]> {
    const source = getSourceString(F, loadHumanVendorList.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, '.json', {filePath});
    const jsonData = read(filePath);
    if (!jsonData || !isStringArray(jsonData[fileLabel])) {
        throw new Error([`${source} Invalid json data`,
            ` Expected: { humanVendors: string[] }`,
            ` filePath: '${filePath}'`,
            `fileLabel: '${fileLabel}'`
        ].join(TAB));
    }
    return jsonData[fileLabel].map(
        (name: string) => clean(name, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
    );
}

async function loadCustomerCategoryDictionary(
    domain: DataDomainEnum = DataDomainEnum.RELATIONSHIPS,
    fileLabel: string='categoryDictionary',
    folderName: string='customers'
): Promise<Record<string, number>> {
    const source = getSourceString(F, loadCustomerCategoryDictionary.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, '.json', {filePath});
    const jsonData = read(filePath);
    if (!isObject(jsonData) || isEmpty(jsonData)) {
        throw new Error([`${source} no object/data read from file`,
            `filePath: '${filePath}'`
        ].join(TAB));
    }
    for (let category of Object.keys(jsonData)) {
        if (!isInteger(jsonData[category])) {
            throw new Error([`${source} Invalid value for entry in dictionary`,
                `category: '${category}'`,
                `Expected data[category]: integer`,
                `Received data[category]: ${typeof jsonData[category]} = '${jsonData[category]}'`
            ].join(TAB));
        }
    }
    return jsonData;


}



async function loadAccountDictionary(
    domain: DataDomainEnum = DataDomainEnum.ACCOUNTING,
    fileLabel: string = 'accountDictionary',
    folderName: string = 'accounts'
): Promise<AccountDictionary> {
    const source = getSourceString(F, loadAccountDictionary.name);
    let filePath = getDomainFilePath(domain, fileLabel, folderName);
    validate.existingFileArgument(source, '.json', {filePath});
    const data = read(filePath);
    if (isEmpty(data)) {
        throw new Error([
            `[dataLoader.loadAccountDictionary()] Invalid jsonData`,
            `filePath: '${filePath}'`
        ].join(TAB));
    }
    for (const accountType of Object.values(AccountTypeEnum)) {
        if (isEmpty(data[accountType])) {
            throw new Error([
                `[dataLoader.loadAccountDictionary()] Invalid jsonData`,
                `jsonData is missing data for required key: '${accountType}'`,
                `filePath: '${filePath}'`
            ].join(TAB));
        }
    }
    return data as AccountDictionary;
}



/**
 * @note for now, only use when loading from (tsv/csv file or row array)
 * @param rowSource 
 * @param keyColumn 
 * @param valueColumn 
 * @returns 
 */
async function loadOneToOneDictionary(
    rowSource: string | Record<string, any>[],
    keyColumn: string,
    valueColumn: string,
): Promise<Record<string, string>> {
    const source = getSourceString(F, loadOneToOneDictionary.name);
    validate.multipleStringArguments(source, {keyColumn, valueColumn});
    if (isNonEmptyString(rowSource) && !isValidCsvSync(rowSource, [keyColumn, valueColumn])) {
        let msg = [`${source} Invalid CSV file provided (either not found or missing required columns)`,
            `  keyColumn: '${keyColumn}'`,
            `valueColumn: '${valueColumn}'`,
            `   filePath: '${rowSource}'`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    let dict = await getOneToOneDictionary(rowSource, keyColumn, valueColumn);
    if (isEmpty(dict)) {
        let msg = [`${source} CSV file did not have data in provided columns`,
            `  keyColumn: '${keyColumn}'`,
            `valueColumn: '${valueColumn}'`,
            `   filePath: '${rowSource}'`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    return dict;
}





/**
 * `sync`
 * `Public API`: Gets the {@link AccountDictionary} = `{ [accountType: string]: Record<string, string> }` 
 * - = `{ [accountType: string]: { [accountName: string]: string } }` 
 * - - `accountName` mapped to `internalid`
 * @returns
 */
export function getAccountDictionary(): AccountDictionary {
    if (!accountDictionary) {
        throw new Error([`${getSourceString(F, getAccountDictionary.name)} accountDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return accountDictionary;
}


/**
 * `sync`
 * @returns **`classDictionary`** `Record<string, string>`
 */
export function getClassDictionary(): Record<string, string> {
    if (!classDictionary) {
        throw new Error([`${getSourceString(F, getClassDictionary.name)} classDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return classDictionary;
}

/**
 * `sync`
 * @returns **`classDictionary`** `Record<string, string>`
 */
export function getUnitTypeDictionary(): Record<string, number> {
    if (!unitTypeDictionary) {
        throw new Error([`${getSourceString(F, getUnitTypeDictionary.name)} unitTypeDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return unitTypeDictionary;
}

/**
 * `sync`
 * @returns **`skuDictionary`** `Record<string, string>`
 */
export function getSkuDictionary(): Record<string, string> {
    if (!skuDictionary) {
        throw new Error([`${getSourceString(F, getSkuDictionary.name)} skuDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return skuDictionary;
}

/**
 * @param itemId 
 * @param newInternalId 
 * @returns **`oldItemInternalId`** `string | undefined`
 * - returns old internal id of item if itemId in skuDictionary()
 * - else return undefined
 */
export function setSkuInternalId(itemId: string, newInternalId: string | number): string | undefined {
    const source = getSourceString(F, setSkuInternalId.name);
    if (!skuDictionary) {
        throw new Error([`${source} skuDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    let skuDictionaryPath = getDomainFilePath(DataDomainEnum.ACCOUNTING, 'inventoryCache', 'items');
    try {
        validate.existingFileArgument(source, '.json', {skuDictionaryPath});
        validate.multipleStringArguments(source, {itemId, newInternalId});
    } catch (error: any) {
        mlog.error(`${source} Invalid Arguments`, error);
        return;
    }
    let oldItemInternalId = skuDictionary[itemId];
    skuDictionary[itemId] = String(newInternalId);
    write(skuDictionary, skuDictionaryPath);
    return oldItemInternalId;
}
/**
 * `sync`
 * @returns **`inventoryRows`** `Record<string, any>[]`
 */
export function getInventoryRows(): Record<string, any>[] {
    if (!inventoryRows) {
        throw new Error([`${getSourceString(F, getInventoryRows.name)} inventoryRows undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return inventoryRows;
}

/**
 * `sync`
 * @returns **`binDictionary`** `Record<string, string>`
 */
export function getBinDictionary(): Record<string, string> {
    if (!binDictionary) {
        throw new Error([`${getSourceString(F, getBinDictionary.name)} binDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return binDictionary;
}

/**
 * `sync`
 * @returns **`warehouseRows`** `WarehouseRow[]`
 */
export function getWarehouseRows(): WarehouseRow[] {
    if (!warehouseRows) {
        throw new Error([`${getSourceString(F, getWarehouseRows.name)} warehouseRows undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return warehouseRows;
}

/**
 * `sync`
 * @returns **`bomRows`** `Record<string, any>[]`
 */
export function getBomRows(): Record<string, any>[] {
    if (!bomRows) {
        throw new Error([`${getSourceString(F, getBomRows.name)} bomRows undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return bomRows;
}

/**
 * `sync`
 * @returns **`warehouseDictionary`**
 */
export function getWarehouseDictionary(): WarehouseDictionary {
    if (!warehouseDictionary) {
        throw new Error([`${getSourceString(F, getWarehouseDictionary.name)} warehouseDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return warehouseDictionary;
}

/**
 * `sync`
 * @returns **`entityValueOverrides`** `Promise<Record<string, string>>`
 */
export function getEntityValueOverrides(): Record<string, string> {
    if (!entityValueOverrides) {
        throw new Error([
            `${getSourceString(F, getEntityValueOverrides.name)} entityValueOverrides undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return entityValueOverrides;
}

export function getCustomerCategoryDictionary(): { [category: string]: number } {
    if (!customerCategoryDictionary) {
        throw new Error([
            `${getSourceString(F, getCustomerCategoryDictionary.name)} customerCategoryDictionary undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return customerCategoryDictionary;
}

export function getHumanVendorList(): string[] {
    if (!humanVendorList) {
        throw new Error([
            `${getSourceString(F, getHumanVendorList.name)} humanVendorList undefined`,
            `call initializeData() first`
        ].join(TAB));
    }
    return humanVendorList;
}