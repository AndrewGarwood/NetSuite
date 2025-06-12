/**
 * @file src/utils/ns/record/relationships/Relationship.ts
 * Records that fall under the `Relationship` category in NetSuite. Lists > Relationships
 * - in particular: `['employee', 'customer', 'vendor', 'partner', 'contact', 'lead', 'prospect']`
 */

import { GlobalSubscriptionStatusEnum } from "../../Enums";
import { RecordRef } from "../Record";
import { AddressBook, AddressBookEntry } from "./Address";

/**
 * Intersection of `['employee', 'customer', 'vendor', 
 * 'partner', 'contact', 'lead', 'prospect']` record fieldIds.
 * @keys = `['email', 'datecreated','entityid', 'externalid', 'internalid',
 *  'firstname', 'title', 'salutation', 'isinactive', 'homephone', 'mobilephone', 'fax', 
 * 'phone', 'lastname', 'comments', 'subsidiary','middlename', 'globalsubscriptionstatus',]`
 * @interface **`Relationship`**
 * @property {string} [entityid] - Entity ID - The unique identifier for the relationship entity/contact.
 */
export interface Relationship {
    [key: string]: any; // temporarily Allow arbitrary additional properties
    entityid?: string;
    externalid?: string;
    internalid?: RecordRef;
    title?: string;
    salutation?: string;
    firstname?: string;
    middlename?: string;
    lastname?: string;
    /**@label `'Job Title'` */
    email?: string;
    /** {@link GlobalSubscriptionStatusEnum} */
    globalsubscriptionstatus?: GlobalSubscriptionStatusEnum;
    phone?: string;
    homephone?: string;
    mobilephone?: string;
    fax?: string;
    /**@label `'notes'` */
    comments?: string;
    subsidiary?: RecordRef;
    datecreated?: Date | string;
    isinactive?: boolean;
}

/**
 * @interface **`RelationshipSublists`**
 * @property {AddressBook | AddressBookEntry[]} [addressbook] - Address book sublist for the relationship entity/contact.
 * - {@link AddressBook} = {@link AddressBookEntry}`[]` 
 * - = `{ addressbookaddress?: `{@link Address}`, addressid?: string, defaultbilling?: boolean, defaultshipping?: boolean, internalid?: number, label?: string}[]`
 * */
export interface RelationshipSublists {
    /**
     * @label "Address Book"
     * @description Address book sublist for the relationship entity/contact.
     * */
    addressbook?: AddressBook | AddressBookEntry[];
}