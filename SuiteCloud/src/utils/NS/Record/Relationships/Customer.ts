/**
 * @file src/utils/ns/record/relationships/Customer.ts
 */
import { RecordRef } from "../Record";
import { RadioFieldBoolean } from "src/utils/typeValidation";
import { AddressBook } from "./Address";

/**
 * @interface **`CustomerBase`**
 * @property {string} entityid
 * @property {CustomerStatusEnum} entitystatus
 * @property {RadioFieldBoolean} [taxable]
 * @property {string} [taxitem]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [altphone]
 * @property {string} [fax]
 * @property {string} [companyname]
 * @property {string} [firstname]
 * @property {string} [middlename]
 * @property {string} [lastname]
 */
export interface CustomerBase {
    entityid: string;
    entitystatus: CustomerStatusEnum;
    isperson?: RadioFieldBoolean;
    category?: RecordRef;
    taxable?: boolean;
    taxitem?: string;
    email?: string;
    phone?: string;
    companyname?: string;
    salutation?: string;
    firstname?: string;
    middlename?: string;
    lastname?: string;
}

export interface Customer extends CustomerBase {
    internalid?: string | number | RecordRef;
    externalid?: string | RecordRef;
    altemail?: string;
    altphone?: string;
    mobilephone?: string;
    homephone?: string;
    fax?: string;
    url?: string;
    terms?: number
}

/**
 * @interface **`CustomerSublists`**
 * @reference {@link https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/customer.html#:~:text=your%20Web%20site.-,Sublists,-addressbook%20%2D%20Address}
 * */
export interface CustomerSublists {
    /**
     * @label "Address Book"
     * @description Address book sublist for the customer.
     * */
    addressbook?: AddressBook;
    /**
     * @notimplemented
     * @readonly
     * @label "Contacts"
     * @description contact sublist for the customer.
     * */
    contactroles?: never[];
}



/**
 * @enum {number} **`CustomerStatusEnum`**
 * @property {number} UNQUALIFIED - `6`
 * @property {number} QUALIFIED - `7`
 * @property {number} IN_DISCUSSION - `8`
 * @property {number} IDENTIFIED_DECISION_MAKERS - `9`
 * @property {number} PROPOSAL - `10`
 * @property {number} IN_NEGOTIATION - `11`
 * @property {number} PURCHASING - `12`
 * @property {number} CLOSED_WON - `13`
 * @property {number} CLOSED_LOST - `14`
 * @property {number} RENEWAL - `15`
 * @property {number} LOST_CUSTOMER - `16`
 */
export enum CustomerStatusEnum {
    UNQUALIFIED = 6,
    QUALIFIED = 7,
    IN_DISCUSSION = 8,
    IDENTIFIED_DECISION_MAKERS = 9,
    PROPOSAL = 10,
    IN_NEGOTIATION = 11,
    PURCHASING = 12,
    CLOSED_WON = 13,
    CLOSED_LOST = 14,
    RENEWAL = 15,
    LOST_CUSTOMER = 16,
}

/**
 * @enum {number} **`CustomerTaxItemEnum`**
 * @property {number} NOT_TAXABLE - `-7`
 * @property {number} YOUR_TAX_ITEM - `105`
 */
export enum CustomerTaxItemEnum {
    NOT_TAXABLE = -7,
    YOUR_TAX_ITEM = 105,
}