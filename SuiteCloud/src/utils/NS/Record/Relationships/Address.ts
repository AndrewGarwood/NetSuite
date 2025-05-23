/**
 * @file Address.ts
 * @description TypeScript definition for the Address record and related objects in NetSuite.
 * @module Address
 * @reference {@link https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/address.html}

 */

import { NetSuiteCountryEnum, CountryAbbreviationEnum, StateAbbreviationEnum } from "../../Enums";


/**
 * @interface Address
 * @description TypeScript definition for the Address record in NetSuite.
 * @reference {@link https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/address.html}
 * 
 * @property {string} [addr1] - Address 1 - (street address line 1) Enter the address the way it should appear on forms. For employees, customers, partners, and vendors, what you enter here autofills on forms if this address is marked default for Shipping or Billing. Enter up to 50 characters. This field is required for the Online Bill Pay feature.
 * @property {string} [addr2] - Address 2 - (street address line 2) Enter an optional second address line the way it should appear on forms. For employees, customers, partners, and vendors, what you enter here autofills on forms if this address is marked default for Shipping or Billing. Enter up to 50 characters.
 * @property {string} [addr3] - Address 3 - (street address line 3)
 * @property {string} [addressee] - Addressee - Enter the name of the entity/company that should appear on the shipping label here. This name appears on the shipping label below what you enter in the Attention field.
 * @property {string} [addressformat] - Address Template
 * @property {string} [addrphone] - Phone - Enter the phone number.
 * @property {string} [attention] - Attention - Enter the name of the person to whom a shipment is addressed, as it should appear on shipping labels. This field is required for UPS Integration.
 * @property {string} [city] - City - Enter the city the way it should appear on all forms except checks.
 * @property {CountryAbbreviationEnum | NetSuiteCountryEnum} [country] - Country {@link CountryAbbreviationEnum} | {@link NetSuiteCountryEnum} - the country to be used for the address.
 * @property {string} [externalid] - ExternalId
 * @property {string} [internalid] - Internal ID
 * @property {boolean} [override] - Override - Check this box to disable the free-form address text field. When this field is disabled, text entered in the other address fields does not display in the Address text field. Clear this box to allow text entered in the address component fields to appear in the free-form address text field.
 * @property {StateAbbreviationEnum} [state] - State -Enter your company's state or province the way it should appear on all forms except checks.
 * @property {string} [zip] - Zip - Enter the postal code the way it should appear on all forms except checks.
 * @notimplemented {string} [customform] - Custom Form - (custom fields) Not implemented in this definition.
 * @notimplemented {string} [addrtext] - Address - The values entered in the other address fields are displayed here. I assume this field will be automatically populated once the record is made.
 */
export interface Address {
    addr1: string;
    addr2?: string;
    addr3?: string;
    addressee: string;
    attention?: string;
    addressformat?: string;
    addrphone?: string;
    city?: string;
    country: CountryAbbreviationEnum | NetSuiteCountryEnum;
    externalid?: string;
    internalid?: string;
    override?: boolean;
    state?: StateAbbreviationEnum;
    zip?: string;
}

/**
 * @typedefn AddressBook
 * @description TypeScript definition for the Address Book record in NetSuite.
 * @reference https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/vendor.html#:~:text=addressbook%20%2D%20Address%20Book
 * @reference https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/schema/other/vendoraddressbook.html?mode=package
 * 
 * @property {Address} [addressbookaddress] - Address Book Address - The address book address.
 * @property {string} [addressid] - Address ID - The address ID.
 * @property {boolean} [defaultbilling] - Default Billing - Check this box to make this address the default billing address.
 * @property {boolean} [defaultshipping] - Default Shipping - Check this box to make this address the default shipping address.
 * @property {number} [internalid] - Internal ID - The internal ID of the address book record.
 * @property {string} [label] - Label - The label for the address book record.
 * @notimplemented {number} [id] - redundant? of the address book record.
 */
export interface AddressBookEntry {
    addressbookaddress?: Address;
    addressid?: string;
    defaultbilling?: boolean;
    defaultshipping?: boolean;
    internalid?: number;
    label?: string;
}

export type AddressBook = AddressBookEntry[];

/*
@reference https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/address.html

*/