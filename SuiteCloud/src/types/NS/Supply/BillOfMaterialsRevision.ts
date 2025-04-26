/**
 * @file BillOfMaterialsRevision.ts
 * @description TypeScript definition for the Bill of Materials Revision record in NetSuite.
 * @module BillOfMaterialsRevision
 */
import { RecordRef } from './Record';
import { BillOfMaterialsRevisionComponent } from './BillOfMaterialsRevisionComponent';

/**
 * @interface BillOfMaterialsRevision
 * @reference https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/bomrevision.html
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