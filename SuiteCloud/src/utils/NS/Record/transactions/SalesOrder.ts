/**
 * @file src/utils/ns/record/transactions/SalesOrder.ts
 */
import { RecordRef } from '../Record';
/**
 * @enum {string} **`SalesOrderStatusEnum`**
 * @property {string} PENDING_APPROVAL `'Pending Approval'` - Represents a sales order that is pending approval.
 * @property {string} PENDING_FULFILLMENT `'Pending Fulfillment'` - Represents a sales order that is pending fulfillment.
 */
export enum SalesOrderStatusEnum {
    PENDING_APPROVAL = 'Pending Approval',
    PENDING_FULFILLMENT = 'Pending Fulfillment',
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