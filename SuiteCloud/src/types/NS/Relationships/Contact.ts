/**
 * @incomplete
 * @file src/types/NS/Relationships/Contact.ts
 * @description TypeScript definitions for Contact Record fields in NetSuite.
 * @module Contact
 * @NetSuiteInternalId contact
 * @reference {@link https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/contact.html}
 */

import { Address, AddressBook } from './Address';


export interface ContactBase {
    /**
     * @label "Contact" 
     * @description NetSuite automatically completes this field as you enter first, middle, and last names below. This is how the contact's name appears in all lists.
     * @readonly 
     * */
    entityid?: string;
    /**
     * @label "First Name" 
     * @description Enter the contact's name. What you enter here automatically appears first in the Contact field. This field is required for the Online Bill Pay feature.
     * @required
     * */
    firstname: string;
    /**
     * @label "Last Name" 
     * @description Enter the contact's last name. What you enter here automatically appears last in the Contact field. This field is required for the Online Bill Pay feature.
     * @required
     * */
    lastname: string;
}

export interface Contact extends ContactBase {
    /**
     * @label "Middle Name" 
     * @description Enter the contact's middle name or initial. This field is optional. What you enter here automatically appears second in the Contact field.
     * */
    middlename?: string;
    
    /**
     * @label "Salutation"
     * @description Enter the contact's salutation. Examples are Mr., Mrs., Ms. and Miss.
     */
    salutation?: string;
    /**
     * @label "Title"
     * @description Enter this contact's job title at his or her company. This title appears next to the contact's name in the Contacts section of company records.
     * */
    title?: string;
    /**
     * @label "Company"
     * @description Select the company this contact works for. This contact appears in contact lists for this company.
     * */
    company?: string;
    email?: string;
    phone?: string;
    externalid?: string;
}