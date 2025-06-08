/**
 * @file ServiceItem.ts
 */

import { UnitsTypeEnum, UnitsEnum } from "../../Enums";




export interface ServiceItem  {
    itemid: string;
    taxschedule: string;
    incomeaccount: string;
    displayname?: string;
    externalid?: string;
    internalid?: string;
    parent?: string; // Subitem of {parent}
    class?: string;
    department?: string;
    salesdescription?: string; // 999 character limit
    unitstype?: UnitsTypeEnum;
    consumptionunit?: UnitsEnum;
    purchaseunit?: UnitsEnum;
    saleunit?: UnitsEnum;
    isinactive?: boolean;
}
