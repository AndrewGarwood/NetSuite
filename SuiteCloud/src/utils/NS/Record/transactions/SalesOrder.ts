/**
 * @file src/utils/ns/record/transactions/SalesOrder.ts
 */

import { RecordRef } from "../Record";

/**
 * @enum {string} **`SalesOrderStatusEnum`**
 * @property {string} PENDING_APPROVAL `"Pending Approval"` - Represents a sales order that is pending approval.
 * @property {string} PENDING_FULFILLMENT `"Pending Fulfillment"` - Represents a sales order that is pending fulfillment.
 */
export enum SalesOrderStatusEnum {
    PENDING_APPROVAL = "Pending Approval",
    PENDING_FULFILLMENT = "Pending Fulfillment",
}


/**
 * @interface **`SalesOrderBase`**
 */
export interface SalesOrderBase {
    /**@label "Customer" */
    entity: RecordRef;
    /**@label "Date" */
    trandate: Date | string;
    /**@label "Status" */
    orderstatus: string | number | SalesOrderStatusEnum;
}