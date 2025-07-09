/**
 * @file src/utils/ns/record/transactions/SalesOrder.ts
 */
import { RecordRef } from '../Record';
/**
 * @enum {string} **`SalesOrderStatusEnum`**
 * @property {string} PENDING_APPROVAL `'A'` - Represents a sales order that is pending approval.
 * @property {string} PENDING_FULFILLMENT `'B'` - Represents a sales order that is pending fulfillment.
 * @property {string} CANCELLED `'C'` - Represents a sales order that has been cancelled.
 * @property {string} PARTIALLY_FULFILLED `'D'` - Represents a sales order that has been partially fulfilled.
 * @property {string} PENDING_BILLING_PARTIALLY_FULFILLED `'E'` - Represents a sales order that is pending billing and/or has been partially fulfilled.
 * @property {string} PENDING_BILLING `'F'` - Represents a sales order that is pending billing.
 * @property {string} BILLED `'G'` - Represents a sales order that has been fully billed.
 * @property {string} CLOSED `'H'` - Represents a sales order that has been closed.
 */
export enum SalesOrderStatusEnum {
    PENDING_APPROVAL = 'A',
    PENDING_FULFILLMENT = 'B',
    CANCELLED = 'C',
    PARTIALLY_FULFILLED = 'D',
    PENDING_BILLING_PARTIALLY_FULFILLED = 'E',
    PENDING_BILLING = 'F',
    BILLED = 'G',
    CLOSED = 'H',
}

// custbody_ava_taxoverride?: boolean;
/**
 * @interface **`SalesOrderBase`**
 */
export interface SalesOrderBase {
    /**@label `Order #` */
    tranid: RecordRef;
    /**@label `Customer` */
    entity: RecordRef;
    /**@label `Date` the posting date of this sales order. */
    trandate: Date | string;
    /**
     * @label `Sales Effective Date	` The sales effective date determines 
     * which commission plan and historical sales team this transaction applies to. 
     * */
    saleseffectivedate?: Date | string;
    checknumber?: string;
    couponcode?: string;
    /**@label `Status` */
    orderstatus: string | number | SalesOrderStatusEnum;
    billaddress?: RecordRef;
    shipaddress?: RecordRef;
    /** computed by NetSuite */
    readonly total?: number;
    [key: string]: any; // for arbitrary additional properties or custom fields
}

/**
 * @interface **`SalesOrderSublists`**
 */
export interface SalesOrderSublists {
    /**
     * @label 'Items' 
     * @reference https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/salesorder.html#:~:text=false-,item,-%2D%20Items
     * */
    item: SalesItem[];
    accountingbookdetail ?: never[]; // not implemented
    salesteam?: never[]; // not implemented
    partners?: never[]; // not implemented
    promotions ?: never[]; // not implemented
    /**@label `Shipment` */
    shipgroup ?: never[]; // not implemented
    /**@label `Tax Detail` */
    taxdetails ?: never[]; // not implemented
}

export type SalesItem = {
    /**@label 'Item' */
    item: RecordRef;
    /**@label 'Quantity' */
    quantity: number;
    /**@label 'Rate' */
    rate?: number;
    /**@label 'Amount' */
    amount?: number;
};