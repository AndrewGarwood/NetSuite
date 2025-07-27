/**
 * @notimplemented
 * @file Account.ts
 */

import { RecordRef } from "../Record";

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
    [K in keyof typeof AccountTypeEnum]?: {
        [accountName: string]: string
    }
}

export type AccountingBookDetail = {
    accountingbook?: RecordRef;
    amortizationtemplate?: RecordRef;
}
