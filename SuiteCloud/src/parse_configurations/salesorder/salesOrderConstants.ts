/**
 * @file src/parse_configurations/salesorder/salesOrderConstants.ts
 */

import { anyNull, hasNonTrivialKeys, isNullLike as isNull } from "src/utils/typeValidation";
import { STOP_RUNNING, DATA_DIR, CLOUD_LOG_DIR, mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL } from "../../config";
import { getCsvRows, getOneToOneDictionary, isValidCsv, readJsonFileAsObject as read } from "src/utils/io/reading";
import { writeObjectToJson as write } from "src/utils/io/writing";
import path from "node:path";
/** `${DATA_DIR}/salesorders` */
export const SALES_ORDER_DIR = `${DATA_DIR}/salesorders` as string;
/** `${CLOUD_LOG_DIR}/salesorders` */
export const SALES_ORDER_LOG_DIR = `${CLOUD_LOG_DIR}/salesorders` as string;
/** `${DATA_DIR}/salesorders/small_subset.tsv` */
export const SMALL_SUBSET_FILE = `${SALES_ORDER_DIR}/small_subset.tsv` as string;
/*
Trans #	Type	Date	Num	Source Name	Name Address	Name Street1	Name Street2	Name City	Name State	Name Zip	Name Contact	Name Phone #	Name Fax #	Name E-Mail	Name Account #	P. O. #	Ship Date	Due Date	Item	Item Description	Memo	Account	Terms	Class	Rep	Billing Status	Qty	Sales Price	Amount	S. O. #	Lot Number	Paid Date	Ship To City	Ship To Address 1	Ship To Address 2	Ship To State	Ship Zip	Check #

*/
const SALES_ORDER_CSV_COLUMNS = [
    'Trans #', 'S. O. #', 'P. O. #', 'Num',
    'Type', 
    'Date', 
    
    'Source Name', 'Terms',
    
    'Name Address', 
    'Name Street1', 
    'Name Street2', 
    'Name City', 'Name State', 'Name Zip',
    
    'Name Contact', 
    'Name Phone #', 'Name Fax #', 'Name E-Mail', 
    'Name Account #', 
    
    'Memo',  'Ship Date', 
    'Deliv Date', 'Item', 'Account', 'Class', 'Rep', 
    'Billing Status', 'Qty', 'Sales Price', 'Amount', 
    'Lot Number', 
    'Paid Date',
    
    'Ship To Address 1', 
    'Ship To Address 2', 
    'Ship To State', 'Ship To City', 'Ship Zip', 
    
    'Check #'
];

/**
 * @enum {string} **`SalesOrderColumnEnum`** `string`
 */
export enum SalesOrderColumnEnum {
    /**use as customer/contact entityid */
    ENTITY_ID = 'Source Name', // 
    TRAN_ID = 'S. O. #',// 'Trans #',
    TRAN_TYPE = 'Type',
    /** given the content of the tsv file, I think this is the date of the invoice */
    TRAN_DATE = 'Date',
    START_DATE = 'Date',
    SHIP_DATE = 'Ship Date',
    END_DATE = 'Due Date',
    PO_NUMBER = 'P. O. #',
    INVOICE_NUMBER = 'Num',
    TERMS = 'Terms',
    ITEM = 'Item',
    ITEM_DESCRIPTION = 'Item Description',
    ITEM_MEMO = 'Memo',
    QUANTITY = 'Qty',
    RATE = 'Sales Price',
    AMOUNT = 'Amount',
    CHECK_NUMBER = 'Check #',
    PRIMARY_CONTACT = 'Name Contact',
    PHONE = 'Name Phone #',
    FAX = 'Name Fax #',
    EMAIL = 'Name Email',
    ACCOUNT_NUMBER = 'Name Account #',
    STREET_ONE = 'Name Street1',
    STREET_TWO = 'Name Street2',
    CITY = 'Name City',
    STATE = 'Name State',
    ZIP = 'Name Zip',
    COUNTRY = 'Name Country',
    SHIP_TO_STREET_ONE = 'Ship To Address 1',
    SHIP_TO_STREET_TWO = 'Ship To Address 2',
    SHIP_TO_CITY = 'Ship To City',
    SHIP_TO_STATE = 'Ship To State',
    SHIP_TO_ZIP = 'Ship Zip',
    SHIP_TO_COUNTRY = 'Ship To Country',
}
const SKU_DICTIONARY_FILE = path.join(DATA_DIR, 'items', 'SKU_TO_INTERNAL_ID_DICT.json');
const INVENTORY_ITEM_FILE = path.join(DATA_DIR, 'uploaded', 'inventory_item.tsv');

// Cache for the SKU dictionary - will be populated lazily
let skuDictionaryCache: Record<string, string> | null = null;
let skuDictionaryPromise: Promise<Record<string, string>> | null = null;
/**
 * Gets or initializes the SKU to Internal ID dictionary.
 * This function ensures the dictionary is loaded only once and cached for subsequent calls.
 * 
 * @param jsonPath - Path to the JSON file containing the cached dictionary
 * @param csvPath - Path to the CSV file to build the dictionary from if JSON doesn't exist
 * @param skuColumn - Column name for SKU in the CSV file
 * @param internalIdColumn - Column name for Internal ID in the CSV file
 * @returns Promise that resolves to the SKU dictionary
 */
async function instantiateSkuDictionary(
    jsonPath: string = SKU_DICTIONARY_FILE,
    csvPath: string = INVENTORY_ITEM_FILE, 
    skuColumn: string = 'Name',
    internalIdColumn: string = 'Internal ID'
): Promise<Record<string, string>> {
    // Return cached dictionary if already loaded
    if (skuDictionaryCache) {
        return skuDictionaryCache;
    }

    // Return existing promise if already in progress
    if (skuDictionaryPromise) {
        return skuDictionaryPromise;
    }

    // Start the loading process
    skuDictionaryPromise = loadSkuDictionary(jsonPath, csvPath, skuColumn, internalIdColumn);
    
    try {
        skuDictionaryCache = await skuDictionaryPromise;
        return skuDictionaryCache;
    } catch (error) {
        // Reset promise on error so we can retry
        skuDictionaryPromise = null;
        throw error;
    }
}

/**
 * Internal function to load the SKU dictionary from JSON or CSV
 */
async function loadSkuDictionary(
    jsonPath: string,
    csvPath: string,
    skuColumn: string,
    internalIdColumn: string
): Promise<Record<string, string>> {
    if (isNull(jsonPath)) {
        mlog.error(`[loadSkuDictionary()] Unable to get or instantiate SkuDictionary: Invalid path(s).`,
            TAB + `jsonPath: '${jsonPath}'`
        );
        throw new Error(`[loadSkuDictionary()] Unable to get or instantiate SkuDictionary.`);
    }

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
    if (anyNull(skuColumn, internalIdColumn) || !isValidCsv(csvPath, [skuColumn, internalIdColumn])) {
        throw new Error(`[loadSkuDictionary()] No JSON data && Invalid CSV file: ${csvPath}`);
    }

    const itemRows = await getCsvRows(csvPath);
    if (itemRows.length === 0) { 
        throw new Error(`[loadSkuDictionary()] No data in CSV file: ${csvPath}`); 
    }

    const dictionary = getOneToOneDictionary(itemRows, skuColumn, internalIdColumn);
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
 * Public API: Gets the SKU to Internal ID dictionary.
 * Initializes the dictionary if it hasn't been loaded yet.
 * 
 * @returns Promise that resolves to the SKU dictionary
 */
export async function getSkuDictionary(): Promise<Record<string, string>> {
    return instantiateSkuDictionary();
}

/**
 * Public API: Gets the internal ID for a given SKU.
 * Initializes the dictionary if it hasn't been loaded yet.
 * 
 * @param sku - The SKU to look up
 * @returns Promise that resolves to the internal ID, or undefined if not found
 */
export async function getInternalIdForSku(sku: string): Promise<string | undefined> {
    const dictionary = await getSkuDictionary();
    return dictionary[sku];
}

/**
 * Public API: Checks if a SKU exists in the dictionary.
 * Initializes the dictionary if it hasn't been loaded yet.
 * 
 * @param sku - The SKU to check
 * @returns Promise that resolves to true if the SKU exists, false otherwise
 */
export async function hasSkuInDictionary(sku: string): Promise<boolean> {
    const dictionary = await getSkuDictionary();
    return sku in dictionary;
}

/**
 * Public API: Gets a synchronous version of the SKU dictionary.
 * Returns null if the dictionary hasn't been loaded yet.
 * Use this only when you're sure the dictionary has already been initialized.
 * 
 * @returns The SKU dictionary or null if not loaded
 */
export function getSkuDictionarySync(): Record<string, string> | null {
    return skuDictionaryCache;
}