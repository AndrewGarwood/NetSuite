/**
 * @notimplemented
 * @file Account.ts
 */

import { RecordRef } from "../Record";

/**
 * @description enum for values in the 'Type' column on the `Lists > Accounting > Accounts` page in NetSuite
 * @enum {string} **`AccountTypeEnum`**
 * @property **`EQUIITY`** `'Equity'`
 * @property **`INCOME`** `'Income'`
 * @property **`EXPENSE`** `'Expense'`
 * @property **`NON_POSTING`** `'Non Posting'`
 * @property **`ACCOUNTS_PAYABLE`** `'Accounts Payable'`
 * @property **`OTHER_CURRENT_LIABILITY`** `'Other Current Liability'`
 * @property **`OTHER_CURRENT_ASSET`** `'Other Current Asset'`
 * @property **`ACCOUNTS_RECEIVABLE`** `'Accounts Receivable'`
 * @property **`COST_OF_GOODS_SOLD`** `'Cost of Goods Sold
 * @property **`LONG_TERM_LIABILITY`** `'Long Term Liability'`
 * @property **`OTHER_INCOME`** `'Other Income'`
 * @property **`OTHER_EXPENSE`** `'Other Expense'`
 * @property **`BANK`** `'Bank'`
 * @property **`FIXED_ASSET`** `'Fixed Asset'`
 * @property **`OTHER_ASSET`** `'Other Asset'`
 * @property **`CREDIT_CARD`** `'Credit Card'`
 */
export enum AccountTypeEnum {
    EQUITY = 'Equity',
    INCOME = 'Income',
    EXPENSE = 'Expense',
    NON_POSTING = 'Non Posting',
    ACCOUNTS_PAYABLE = 'Accounts Payable',
    OTHER_CURRENT_LIABILITY = 'Other Current Liability',
    OTHER_CURRENT_ASSET = 'Other Current Asset',
    ACCOUNTS_RECEIVABLE = 'Accounts Receivable',
    COST_OF_GOODS_SOLD = 'Cost of Goods Sold',
    LONG_TERM_LIABILITY = 'Long Term Liability',
    OTHER_INCOME = 'Other Income',
    OTHER_EXPENSE = 'Other Expense',
    BANK = 'Bank',
    FIXED_ASSET = 'Fixed Asset',
    OTHER_ASSET = 'Other Asset',
    CREDIT_CARD = 'Credit Card'
}

export type AccountDictionary = {
    [K in AccountTypeEnum]?: {
        [accountName: string]: string
    }
}

export type AccountingBookDetail = {
    accountingbook?: RecordRef;
    amortizationtemplate?: RecordRef;
}
