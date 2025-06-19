/**
 * @file src/parses/salesorder/salesOrderConstants.ts
 */

import { DATA_DIR } from "../../config";

/** `${DATA_DIR}/salesorders` */
export const SALES_ORDER_DIR = `${DATA_DIR}/salesorders` as string;

const SALES_ORDER_CSV_COLUMNS = [
    'Trans #', 'S. O. #', 'P. O. #', 'Num',
    'Type', 
    'Date', 
    
    'Source Name', 'Name',
    
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
 * @enum {string} **`SalesOrderColumnEnum`**
 */
export enum SalesOrderColumnEnum {
    TRAN_ID = 'Trans #',
    TRAN_DATE = 'Date',
    SHIP_DATE = 'Ship Date',
    OTHER_REF_NUM = 'P. O. #',
    ENTITY = 'Source Name', // use as customer/contact entityid
}

/** 
 * @enum {string} **`CustomerColumnEnum`**
 * */
export enum SalesOrderCustomerColumnEnum {
    ENTITY_ID = 'Source Name',
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
    SHIP_TO_ZIP = 'Ship To Zip',
    SHIP_TO_COUNTRY = 'Ship To Country',
}
