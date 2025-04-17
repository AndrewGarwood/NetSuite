/**
 * @file BillOfMaterialsRevisionComponent.ts
 * @description TypeScript definition for the Bill of Materials Revision Component record in NetSuite.
 * @module BillOfMaterialsRevisionComponent
 */
import { RecordRef } from './Record';
import { ItemSourceEnum, UnitsEnum } from './Enums';

/**
 * @reference https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/bomrevision.html
 * @description Revision Components  belong to one Bill of Materials (BOM) Revision. A BOM Revision Component cannot exist without a BOM Revision. In NetSuite UI it’s represented as a Component sublist. The Advanced Bill of Materials feature must be enabled.
 * @interface BillOfMaterialsRevisionComponent
 * @property {RecordRef} item - ({@link RecordRef}) A reference to the component's associated Inventory Item record's internalId, externalId, or "Item Name/Number" field.
 * @property {number} quantity - The quantity of the component.
 * @property {RecordRef | UnitsEnum} [unit] - ({@link RecordRef} | {@link UnitsEnum}) A reference to the unit of measure for the component or a specific unit type.
 * @property {number} [linenumber] - The sublist index (line number) of the component in the bill of materials.
 * @property {number} [internalid] - The internal ID of the component. 
 * @property {number} [bomquantity] - (optional) The quantity of the component in the bill of materials.
 * @property {number} [componentyield] - (optional) The yield percentage of the component.
 * @property {string} [description] - The description of the component.
 * @property {ItemSourceEnum} [itemSource] - ({@link ItemSourceEnum}) The source of the item (e.g., stock, phantom, work order, purchase order).
 */
export interface BillOfMaterialsRevisionComponent  {
    item: RecordRef;
    quantity: number;
    unit?: RecordRef | UnitsEnum;
    linenumber?: number;
    internalid?: number;
    bomquantity?: number;
    componentyield?: number;
    description?: string;
    itemsource?: ItemSourceEnum;
}