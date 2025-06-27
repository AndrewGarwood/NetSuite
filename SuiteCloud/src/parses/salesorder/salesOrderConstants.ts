/**
 * @file src/parses/salesorder/salesOrderConstants.ts
 */

import { DATA_DIR } from "../../config";

/** `${DATA_DIR}/salesorders` */
export const SALES_ORDER_DIR = `${DATA_DIR}/salesorders` as string;
/*
Trans #	Type	Date	Num	Source Name	Name Address	Name Street1	Name Street2	Name City	Name State	Name Zip	Name Contact	Name Phone #	Name Fax #	Name E-Mail	Name Account #	Memo	P. O. #	Name	Ship Date	Deliv Date	Item	Account	Class	Rep	Billing Status	Qty	Sales Price	Amount	S. O. #	Lot Number	Paid Date	Ship To City	Ship To Address 1	Ship To Address 2	Ship To State	Ship Zip	Check #
317505	Invoice	10/24/2024	24-30376	Aloha Aesthetics	Stacey Idica 673 Silver Bluff Road Aiken, SC 29803	Stacey Idica	673 Silver Bluff Road	Aiken	SC	29803		941-276-7001		stacey.bullfinch@gmail.com		Miracu Thread Forte Fix 10 units  (18GX100mm)	15979	Aloha Aesthetics	10/24/2024		Miracu:3FX18101802GA (Miracu Thread Forte Fix 10 units  (18GX100mm))	PDO Thread	Benev:Domestic	CE		5	374.00	1870.00	334854	2026/04/29-X81441G		Aiken	Aloha Aesthetics	Attn: Stacey Idica	SC	29803	

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
 * @enum {string} **`SalesOrderColumnEnum`**
 */
export enum SalesOrderColumnEnum {
    /**use as customer/contact entityid */
    ENTITY_ID = 'Source Name', // 
    TRAN_ID = 'S. O. #',// 'Trans #',
    TRAN_TYPE = 'Type',
    TRAN_DATE = 'Date',
    START_DATE = 'Date',
    SHIP_DATE = 'Ship Date',
    END_DATE = 'Due Date',
    PO_NUMBER = 'P. O. #',
    INVOICE_NUMBER = 'Num',
    TERMS = 'Terms',
    ITEM = 'Item',
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
    SHIP_TO_ZIP = 'Ship To Zip',
    SHIP_TO_COUNTRY = 'Ship To Country',
}
