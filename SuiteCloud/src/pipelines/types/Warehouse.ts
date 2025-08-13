/**
 * @file src/pipelines/types/Warehouse.ts
 */

/**
 * @keys `number` = `internalid` of location 
 * as specified in `Setup > Company > Classifcations : Locations`
 * @values {@link WarehouseBin}
 */
export type WarehouseDictionary = {
    [locationId: number]: WarehouseBin
}  

export type BinContent = {
    [itemId: string]: {
        description: string,
        lotNumbers: string[],
    }
}

export type WarehouseBin = {
    [binId: string]: BinContent
}