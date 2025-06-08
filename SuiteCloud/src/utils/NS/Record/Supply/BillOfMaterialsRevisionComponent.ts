/**
 * @file BillOfMaterialsRevisionComponent.ts
 */

import { ItemSourceEnum, UnitsEnum } from "../../Enums";
import { RecordRef } from "../Record";

/**
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




/*
@reference https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/bomrevision.html
bomrevisioncomponent - Components
Internal ID	Type	Label	Required	Help
bomquantity	posfloat	BOM Quantity	false	
componentyield	percent	Component Yield	false	
description	textarea	Description	false	
internalid	integer	ID	false	
item	select	Item	true	
itemsource	select	Item Source	false	
itemsourcelist	text	Item Source options list	false	
linenumber	integer	Sequence	false	
quantity	posfloat	Quantity	true	
unit	select	Units	false	

*/
// @TODO: handle custom fields in the component
// import { CustomFieldList, CustomField } from './CustomField';
// customFieldList?: CustomFieldList;* @property {CustomFieldList} [customFieldList] - (optional) An Array<{@link CustomField}> associated with the component.