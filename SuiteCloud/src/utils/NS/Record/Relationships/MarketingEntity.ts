/**
 * @file src/utils/ns/record/relationships/MarketingEntity.ts
 * - for `['customer', 'lead', 'prospect']` record types
 */
import { Relationship, RelationshipSublists } from "./Relationship";
import { Entity, EntitySublists } from "./Entity";
import { RadioFieldBoolean } from "../../../typeValidation";
import { CustomerCategoryEnum, CustomerTaxItemEnum } from "./Customer";
import { RecordRef } from "../Record";
import { AddressBook, AddressBookEntry, Address } from "./Address";
import { LeadSourceEnum } from "./Lead";


/**
 * Intersection of `['customer', 'lead', 'prospect']` fieldIds
 * @interface **`MarketingEntity`**
 * @extends {Entity} 
 * **{@link Entity}**`.keys()` = `[ 'companyname', 'isperson', 'contact', 'parent', 'category', 
 * 'altemail', 'url', 'printoncheckas', 'vatregnumber', 'taxfractionunit', 
 * 'taxrounding' ]`
 * @extends {Relationship} 
 * **{@link Relationship}**`.keys()` = `[
 * 'email', 'datecreated','entityid', 'externalid', 'internalid',
 * 'firstname', 'title', 'salutation', 'isinactive', 'homephone', 'mobilephone', 'fax', 
 * 'phone', 'lastname', 'comments', 'subsidiary','middlename', 'globalsubscriptionstatus'
 * ]`
 */
export interface MarketingEntity extends Entity {
    [key: string]: any; // temporarily Allow arbitrary additional properties
    altphone?: string;
    stage?: string | RecordRef;
    accountnumber?: string;
    salesrep?: string | RecordRef;
    taxitem?: CustomerTaxItemEnum | RecordRef;
    taxable?: boolean;
    leadsource?: LeadSourceEnum | RecordRef;
    partner?: string | RecordRef;
    pricelevel?: string | RecordRef;
}


/**
 * @interface **`MarketingEntitySublists`**
 * @property {AddressBook} [addressbook] - Address book sublist for the relationship entity/contact.
 * - {@link AddressBook} = {@link AddressBookEntry}`[]` 
 * - = `{ addressbookaddress?: `{@link Address}`, addressid?: string, defaultbilling?: boolean, defaultshipping?: boolean, internalid?: number, label?: string}[]`
 * */
export interface MarketingEntitySublists extends EntitySublists {
    addressbook?: AddressBook | AddressBookEntry[];
    contactroles?: never[]; // not implemented
    itempricing?: never[]; // not implemented
    salesteam?: never[]; // not implemented
    partners?: never[]; // not implemented
    creditcards?: never[]; // not implemented
}

/*
Intersection of ['customer', 'lead', 'prospect'] fieldIds:
len(intersection)=98 [ 
 'stage', 'buyingtimeframe', 'altphone', 'depositbalance', 'daysoverdue', 'partner',  'consoloverduebalance', 'receivablesaccount', 'category', 'territory', 'overduebalance',  'buyingreason', 'estimatedbudget', 'consoldepositbalance', 'currencyprecision', 'weblead', 'salesrep', 'isinactive', 'resalenumber', 'pricelevel', 'sourcewebsite', 'prefccprocessor','salesreadiness', 'fxaccount', 'accountnumber', 'creditholdoverride', 'printtransactions', 'keywords', 'taxable', 'salutation', 'entitystatus',  'datecreated', 'entityid', 'referrer', 'taxfractionunit', 'leadsource', 'consolbalance',  'consolunbilledorders'
]
*/