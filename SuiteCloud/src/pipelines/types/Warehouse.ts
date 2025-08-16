/**
 * @file src/pipelines/types/Warehouse.ts
 */

/**
 * @keys `number` = `internalid` of location 
 * as specified in `Setup > Company > Classifcations : Locations`
 * @values {@link WarehouseContent}
 */
export type WarehouseDictionary = {
    [locationId: number]: WarehouseContent
}  

export type BinContent = {
    [itemId: string]: {
        description: string,
        lotNumbers: string[],
    }
}

export type WarehouseContent = {
    [binId: string]: BinContent
}

export enum WarehouseColumnEnum {
    LOCATION_NAME= 'Location Name',
    LOCATION_INTERNAL_ID= 'Location Internal ID',
    BIN_NUMBER= 'Bin Number',
    BIN_INTERNAL_ID= 'Bin Internal ID',
    ITEM_ID= 'Item ID',
    ITEM_DESCRIPTION= 'Item Description',
    /** `'inventorynumber'` */
    LOT_NUMBER= 'Lot Number',
}

export type WarehouseRow = Record<WarehouseColumnEnum, any> | {
    [WarehouseColumnEnum.LOCATION_NAME]: string;
    [WarehouseColumnEnum.LOCATION_INTERNAL_ID]: number;
    [WarehouseColumnEnum.BIN_NUMBER]: string;
    [WarehouseColumnEnum.BIN_INTERNAL_ID]: number;
    [WarehouseColumnEnum.ITEM_ID]: string;
    [WarehouseColumnEnum.ITEM_DESCRIPTION]: string;
    [WarehouseColumnEnum.LOT_NUMBER]: string;
}
