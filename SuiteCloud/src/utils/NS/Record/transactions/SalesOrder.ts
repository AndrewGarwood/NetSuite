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


/**
 * @interface **`SalesOrderBase`**
 */
export interface SalesOrderBase {
    [key: string]: any; // temporarily Allow arbitrary additional properties
    /**@label `Customer` */
    entity: RecordRef;
    /**@label `Date` */
    trandate: Date | string;
    /**@label `Status` */
    orderstatus: string | number | SalesOrderStatusEnum;
    billaddress?: RecordRef;
    shipaddress?: RecordRef;
}

/**
 * @interface **`SalesOrderSublists`**
 */
export interface SalesOrderSublists {
    /**@label 'Items' */
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