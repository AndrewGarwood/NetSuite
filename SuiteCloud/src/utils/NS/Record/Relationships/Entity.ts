/**
 * @file src/utils/ns/record/relationships/Entity.ts
 * maybe rename to ClientEntity.ts or BusinessEntity.ts because apparently there is 
 * a NetSuite Entity record type
 */
import { Relationship, RelationshipSublists } from "./Relationship";
import { RadioFieldBoolean } from "../../../typeValidation";
import { CustomerCategoryEnum } from "./Customer";
import { RecordRef } from "../Record";
import { AddressBook, AddressBookEntry, Address } from "./Address";

/**
 * Intersection of `['customer', 'vendor', 'partner', 'lead', 'prospect']` fieldIds:
 * @interface **`Entity`**
 * @keys 
 * - `[ 'companyname', 'isperson', 'contact', 'parent', 'category', 
 * 'altemail', 'url', 'printoncheckas', 'vatregnumber', 'taxfractionunit', 
 * 'taxrounding' ]`
 * @extends {Relationship} 
 * **{@link Relationship}**`.keys()` = `[
 * 'email', 'datecreated','entityid', 'externalid', 'internalid',
 * 'firstname', 'title', 'salutation', 'isinactive', 'homephone', 'mobilephone', 'fax', 
 * 'phone', 'lastname', 'comments', 'subsidiary','middlename', 'globalsubscriptionstatus'
 * ]`
 */
export interface Entity extends Relationship {
    [key: string]: any; // temporarily Allow arbitrary additional properties
    companyname?: string;
    isperson?: RadioFieldBoolean;
    /** if `isperson` == `'F'`, then there can exist a contact record associated with the Entity */
    contact?: string | RecordRef;
    parent?: string | RecordRef;
    /** 
     * probably exists different cateogry sets for each entity type, 
     * e.g. {@link CustomerCategoryEnum} 
     * */
    category?: string | RecordRef | CustomerCategoryEnum;
    altemail?: string;
    /**@label `'Website'` */
    url?: string;
    printoncheckas?: string;
    /**@label `'Tax Reg. Number'` */
    vatregnumber?: string;
    /**@label `'Tax Rounding Precision'` */
    taxfractionunit?: string | RecordRef;
    /**@label `'Tax Rounding Method'` */
    taxrounding?: string | RecordRef;
}

/**
 * @interface **`EntitySublists`** `extends` {@link RelationshipSublists}
 * @property {AddressBook} [addressbook] - **`addressbook`** sublist for the relationship entity/contact.
 * - {@link AddressBook} = {@link AddressBookEntry}`[]` 
 * - = `{ addressbookaddress?: `{@link Address}`, addressid?: string, defaultbilling?: boolean, defaultshipping?: boolean, internalid?: number, label?: string}[]`
 * @property {never[]} [contactroles] - **`contactroles`**  sublist for the entity. 
 * - This is a static, readonly sublist and is not implemented in this definition.
 * */
export interface EntitySublists extends RelationshipSublists {
    /**
     * @notimplemented
     * @readonly
     * @label "Contacts"
     * @description contact sublist for the customer.
     * */
    contactroles?: never[];
}