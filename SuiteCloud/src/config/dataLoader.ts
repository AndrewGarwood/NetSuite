/**
 * @file src/config/dataLoader.ts
 * @description Centralized data loading to avoid circular dependencies 
 * and ensure proper initialization order
 */
import { DATA_DIR, STOP_RUNNING } from "./env";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, INFO_LOGS as INFO } from "./setupLog";
import { readJsonFileAsObject as read, isValidCsv, getCsvRows, getOneToOneDictionary } from "../utils/io/reading";
import { writeObjectToJson as write } from "../utils/io";
import { hasNonTrivialKeys, isNonEmptyArray, isNullLike as isNull } from "../utils/typeValidation";
import * as validate from "../utils/argumentValidation"
import path from "node:path";
import { AccountTypeEnum, AccountDictionary } from "../utils/ns";

// Global state to track if data has been loaded
let dataInitialized = false;

/**
 * @enum {string} **`DataDomainEnum`**
 * @property **`REGEX`** = `'REGEX'`
 * @property **`INVENTORY`** = `'INVENTORY'`
 */
export enum DataDomainEnum {
    REGEX = 'REGEX',
    INVENTORY = 'INVENTORY',
}
/* ----------------------- LOAD INVENTORY CONFIG --------------------------- */
/** `DATA_DIR/items/SKU_TO_INTERNAL_ID_DICT.json` */
const SKU_DICTIONARY_FILE = path.join(DATA_DIR, 'items', 'SKU_TO_INTERNAL_ID_DICT.json');
/** `DATA_DIR/uploaded/inventory_item.tsv` */
const ITEM_FILE = path.join(DATA_DIR, 'items', 'sb_all_item_export.tsv');

let skuDictionary: Record<string, string> | null = null;
/** `DATA_DIR/accounts/accountDictionary.json` */
const ACCOUNT_DICTIONARY_FILE = path.join(DATA_DIR, 'accounts', 'accountDictionary.json');
/** map `account` to `'internalid'` */
let accountDictionary: Record<string, any> | null = null;


const CLASSES_FILE = path.join(DATA_DIR, '.constants', 'classes.tsv');
/** map `class` to `'internalid'` */
let classDictionary: Record<string, string> | null = null;


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
    DataDomainEnum.REGEX, 
    DataDomainEnum.INVENTORY,
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
    INFO.push(`${source} Initializing application data...`);
    try {
        for (const d of domains) {
            switch (d) {
                case DataDomainEnum.REGEX:
                    regexConstants = await loadRegexConstants();
                    break;
                case DataDomainEnum.INVENTORY:
                    skuDictionary = await loadSkuDictionary();
                    accountDictionary = await loadAccountDictionary();
                    classDictionary = await loadClassDictionary();
                    break;
                default:
                    mlog.warn(
                        `${source} Unrecognized data domain: '${d}'. Skipping...`
                    );
                    continue;
            }
        }
        dataInitialized = true;
        mlog.info(INFO.join(TAB), NL+`${source} ✓ All data initialized successfully`);
        INFO.length = 0;
    } catch (error) {
        mlog.error(`${source} ✗ Failed to initialize data:`, error);
        STOP_RUNNING(1, 'Data initialization failed');
    }
}



/**
 * - always load from csv
 * @consideration could try reading json first and compare if all keys are in 
 * dictionary from return value of `getOneToOneDictionary`
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
    validate.multipleStringArguments(
        `dataLoader.loadSkuDictionary`, 
        {jsonPath, csvPath, skuColumn, internalIdColumn}
    )
    
    if (lazyLoad) { // Try to load from JSON file first
        try {
            const jsonData = read(jsonPath);
            if (jsonData && hasNonTrivialKeys(jsonData.SKU_TO_INTERNAL_ID_DICT)) {
                INFO.push(`${source} Loaded SKU dictionary from JSON: ${Object.keys(jsonData.SKU_TO_INTERNAL_ID_DICT).length} entries`);
                return jsonData.SKU_TO_INTERNAL_ID_DICT as Record<string, string>;
            }
        } catch (error) {
            mlog.warn(`${source} Could not read JSON file, will try CSV: ${error}`);
        } 
    }
    
    // 2. Build dictionary from CSV file
    if (!isValidCsv(csvPath, [skuColumn, internalIdColumn])) {
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

/**
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

async function loadClassDictionary(
    csvPath: string=CLASSES_FILE,
    classColumn: string = 'Name',
    internalIdColumn: string = DEFAULT_INTERNAL_ID_COLUMN
): Promise<Record<string, string>> {
    // handled by isValidCsv() validate.existingFileArgument('dataLoader.loadClassDictionary', {csvPath});
    validate.multipleStringArguments('dataLoader.loadClassDictionary', 
        {classColumn, internalIdColumn}
    );
    if (!isValidCsv(csvPath, [classColumn, internalIdColumn])) {
        throw new Error(`[loadClassDictionary()] Invalid CSV file: '${csvPath}'`);
    }
    const dictionary = await getOneToOneDictionary(csvPath, classColumn, internalIdColumn);
    if (!hasNonTrivialKeys(dictionary)) { 
        throw new Error(`[loadClassDictionary()] No data in CSV file: '${csvPath}'`); 
    }
    return dictionary;
}

/**
 * Load regex constants
 * @param filePath `string` - Path to the regex constants JSON file (default: `REGEX_FILE`)
 * @returns **`regexConstants`** {@link RegexConstants}
 */
async function loadRegexConstants(
    filePath: string=REGEX_FILE
): Promise<RegexConstants> {
    validate.existingPathArgument('loadRegexConstants', {filePath});
    const REGEX_CONSTANTS = read(filePath) as Record<string, any>;
    if (!REGEX_CONSTANTS || !REGEX_CONSTANTS.hasOwnProperty('COMPANY_KEYWORD_LIST') || !REGEX_CONSTANTS.hasOwnProperty('JOB_TITLE_SUFFIX_LIST')) {
        throw new Error(`[loadRegexConstants()] Invalid REGEX_CONSTANTS file at '${filePath}'. Expected json object to have 'COMPANY_KEYWORD_LIST' and 'JOB_TITLE_SUFFIX_LIST' keys.`);
    }
    const COMPANY_KEYWORD_LIST: string[] = REGEX_CONSTANTS.COMPANY_KEYWORD_LIST || [];
    if (!isNonEmptyArray(COMPANY_KEYWORD_LIST)) {
        throw new Error(`[loadRegexConstants()] Invalid COMPANY_KEYWORD_LIST in REGEX_CONSTANTS file at '${filePath}'`);
    }
    const JOB_TITLE_SUFFIX_LIST: string[] = REGEX_CONSTANTS.JOB_TITLE_SUFFIX_LIST || [];
    if (!isNonEmptyArray(JOB_TITLE_SUFFIX_LIST)) {
        throw new Error(`[loadRegexConstants()] Invalid JOB_TITLE_SUFFIX_LIST in REGEX_CONSTANTS file at '${filePath}'`);
    }
    INFO.push(`[dataLoader.loadRegexConstants()] Loaded regex constants`,)
    return {
        COMPANY_KEYWORD_LIST,
        JOB_TITLE_SUFFIX_LIST,
    };
}
/**
 * `Sync` Get regex constants
 * @returns **`regexConstants`** {@link RegexConstants}
 */
export function getRegexConstants(): RegexConstants {
    if (!dataInitialized || !regexConstants) {
        throw new Error('[getRegexConstants()] Regex constants not initialized. Call initializeData() first.');
    }
    return regexConstants;
}

/**
 * `Sync` Get company keyword list
 * @returns **`COMPANY_KEYWORD_LIST`** `string[]`
 */
export function getCompanyKeywordList(): string[] {
    const constants = getRegexConstants();
    return constants.COMPANY_KEYWORD_LIST;
}

/**
 * Get job title suffix list
 * @returns **`JOB_TITLE_SUFFIX_LIST`** `string[]`
 */
export function getJobTitleSuffixList(): string[] {
    const constants = getRegexConstants();
    return constants.JOB_TITLE_SUFFIX_LIST;
}

/**
 * `Sync` Check if data has been initialized
 * @returns **`dataInitialized`** `boolean`
 */
export function isDataInitialized(): boolean {
    return dataInitialized;
}
/**
 * `Public API`: Gets the {@link AccountDictionary} = `{ [accountType: string]: Record<string, string> }` 
 * - = `{ [accountType: string]: { [accountName: string]: string } }` 
 * - - accountName mapped to internalid
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
 * `Public API`: Gets the Class name to Internal ID dictionary from {@link CLASSES_FILE}
 * - Initializes the dictionary if it hasn't been loaded yet.
 * @returns Promise that resolves to the Class dictionary
 */
export async function getClassDictionary(): Promise<Record<string, string>> {
    if (!classDictionary) {
        classDictionary = await loadClassDictionary();
    }
    return classDictionary;
}

/**
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
 * `Public API`: Clears the SKU dictionary cache.
 * - Useful for testing or when you need to force a reload of the dictionary.
 * - The next call to any SKU dictionary function will reload the data.
 */
export function clearSkuDictionaryCache(): void {
    skuDictionary = null;
    mlog.debug('[clearSkuDictionaryCache()] SKU dictionary cache cleared');
}

