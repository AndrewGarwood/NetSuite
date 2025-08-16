/**
 * @file src/parse_configurations/item/itemConstants.ts
 */
import path from "node:path";
import { DATA_DIR } from "../../config";

/** `${DATA_DIR}/items` */
export const ITEM_DIR = path.join(DATA_DIR, 'items');
/** `${DATA_DIR}/items/missingItems.tsv` */
export const MISSING_ITEMS_FILE = path.join(ITEM_DIR, 'missingItems.tsv');
/** `${DATA_DIR}/items/service_items_copy.tsv` */
export const SERVICE_ITEM_FILE = path.join(ITEM_DIR, 'service_items_copy.tsv');

export enum ItemColumnEnum {
    ITEM_ID = 'Item',
    ACTIVE_STATUS = 'Active Status',
    ACCOUNT = 'Account',
    ASSET_ACCOUNT = 'Asset Account',
    COGS_ACCOUNT = 'COGS Account',
    DESCRIPTION = 'Description',
    PURCHASE_DESCRIPTION = 'Purchase Description',
    COST = 'Cost',
    PRICE = 'Price',
    PREFERRED_VENDOR = 'Preferred Vendor',
    MPN = 'MPN',
    LOT_NUMBER = 'Lot Number'
}

const ITEM_COLUMNS = [
    'Active Status',
    'Type',
    'Item',
    'Description',
    'Sales Tax Code',
    'Account',
    'COGS Account',
    'Asset Account',
    'Accumulated Depreciation',
    'Purchase Description',
    'Quantity On Hand',
    'U/M',
    'U/M Set',
    'Cost',
    'Preferred Vendor',
    'Tax Agency',
    'Price',
    'Reorder Pt (Min)',
    'MPN',
    'Lot Number',
    'Lead Time'
];