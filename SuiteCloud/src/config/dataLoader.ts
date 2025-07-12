/**
 * @file src/config/dataLoader.ts
 * @description Centralized data loading to avoid circular dependencies 
 * and ensure proper initialization order
 */
import { DATA_DIR, STOP_RUNNING } from "./env";
import { mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "./setupLog";
import { readJsonFileAsObject as read, isValidCsv, getCsvRows, getOneToOneDictionary } from "../utils/io/reading";
import { writeObjectToJson as write } from "../utils/io/writing";
import { hasNonTrivialKeys, isNonEmptyArray, isNullLike as isNull, isNonEmptyString as isNonEmptyString } from "../utils/typeValidation";
import * as validate from "../utils/argumentValidation"
import path from "node:path";

// Global state to track if data has been loaded
let dataInitialized = false;
let regexConstants: RegexConstants | null = null;

/** `DATA_DIR/items/SKU_TO_INTERNAL_ID_DICT.json` */
const SKU_DICTIONARY_FILE = path.join(DATA_DIR, 'items', 'SKU_TO_INTERNAL_ID_DICT.json');
/** `DATA_DIR/uploaded/inventory_item.tsv` */
const INVENTORY_ITEM_FILE = path.join(DATA_DIR, 'uploaded', 'inventory_item.tsv');

// SKU dictionary cache
let skuDictionary: Record<string, string> | null = null;

const regexFileName = `regex_constants.json`;
const regexFilePath = path.join(DATA_DIR, '.constants', regexFileName);

/**
 * @interface **`RegexConstants`**
 * @property **`COMPANY_KEYWORD_LIST`** `string[]` - List of keywords to identify company names
 * @property **`JOB_TITLE_SUFFIX_LIST`** `string[]` - List of common job title suffixes
 */
export interface RegexConstants {
    COMPANY_KEYWORD_LIST: string[];
    JOB_TITLE_SUFFIX_LIST: string[];
}

/**
 * Initialize all data required by the application.
 * This should be called once at the start of the application.
 * 
 * Calls the following functions in the listed order:
 * - {@link loadRegexConstants}`(regexFilePath)`
 * - {@link loadSkuDictionary}`(jsonPath?: string, csvPath?: string, skuColumn?: string, internalIdColumn?: string)`
 */
export async function initializeData(): Promise<void> {
    if (dataInitialized) {
        mlog.info('[initializeData()] Data already initialized, skipping...');
        return;
    }
    mlog.info('[initializeData()] Initializing application data...');

    try {
        // Load regex constants
        regexConstants = await loadRegexConstants(regexFilePath);
        // Load SKU dictionary
        skuDictionary = await loadSkuDictionary();
        dataInitialized = true;
        mlog.info('[initializeData()] ✓ All data initialized successfully');
    } catch (error) {
        mlog.error('[initializeData()] ✗ Failed to initialize data:', error);
        STOP_RUNNING(1, 'Data initialization failed');
    }
}

/**
 * Load regex constants
 * @param filePath `string` - Path to the regex constants JSON file
 * @returns **`regexConstants`** {@link RegexConstants}
 */
async function loadRegexConstants(filePath: string): Promise<RegexConstants> {
    mlog.info('[loadRegexConstants()] Loading regex constants...');
    validate.existingFileArgument('loadRegexConstants','filePath', filePath);

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

    mlog.info('[loadRegexConstants()] ✓ Regex constants loaded successfully');

    return {
        COMPANY_KEYWORD_LIST,
        JOB_TITLE_SUFFIX_LIST,
    };
}


/**
 * Load SKU dictionary from JSON or CSV
 */
async function loadSkuDictionary(
    jsonPath: string = SKU_DICTIONARY_FILE,
    csvPath: string = INVENTORY_ITEM_FILE, 
    skuColumn: string = 'Name',
    internalIdColumn: string = 'Internal ID'
): Promise<Record<string, string>> {
    validate.multipleStringArguments(
        `loadSkuDictionary`, 
        {jsonPath, csvPath, skuColumn, internalIdColumn}
    )
    // 1. Try to load from JSON file first
    try {
        const jsonData = read(jsonPath);
        if (jsonData && hasNonTrivialKeys(jsonData.SKU_TO_INTERNAL_ID_DICT)) {
            mlog.debug(`[loadSkuDictionary()] Loaded SKU dictionary from JSON: ${Object.keys(jsonData.SKU_TO_INTERNAL_ID_DICT).length} entries`);
            return jsonData.SKU_TO_INTERNAL_ID_DICT as Record<string, string>;
        }
    } catch (error) {
        mlog.warn(`[loadSkuDictionary()] Could not read JSON file, will try CSV: ${error}`);
    }
    
    // 2. Build dictionary from CSV file
    if (!isValidCsv(csvPath, [skuColumn, internalIdColumn])) {
        throw new Error(`[loadSkuDictionary()] No JSON data && Invalid CSV file: ${csvPath}`);
    }
    const itemRows = await getCsvRows(csvPath);
    if (itemRows.length === 0) { 
        throw new Error(`[loadSkuDictionary()] No data in CSV file: ${csvPath}`); 
    }
    const dictionary = await getOneToOneDictionary(itemRows, skuColumn, internalIdColumn);
    if (!hasNonTrivialKeys(dictionary)) {
        throw new Error(`[loadSkuDictionary()] No valid data found in CSV file: ${csvPath}`);
    }
    // 3. Cache the dictionary to JSON for future use
    try {
        write({ SKU_TO_INTERNAL_ID_DICT: dictionary }, jsonPath);
        mlog.debug(`[loadSkuDictionary()] Built and cached SKU dictionary: ${Object.keys(dictionary).length} entries`);
    } catch (error) {
        mlog.warn(`[loadSkuDictionary()] Could not write to JSON cache: ${error}`);
    }

    return dictionary;
}

/**
 * Get regex constants
 * @returns **`regexConstants`** {@link RegexConstants}
 */
export function getRegexConstants(): RegexConstants {
    if (!dataInitialized || !regexConstants) {
        throw new Error('[getRegexConstants()] Regex constants not initialized. Call initializeData() first.');
    }
    return regexConstants;
}

/**
 * Get company keyword list
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
 * Check if data has been initialized
 * @returns **`dataInitialized`** `boolean`
 */
export function isDataInitialized(): boolean {
    return dataInitialized;
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

