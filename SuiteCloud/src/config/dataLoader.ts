/**
 * @file src/config/dataLoader.ts
 * @description Centralized data loading to avoid circular dependencies 
 * and ensure proper initialization order
 */
import path from "node:path";
import { DATA_DIR, STOP_RUNNING } from "./env";
import { mainLogger as mlog, simpleLogger as slog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "./setupLog";
import { 
    readJsonFileAsObject as read, 
    isValidCsvSync,
    getOneToOneDictionary, getRows, 
    writeObjectToJsonSync as write 
} from "typeshi:utils/io";
import {
    hasKeys, hasNonTrivialKeys, isNonEmptyArray, isNonEmptyString, 
    isNullLike as isNull, isStringArray 
} from "typeshi:utils/typeValidation";
import { AccountTypeEnum, AccountDictionary } from "../utils/ns";
import { WarehouseDictionary, WarehouseRow, WarehouseColumnEnum } from "src/pipelines";
import { clean, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION } from "typeshi:utils/regex";
import * as validate from "typeshi:utils/argumentValidation"
// Global state to track if data has been loaded
let dataInitialized = false;
const F = path.basename(__filename).replace(/\.[a-z]{1,}$/, '');
/**
 * @enum {string} **`DataDomainEnum`**
 * @property **`REGEX`** = `'REGEX'` **can probably remove this since now handled by typeshi**
 * @property **`ACCOUNTING`** = `'ACCOUNTING'`
 * @property **`SUPPLY`** = `'SUPPLY'`
 * @property **`RELATIONSHIPS`** = `'RELATIONSHIPS'`
 */
export enum DataDomainEnum {
    REGEX = 'REGEX',
    ACCOUNTING = 'ACCOUNTING',
    SUPPLY = 'SUPPLY',
    RELATIONSHIPS = 'RELATIONSHIPS'
}
/* ----------------------- LOAD ACCOUNTING CONFIG --------------------------- */
/** `DATA_DIR/items/SKU_TO_INTERNAL_ID_DICT.json` */
const SKU_DICTIONARY_FILE = path.join(DATA_DIR, 'items', 'SKU_TO_INTERNAL_ID_DICT.json');
/** `DATA_DIR/uploaded/inventory_item.tsv` */
const ITEM_FILE = path.join(DATA_DIR, 'items', 'sb_all_item_export.tsv');
/** `DATA_DIR, 'binnumbers', 'bins.tsv'` */
const BIN_NUMBERS_FILE = path.join(DATA_DIR, 'binnumbers', 'bins.tsv');
/** `DATA_DIR, 'binnumbers', 'warehouseData.tsv'` */
const WAREHOUSE_DATA_FILE = path.join(DATA_DIR, 'binnumbers', 'warehouseData.tsv');
/** `DATA_DIR, '.constants', 'classes.tsv'` */
const CLASSES_FILE = path.join(DATA_DIR, '.constants', 'classes.tsv');
/** `DATA_DIR/accounts/accountDictionary.json` */
const ACCOUNT_DICTIONARY_FILE = path.join(DATA_DIR, 'accounts', 'accountDictionary.json');

let skuDictionary: Record<string, string> | null = null;
/** map `account` to `'internalid'` */
let accountDictionary: Record<string, any> | null = null;
const ClASS_NAME_COLUMN = 'Name';
/** map `className` to `'internalid'` */
let classDictionary: Record<string, string> | null = null;

/* ----------------------- LOAD SUPPLY CONFIG --------------------------- */
const BIN_NUMBER_COLUMN = 'Bin Number';
/** map `binnumber` to `internalid` */
let binDictionary: Record<string, string> | null = null;

/** parent object to hold the dictionary and rows */
let warehouseData: WarehouseData | null = null;
/** heirarchical relationship of locations->bins->items->lot_numbers */
let warehouseDictionary: WarehouseDictionary | null = null;
/** `{ `{@link WarehouseColumnEnum}`: any }[]` */
let warehouseRows: WarehouseRow[] | null = null;

export interface WarehouseData {
    dictionary: WarehouseDictionary;
    rows: WarehouseRow[]
}
/* --------------------- LOAD RELATIONSHIPS CONFIG ------------------------- */
/** `DATA_DIR, '.constants', 'customer_constants.json'` */
const CUSTOMER_CONSTANTS_FILE = path.join(DATA_DIR, '.constants', 'customer_constants.json');
/** `DATA_DIR, '.constants', 'vendor_constants.json'` */
const VENDOR_CONSTANTS_FILE = path.join(DATA_DIR, '.constants', 'vendor_constants.json');
/** `DATA_DIR, 'customers', 'entity_value_overrides.json'` */
const ENTITY_VALUE_OVERRIDE_FILE = path.join(DATA_DIR, 'customers', 'entity_value_overrides.json');

export interface CustomerData {
    /** map `category` to corresponding netsuite category's `'internalid'` */
    categoryDictionary: Record<string, number>;
}
let customerData: CustomerData | null = null;
let customerCategoryDictionary: Record<string, number> | null = null;
let entityValueOverrides: Record<string, string> | null = null;

export interface VendorData {
    humanVendors: string[]
}
let vendorData: VendorData | null = null;
let humanVendorList: string[] | null = null;


/* ------------------------- LOAD REGEX CONFIG ----------------------------- */
/** `DATA_DIR/.constants/regex_constants.json` */
const REGEX_FILE = path.join(DATA_DIR, '.constants', `regex_constants.json`);
let regexConstants: RegexConstants | null = null;

/**
 * @interface **`RegexConstants`**
 * @property **`COMPANY_KEYWORD_LIST`** `string[]` - List of keywords to identify company names
 * @property **`JOB_TITLE_SUFFIX_LIST`** `string[]` - List of common job title suffixes
 */
export interface RegexConstants {
    COMPANY_KEYWORD_LIST: string[];
    JOB_TITLE_SUFFIX_LIST: string[];
}
/* ------------------------- MAIN FUNCTION ----------------------------- */
const DEFAULT_INTERNAL_ID_COLUMN = 'Internal ID';
const DEFAULT_DOMAINS_TO_LOAD = [
    // DataDomainEnum.REGEX, 
    DataDomainEnum.ACCOUNTING,
    DataDomainEnum.SUPPLY,
    DataDomainEnum.RELATIONSHIPS
];

/**
 * @TODO change param of initializeData to be { [DataDomainEnum | string]: args[] } 
 * where args are passed in to the corresponding dataLoading function... or maybe 
 * something like `{ [DataDomainEnum | string]: { loader: function, args: any[] }[] }` 
 * 
 * - Initialize all data required by the application.
 * - This should be called once at the start of the application.
 * - sets {@link dataInitialized} to `true`
 * @param domains `...`{@link DataDomainEnum}`[]` defaults to `[DataDomainEnum.REGEX, DataDomainEnum.INVENTORY]`
 */
export async function initializeData(...domains: DataDomainEnum[]): Promise<void> {
    const source = `[dataLoader.initializeData()]`
    if (dataInitialized) {
        mlog.info(`${source} Data already initialized, skipping...`);
        return;
    }
    if (!isNonEmptyArray(domains)) {
        domains = DEFAULT_DOMAINS_TO_LOAD;
    }
    mlog.info(`${source} Initializing application data...`);
    try {
        for (const d of domains) {
            switch (d) {
                case DataDomainEnum.REGEX:
                    // regexConstants = await loadRegexConstants();
                    break;
                case DataDomainEnum.ACCOUNTING:
                    skuDictionary = await loadSkuDictionary();
                    accountDictionary = await loadAccountDictionary();
                    classDictionary = await loadClassDictionary();
                    break;
                case DataDomainEnum.SUPPLY:
                    binDictionary = await loadBinDictionary();
                    warehouseData = await loadWarehouseData();
                    warehouseDictionary = warehouseData.dictionary;
                    warehouseRows = warehouseData.rows;
                    break;
                case DataDomainEnum.RELATIONSHIPS:
                    entityValueOverrides = await loadEntityValueOverrides();
                    customerData = await loadCustomerData();
                    customerCategoryDictionary = customerData.categoryDictionary;
                    vendorData = await loadVendorData();
                    humanVendorList = vendorData.humanVendors;
                    break;
                default:
                    mlog.warn(
                        `${source} Unrecognized/unsupported data domain: '${d}'. Skipping...`
                    );
                    continue;
            }
        }
        dataInitialized = true;
        slog.info(`${source} ✓ All data initialized successfully`);
    } catch (error) {
        mlog.error(`${source} ✗ Failed to initialize data:`, error);
        STOP_RUNNING(1, 'Data initialization failed');
    }
}

async function loadVendorData(
    jsonPath: string = VENDOR_CONSTANTS_FILE
): Promise<VendorData> {
    const source = `[dataLoader.loadVendorData()]`
    validate.existingFileArgument(source, '.json', {jsonPath});
    const data = read(jsonPath);
    if (!data || typeof data !== 'object' 
        || !hasKeys(data, 'humanVendors') 
        || !isStringArray(data.humanVendors)) {
        let msg = [`${source} Invalid JSON file provided (either not found or missing required columns)`,
            `json Path received: '${jsonPath}'`,
            `json keys required: 'humanVendors' (string[])`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    humanVendorList = data.humanVendors.map(
        (name: string) => clean(name, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
    );
    return data as VendorData;
}

async function loadCustomerData(
    jsonPath: string = CUSTOMER_CONSTANTS_FILE
): Promise<CustomerData> {
    const source = `[${F}.loadCustomerData()]`
    validate.existingFileArgument(source, '.json', {jsonPath});
    const data = read(jsonPath);
    if (!data || typeof data !== 'object' || !hasKeys(data, 'categoryDictionary')) {
        let msg = [`${source} Invalid JSON file provided (either not found or missing required columns)`,
            `json Path received: '${jsonPath}'`,
            `json keys required: 'categoryDictionary' (Record<string, number>)`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    return data as CustomerData;
}

async function loadEntityValueOverrides(
    jsonPath: string = ENTITY_VALUE_OVERRIDE_FILE
): Promise<Record<string, string>> {
    const source = `[${F}.loadEntityOverrides()]`;
    validate.existingFileArgument(source, '.json', {jsonPath});
    const data = read(jsonPath) as Record<string, string>;
    if (!data || typeof data !== 'object') {
        let msg = [`${source} Invalid JSON file provided (not found)`,
            `json Path received: '${jsonPath}'`,
            `   format expected: (Record<string, string>)`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    slog.debug(`${source} num override keys: ${Object.keys(data).length}`)
    return data;
}

async function loadWarehouseData(
    csvPath: string = WAREHOUSE_DATA_FILE
): Promise<WarehouseData> {
    const source = `[dataLoader.loadWarehouseData()]`;
    if (!isValidCsvSync(csvPath, Object.values(WarehouseColumnEnum))) {
        let msg = [`${source} Invalid CSV file provided (either not found or missing required columns)`,
            `csvPath received: '${csvPath}'`,
            `   keys required: ${Object.values(WarehouseColumnEnum).join(', ')}`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    const dict: WarehouseDictionary = {};
    const rows = await getRows(csvPath) as WarehouseRow[];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const locNumber = Number(row[WarehouseColumnEnum.LOCATION_INTERNAL_ID]);
        if (!dict[locNumber]) {
            dict[locNumber] = {};
        }
        const binId = String(row[WarehouseColumnEnum.BIN_INTERNAL_ID]);
        if (!dict[locNumber][binId]) {
            dict[locNumber][binId] = {};
        }
        const itemId = String(row[WarehouseColumnEnum.ITEM_ID]);
        if (!dict[locNumber][binId][itemId]) {
            dict[locNumber][binId][itemId] = {
                description: String(row[WarehouseColumnEnum.ITEM_DESCRIPTION]),
                lotNumbers: [],
            };
        }
        const lotNumber = String(row[WarehouseColumnEnum.LOT_NUMBER]);
        if (isNonEmptyString(lotNumber) 
            && !dict[locNumber][binId][itemId].lotNumbers.includes(lotNumber)) {
            dict[locNumber][binId][itemId].lotNumbers.push(lotNumber);
        }
    }
    return { dictionary: dict, rows: rows } as WarehouseData
}


/**
 * @consideration could try reading json first and compare if all keys are in 
 * dictionary from return value of `getOneToOneDictionary`
 * @domain {@link DataDomainEnum.ACCOUNTING}
 * @param jsonPath `string` - Path to the JSON file `(default: SKU_DICTIONARY_FILE)`
 * @param csvPath `string` - Path to the CSV file `(default: ITEM_FILE)`
 * @param skuColumn `string` - Column name for SKU `(default: 'Name')`
 * @param internalIdColumn `string` - Column name for Internal ID `(default: DEFAULT_INTERNAL_ID_COLUMN)`
 * @param lazyLoad `boolean` `(default: true)`
 * - set to `true` if just want to load from `jsonPath` (assume file exists)
 * - set to `false` if you want to overwrite file at `jsonPath` (if it exists)
 * @returns **`dictionary`** `Promise<Record<string, string>>`
 */
async function loadSkuDictionary(
    jsonPath: string = SKU_DICTIONARY_FILE,
    csvPath: string = ITEM_FILE, 
    skuColumn: string = 'Name',
    internalIdColumn: string = DEFAULT_INTERNAL_ID_COLUMN,
    lazyLoad: boolean = true
): Promise<Record<string, string>> {
    const source = `[dataLoader.loadSkuDictionary()]`
    validate.multipleStringArguments(source, {jsonPath, csvPath, skuColumn, internalIdColumn})
    if (lazyLoad) { // Try to load from JSON file first
        try {
            const jsonData = read(jsonPath);
            if (jsonData && hasNonTrivialKeys(jsonData.SKU_TO_INTERNAL_ID_DICT)) {
                slog.info(`${source} Loaded SKU dictionary from JSON: ${Object.keys(jsonData.SKU_TO_INTERNAL_ID_DICT).length} entries`);
                return jsonData.SKU_TO_INTERNAL_ID_DICT as Record<string, string>;
            }
        } catch (error) {
            mlog.warn(`${source} Could not read JSON file, will try CSV: ${error}`);
        } 
    }
    
    // 2. Build dictionary from CSV file
    if (!isValidCsvSync(csvPath, [skuColumn, internalIdColumn])) {
        throw new Error(`${source} No JSON data && Invalid CSV file: '${csvPath}'`);
    }
    const dictionary = await getOneToOneDictionary(csvPath, skuColumn, internalIdColumn);
    if (!hasNonTrivialKeys(dictionary)) {
        throw new Error(`${source} No valid data found in CSV file: '${csvPath}'`);
    }
    // Cache the dictionary to JSON for future use
    try {
        write({ SKU_TO_INTERNAL_ID_DICT: dictionary }, jsonPath);
        mlog.debug(`${source} Built and cached SKU dictionary: ${Object.keys(dictionary).length} entries`);
    } catch (error) {
        mlog.warn(`${source} Could not write to JSON cache: ${error}`);
    }
    return dictionary;
}

async function loadOneToOneDictionary(
    csvPath: string,
    keyColumn: string,
    valueColumn: string=DEFAULT_INTERNAL_ID_COLUMN,
): Promise<Record<string, string>> {
    const source = `[dataLoader.loadSimpleDictionary('${path.basename(csvPath)}')]`;
    validate.multipleStringArguments(source, {keyColumn, valueColumn});
    if (!isValidCsvSync(csvPath, [keyColumn, valueColumn])) {
        let msg = [`${source} Invalid CSV file provided (either not found or missing required columns)`,
            `  keyColumn: '${keyColumn}'`,
            `valueColumn: '${valueColumn}'`,
            `   filePath: '${csvPath}'`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    let dict = await getOneToOneDictionary(csvPath, keyColumn, valueColumn);
    if (isNull(dict)) {
        let msg = [`${source} CSV file did not have data in provided columns`,
            `  keyColumn: '${keyColumn}'`,
            `valueColumn: '${valueColumn}'`,
            `   filePath: '${csvPath}'`
        ].join(TAB);
        mlog.error(msg)
        throw new Error(msg);
    }
    return dict;
}

/**
 * @domain {@link DataDomainEnum.ACCOUNTING}
 * @param jsonPath `string` - Defaults to {@link ACCOUNT_DICTIONARY_FILE}
 * @returns **`dictionary`** `Promise<`{@link AccountDictionary}`>` = `{ [accountType: string]: { [accountName: string]: string } }`
 * - `accountType` -> `accountName` -> `internalid (string)`
 */
async function loadAccountDictionary(
    jsonPath: string=ACCOUNT_DICTIONARY_FILE,
): Promise<AccountDictionary> {
    validate.existingFileArgument(`dataLoader.loadAccountDictionary`, '.json', {jsonPath});
    const jsonData = read(jsonPath);
    if (isNull(jsonData)) {
        throw new Error([
            `[dataLoader.loadAccountDictionary()] Invalid jsonData`,
            `jsonData from jsonPath is null or an empty object`,
            `json file path received: '${jsonPath}'`
        ].join(TAB));
    }
    for (const accountType of Object.values(AccountTypeEnum)) {
        if (isNull(jsonData[accountType])) {
            throw new Error([
                `[dataLoader.loadAccountDictionary()] Invalid jsonData`,
                `jsonData is missing data for required key: '${accountType}'`,
                `filePath: '${jsonPath}'`
            ].join(TAB));
        }
    }
    return jsonData as AccountDictionary;
}

async function loadBinDictionary(
    csvPath: string=BIN_NUMBERS_FILE,
    binNumberColumn: string = BIN_NUMBER_COLUMN,
    internalIdColumn: string = DEFAULT_INTERNAL_ID_COLUMN
): Promise<Record<string, string>> {
    return await loadOneToOneDictionary(csvPath, binNumberColumn, internalIdColumn);
}

async function loadClassDictionary(
    csvPath: string=CLASSES_FILE,
    classColumn: string = ClASS_NAME_COLUMN,
    internalIdColumn: string = DEFAULT_INTERNAL_ID_COLUMN
): Promise<Record<string, string>> {
    return await loadOneToOneDictionary(csvPath, classColumn, internalIdColumn);
}

/**
 * Load regex constants
 * @param filePath `string` - Path to the regex constants JSON file (default: `REGEX_FILE`)
 * @returns **`regexConstants`** {@link RegexConstants}
 */
async function loadRegexConstants(
    filePath: string=REGEX_FILE
): Promise<RegexConstants> {
    const source = `[dataLoader.loadRegexConstants()]`
    validate.existingPathArgument(source, {filePath});
    const REGEX_CONSTANTS = read(filePath) as Record<string, any>;
    if (!REGEX_CONSTANTS || !hasKeys(REGEX_CONSTANTS, ['COMPANY_KEYWORD_LIST', 'JOB_TITLE_SUFFIX_LIST'])) {
        throw new Error(`${source} Invalid REGEX_CONSTANTS file at '${filePath}'. Expected json object to have 'COMPANY_KEYWORD_LIST' and 'JOB_TITLE_SUFFIX_LIST' keys.`);
    }
    const COMPANY_KEYWORD_LIST: string[] = REGEX_CONSTANTS.COMPANY_KEYWORD_LIST || [];
    if (!isNonEmptyArray(COMPANY_KEYWORD_LIST)) {
        throw new Error(`${source} Invalid COMPANY_KEYWORD_LIST in REGEX_CONSTANTS file at '${filePath}'`);
    }
    const JOB_TITLE_SUFFIX_LIST: string[] = REGEX_CONSTANTS.JOB_TITLE_SUFFIX_LIST || [];
    if (!isNonEmptyArray(JOB_TITLE_SUFFIX_LIST)) {
        throw new Error(`${source} Invalid JOB_TITLE_SUFFIX_LIST in REGEX_CONSTANTS file at '${filePath}'`);
    }
    slog.info(`${source} Loaded regex constants`,)
    return {
        COMPANY_KEYWORD_LIST,
        JOB_TITLE_SUFFIX_LIST,
    };
}


/**
 * `sync` Check if data has been initialized
 * @returns **`dataInitialized`** `boolean`
 */
export function isDataInitialized(): boolean {
    return dataInitialized;
}


/**
 * @deprecated - use typeshi library's dataLoader.getRegexConstants()
 * `sync` Get regex constants
 * @returns **`regexConstants`** {@link RegexConstants}
 */
function getRegexConstants(): RegexConstants {
    if (!dataInitialized || !regexConstants) {
        throw new Error('[getRegexConstants()] Regex constants not initialized. Call initializeData() first.');
    }
    return regexConstants;
}

/**
 * @deprecated - use typeshi library's dataLoader.getRegexConstants()
 * `sync` Get company keyword list
 * @returns **`COMPANY_KEYWORD_LIST`** `string[]`
 */
function getCompanyKeywordList(): string[] {
    const constants = getRegexConstants();
    return constants.COMPANY_KEYWORD_LIST;
}

/**
 * @deprecated - use typeshi library's dataLoader.getRegexConstants()
 * Get job title suffix list
 * @returns **`JOB_TITLE_SUFFIX_LIST`** `string[]`
 */
function getJobTitleSuffixList(): string[] {
    const constants = getRegexConstants();
    return constants.JOB_TITLE_SUFFIX_LIST;
}

/**
 * `Public API`: Gets the {@link AccountDictionary} = `{ [accountType: string]: Record<string, string> }` 
 * - = `{ [accountType: string]: { [accountName: string]: string } }` 
 * - - `accountName` mapped to `internalid`
 * - Initializes the dictionary if it hasn't been loaded yet from {@link ACCOUNT_DICTIONARY_FILE}.
 * @returns Promise that resolves to the Account dictionary
 */
export async function getAccountDictionary(): Promise<AccountDictionary> {
    if (!accountDictionary) {
        accountDictionary = await loadAccountDictionary();
    }
    return accountDictionary;
}


/**
 * `async`
 * `Public API`: Gets the Class name to Internal ID dictionary from {@link CLASSES_FILE}
 * - Initializes the dictionary if it hasn't been loaded yet.
 * @returns **`classDictionary`** `Promise<Record<string, string>>`
 */
export async function getClassDictionary(): Promise<Record<string, string>> {
    if (!classDictionary) {
        classDictionary = await loadClassDictionary();
    }
    return classDictionary;
}

/**
 * `async`
 * `Public API`: Gets the SKU to Internal ID dictionary from {@link SKU_DICTIONARY_FILE} = `DATA_DIR/items/SKU_TO_INTERNAL_ID_DICT.json`
 * - Initializes the dictionary if it hasn't been loaded yet.
 * 
 * @returns Promise that resolves to the SKU dictionary
 */
export async function getSkuDictionary(): Promise<Record<string, string>> {
    if (!skuDictionary) {
        skuDictionary = await loadSkuDictionary();
    }
    return skuDictionary;
}

/**
 * `async`
 * `Public API`: Gets the Bin Number to Internal ID dictionary from {@link BIN_NUMBERS_FILE}
 * - Initializes the dictionary if it hasn't been loaded yet.
 * @returns **`binDictionary`** `Promise<Record<string, string>>`
 */
export async function getBinDictionary(): Promise<Record<string, string>> {
    if (!binDictionary) {
        binDictionary = await loadBinDictionary();
    }
    return binDictionary;
}

/**
 * `async`
 * @returns **`warehouseRows`**
 */
export async function getWarehouseRows(): Promise<WarehouseRow[]> {
    if (!warehouseRows) {
        warehouseRows = (await getWarehouseData()).rows;
    }
    return warehouseRows;
}

/**
 * `async`
 * @returns **`warehouseDictionary`**
 */
export async function getWarehouseDictionary(): Promise<WarehouseDictionary> {
    if (!warehouseDictionary) {
        warehouseDictionary = (await getWarehouseData()).dictionary;
    }
    return warehouseDictionary;
}

/**
 * `async`
 * @returns **`warehouseData`** 
 */
export async function getWarehouseData(): Promise<WarehouseData> {
    if (!warehouseData) {
        warehouseData =  await loadWarehouseData();
    }
    return warehouseData;
}

/**
 * `async`
 * @returns **`entityValueOverrides`** `Promise<Record<string, string>>`
 */
export async function getEntityValueOverrides(): Promise<Record<string, string>> {
    if (!entityValueOverrides) {
        entityValueOverrides = await loadEntityValueOverrides();
    }
    return entityValueOverrides;
}
/**
 * `async`
 * @returns **`customerData`** 
 */
export async function getCustomerData(): Promise<CustomerData> {
    if (!customerData) {
        customerData =  await loadCustomerData();
    }
    return customerData;
}

export async function getCustomerCategoryDictionary(): Promise<{[category: string]: number}> {
    if (!customerCategoryDictionary) {
        customerCategoryDictionary = (await getCustomerData()).categoryDictionary;
    }
    return customerCategoryDictionary;
}

/**
 * `async`
 * @returns **`customerData`** 
 */
export async function getVendorData(): Promise<VendorData> {
    if (!vendorData) {
        vendorData =  await loadVendorData();
    }
    return vendorData;
}

export async function getHumanVendorList(): Promise<string[]> {
    if (!humanVendorList) {
        humanVendorList = (await getVendorData()).humanVendors;
    }
    return humanVendorList;
}

/**
 * `async`
 * `Public API`: Gets the internal ID for a given SKU.
 * - Initializes the dictionary if it hasn't been loaded yet.
 * 
 * @param sku `string` - The SKU to look up
 * @returns Promise that resolves to the internal ID, or undefined if not found
 */
export async function getInternalIdForSku(sku: string): Promise<string | undefined> {
    const dictionary = await getSkuDictionary();
    return dictionary[sku];
}

/**
 * `async`
 * `Public API`: Checks if a SKU exists in the dictionary.
 * - Initializes the dictionary if it hasn't been loaded yet.
 * 
 * @param sku `string` - The SKU to check
 * @returns Promise that resolves to true if the SKU exists, false otherwise
 */
export async function hasSkuInDictionary(sku: string): Promise<boolean> {
    const dictionary = await getSkuDictionary();
    return sku in dictionary;
}

/**
 * `sync`
 * `Public API`: Gets a synchronous version of the SKU dictionary.
 * - Returns null if the dictionary hasn't been loaded yet.
 * - Use this **only** when you're sure the dictionary has already been initialized.
 * 
 * @returns The SKU dictionary or null if not loaded
 */
export function getSkuDictionarySync(): Record<string, string> | null {
    return skuDictionary;
}

/**
 * `sync`
 * `Public API`: Clears the SKU dictionary cache.
 * - Useful for testing or when you need to force a reload of the dictionary.
 * - The next call to any SKU dictionary function will reload the data.
 */
export function clearSkuDictionaryCache(): void {
    skuDictionary = null;
    mlog.debug('[clearSkuDictionaryCache()] SKU dictionary cache cleared');
}

