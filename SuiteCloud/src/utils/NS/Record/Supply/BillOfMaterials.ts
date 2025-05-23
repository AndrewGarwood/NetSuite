/**
 * @file BillOfMaterials.ts
 * @description TypeScript definition for the Bill of Materials record in NetSuite.
 * @module BillOfMaterials
 */

import { RecordRef } from './Record';
import { BillOfMaterialsRevision } from './BillOfMaterialsRevision';

/**
 * Bill of Materials, Internal ID: bom
 * @reference https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/bom.html
 * @description Bill of Materials record in NetSuite. A Bill of Materials (BOM) defines the component items required to create an assembled item. The Advanced Bill of Materials feature must be enabled.
 * @interface BillOfMaterials
 * @property {boolean} [availableforallassemblies] - If true, all assemblies can use this BOM. If false, only selected assemblies can use this BOM.
 * @property {boolean} [availableforalllocations] - If true, all locations can use this BOM. If false, only selected locations can use this BOM.
 * @property {Date} [createddate] - The date this Bill of Materials was created.
 * @property {string} [externalid] - External identifier for the BOM.
 * @property {boolean} [includechildren] - If true, the BOM is available for all subsidiaries of the selected parent. When checked, the read-only usedonassembly field indicates the BOM is associated to an assembly.
 * @property {boolean} [isinactive] - If true, this BOM does not appear in search lists on records and forms.
 * @property {string} [memo] - Additional information about this BOM.
 * @property {string} name - A unique and descriptive Bill of Materials name. For example, "Grill BOM" or "BOM Revision 1".
 * @property {RecordRef[]} [restricttoassemblies] - ({@link RecordRef}[]) References to assemblies that can use this BOM. Only used when availableforallassemblies is false.
 * @property {RecordRef[]} [restricttolocations] - ({@link RecordRef}[]) References to locations that can use this BOM. Only used when availableforalllocations is false.
 * @property {RecordRef | RecordRef[]} [subsidiary] - ({@link RecordRef} | {@link RecordRef}[]) References to subsidiaries for which this BOM is available. Only applicable when using NetSuite OneWorld.
 * @property {boolean} [usecomponentyield] - If true, component yield is applied to all BOM revisions. Component yield is the percentage of the component that survives the manufacturing process.
 * @property {boolean} [usedonassembly] - indicates if the BOM is associated to an assembly.
 * @property {BillOfMaterialsRevision[]} [revisions] - ({@link BillOfMaterialsRevision}[]) The revisions associated with this Bill of Materials.
 */
export interface BillOfMaterials  {
    availableforallassemblies?: boolean;
    availableforalllocations?: boolean;
    createddate?: Date;
    externalid?: string;
    includechildren?: boolean;
    isinactive?: boolean;
    memo?: string;
    name: string;
    restricttoassemblies?: RecordRef[];
    restricttolocations?: RecordRef[];
    subsidiary?: RecordRef | RecordRef[];
    usecomponentyield?: boolean;
    usedonassembly?: boolean;
    revisions?: BillOfMaterialsRevision[];
}