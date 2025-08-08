/**
 * @file src/parse_configurations/salesorder/salesOrderConstants.ts
 */
import {
    DATA_DIR, CLOUD_LOG_DIR,
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL 
} from "../../config";
import path from "node:path";


/** `${DATA_DIR}/salesorders` */
export const SALES_ORDER_DIR = path.join(DATA_DIR, 'salesorders');
/** `${CLOUD_LOG_DIR}/salesorders` */
export const SALES_ORDER_LOG_DIR = path.join(CLOUD_LOG_DIR, 'salesorders');
/** `${DATA_DIR}/salesorders/small_subset.tsv` */
export const SUBSET_FILE = path.join(SALES_ORDER_DIR, 'subset.tsv');
/** `${DATA_DIR}/salesorders/small_subset.tsv` */
export const SMALL_SUBSET_FILE = path.join(SALES_ORDER_DIR, 'small_subset.tsv');
/** `${DATA_DIR}/salesorders/single_order.tsv` */
export const SINGLE_ORDER_FILE = path.join(SALES_ORDER_DIR, 'single_order.tsv');

/** `${DATA_DIR}/salesorders/viable` */
export const VIABLE_SO_DIR = path.join(SALES_ORDER_DIR, 'viable');
/** `${DATA_DIR}/salesorders/unviable` */
export const UNVIABLE_SO_DIR = path.join(SALES_ORDER_DIR, 'unviable');

const SALES_ORDER_COLUMNS = [
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
    SO_ID = 'S. O. #',// 'Trans #',
    TRAN_NUM = 'Trans #',// 'Trans #',
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
    /** concatenation of street1, street2, city, state, zip */
    NAME_ADDRESS = 'Name Address',
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