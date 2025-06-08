/**
 * @file BillOfMaterialsRevision.ts
 */
import { RecordRef } from '../Record';
import { BillOfMaterialsRevisionComponent } from './BillOfMaterialsRevisionComponent';

/**
 * @interface BillOfMaterialsRevision
 * @description Bill of Materials Revision record in NetSuite. A BOM Revision contains component items that are assembled to create another item. The Advanced Bill of Materials feature must be enabled.
 * @property {RecordRef} [billofmaterial] - ({@link RecordRef}) A reference to the Bill of Materials record.
 * @property {Date} [createddate] - The date this Bill of Materials was created.
 * @property {Date} [effectivedate] - Effective Start Date of the BOM Revision. (Defaults to created date if not specified.)
 * @property {string} [externalid] - External identifier for the BOM Revision.
 * @property {boolean} [isinactive] - If true, this BOM or BOM revision does not appear in search lists on records and forms.
 * @property {string} [memo] - Additional information about this BOM.
 * @property {string} name - A unique and descriptive Bill of Materials (BOM) or BOM revision Name. For example, "Grill BOM" or "BOM Revision 1".
 * @property {Date} [obsoletedate] - Effective End Date of the BOM Revision.
 * @property {Array<BillOfMaterialsRevisionComponent>} [components] - (Array<{@link BillOfMaterialsRevisionComponent}>) The component items that make up this BOM Revision.
 */
export interface BillOfMaterialsRevision  {
    billofmaterial?: RecordRef;
    createddate?: Date;
    effectivedate?: Date;
    externalid?: string;
    isinactive?: boolean;
    memo?: string;
    name: string;
    obsoletedate?: Date;
    components?: Array<BillOfMaterialsRevisionComponent>;
}

/*
Internal ID	Type	nlapiSubmitField	Label	Required	Help
billofmaterial	select	false	Bill of Materials	false	
createddate	date	false	Date Created	false	The date this Bill of Materials was created.
effectivedate	date	false	Effective Start Date	true	
externalid	text	false	ExternalId	false	
isinactive	checkbox	false	Inactive	false	Check the Inactive box if you do not want this BOM or BOM revision to appear in search lists on records and forms. Clear this box if you want this BOM or BOM revision to appear in lists.
memo	text	false	Memo	false	Optionally, in the Memo field, enter any information you want to include with this BOM.
name	text	false	Name	true	Enter a unique and descriptive Bill of Materials (BOM) or BOM revision Name. For example, Grill BOM or BOM Revision 1.
obsoletedate	date	false	Effective End Date	false

https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/bomrevision.html
*/