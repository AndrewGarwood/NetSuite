/**
 * @file src/types/NS/Relationships/Contact.ts
 * @description TypeScript definitions for Contact Record fields in NetSuite.
 * @module Contact
 * @NetSuiteInternalId contact
 * @reference {@link https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/contact.html}
 */
import { RecordRef } from '../Record';
import { Address, AddressBook } from './Address';
import { GlobalSubscriptionStatusEnum } from '../Enums';

/**
 * @interface ContactBase
 * @description interface with basic properties for Contact Record fields in NetSuite.
 * - see {@link Contact} for full interface with all properties.
 * @property {string} entityid - Contact name as it appears in all lists.
 * @property {string} firstname - Contact's first name. Required for Online Bill Pay feature.
 * @property {string} lastname - Contact's last name. Required for Online Bill Pay feature.
 * @property {string} email - Contact's e-mail address for direct communication and event invitations.
 */
export interface ContactBase {
    /**
     * @label "Contact" 
     * @description NetSuite automatically completes this field as you enter first, middle, and last names below. This is how the contact's name appears in all lists.
     * @readonly 
     * */
    entityid?: string;
    /**
     * @label "Full Name" 
     * @description Enter the contact's name. What you enter here automatically appears first in the Contact field. This field is required for the Online Bill Pay feature.
     * @required
     * */
    firstname: string;
    /**
     * @label "Last Name" 
     * @description Enter the contact's last name. What you enter here automatically appears last in the Contact field. This field is required for the Online Bill Pay feature.
     * */
    lastname?: string;

    /**
     * @label "Email"
     * @description Enter the contact's e-mail address. If you enter an e-mail address, you can e-mail this contact directly from the Contacts list. Also, If you invite this contact to an event, the contact receives e-mail with the event details.
     */
    email?: string;
}

/**
 * @interface Contact
 * @description interface with all properties for Contact Record fields in NetSuite.
 * - see {@link ContactBase} for basic properties.
 * @property {string} altemail - Alternate e-mail address for this contact, optional.
 * @property {string} externalid - External ID for this contact, optional for import/export.
 * @property {string} middlename - Contact's middle name or initial, optional.
 * @property {string} salutation - Contact's salutation (e.g., Mr., Mrs., Ms.).
 * @property {string} title - Contact's job title at their company.
 * @property {string} company - Company this contact works for.
 * @property {string} contactrole - Contact's role with the company, can create new roles at Setup > Sales > CRM Lists.
 * @property {Address} defaultaddress - Default billing address, automatically shows when added using the Address subtab. readonly.
 * @property {string} phone - Primary phone number for the contact, required for Online Bill Pay feature.
 * @property {string} mobilephone - Contact's mobile or cell phone number.
 * @property {string} homephone - Contact's home phone number.
 * @property {string} fax - Fax number for this record, should be dialed exactly as required.
 * @property {string} officephone - Contact's work phone number.
 * @property {string} assistant - Contact's assistant, can select only from existing contacts.
 * @property {string} assistantphone - Phone number for this contact's assistant.
 * @property {string} supervisor - Contact's supervisor, can select only from existing contacts.
 * @property {string} supervisorphone - Phone number for this contact's supervisor.
 * @property {boolean} isinactive - If checked, contact no longer appears on the Contacts list unless Show Inactives is checked.
 * @property {boolean} isprivate - If checked, this is a private contact, viewable only by the person who entered the record.
 * @property {string} category - Contact's category, can create new categories at Setup > Sales > CRM Lists.
 * @property {string} comments - Additional information about the contact, up to 999 characters.
 * @property {string} image - Image from the file cabinet to attach to this record.
 * @property {GlobalSubscriptionStatusEnum} globalsubscriptionstatus - Email recipients' subscription status (e.g., Confirmed Opt-In, Soft Opt-In, etc.).
 * @property {boolean} unsubscribe - If checked, this contact has unsubscribed from e-mail marketing campaigns.
 * @property {string | Date} datecreated - Date when this record was created, automatically recorded by NetSuite.
 * @property {string | Date} lastmodifieddate - Date when this record was last modified, automatically recorded by NetSuite.
 */
export interface Contact extends ContactBase {
    /**
     * @label "Alt. Email"
     * @description Enter an alternate e-mail address for this contact. This field is optional. You can use this field to send e-mail to this contact without using the primary e-mail address. The alternate e-mail address you enter here appears in the Alternate E-mail field of the contact record.
     * */
    altemail?: string;
    /**
     * @label " External ID"
     * @description Enter an external ID for this contact. This field is optional. You can use this field to import or export data from other systems. The external ID you enter here appears in the External ID field of the contact record.
     */
    externalid?: string;
    /**
     * @label "Middle Name" 
     * @description Enter the contact's middle name or initial. This field is optional. What you enter here automatically appears second in the Contact field.
     * */
    middlename?: string;
    
    /**
     * @label "Mr/Mrs/Ms"
     * @description Enter the contact's salutation. Examples are Mr., Mrs., Ms. and Miss.
     */
    salutation?: string;
    /**
     * @label "Job Title"
     * @description Enter this contact's job title at his or her company. This title appears next to the contact's name in the Contacts section of company records.
     * */
    title?: string;
    /**
     * @label "Company"
     * @description Select the company this contact works for. This contact appears in contact lists for this company.
     * */
    company?: string;
    /**
     * @label "Contact Role"
     * @description Select this contact's role with this company. You can create a new contact role at Setup > Sales > CRM Lists.
     * */
    contactrole?: string | RecordRef;
    /**
     * @label "Address"
     * @description The default billing address automatically shows here when you enter and add it using the Address subtab.
     * @readonly
     * */
    defaultaddress?: Address;

    /**
     * @label "Phone"
     * @description Enter the phone number you primarily use to reach this contact. This number appears in the Contacts list and in the Contact section of company records. This field is required for the Online Bill Pay feature.
     * */
    phone?: string;
    /**
     * @label "Mobile Phone"
     * @description Enter the contact's mobile or cell phone number. This number appears only on this record.
     * */
    mobilephone?: string;
    /**
     * @label "Home Phone"
     * @description Enter the contact's home phone number. This number appears only on this record.
     * */
    homephone?: string;
    /**
     * @label "Fax"
     * @description Enter a fax number for this record. You should enter the fax number exactly as it must be dialed. If a '1' is required to fax to this number, be sure to include it at the beginning of the number. The number you enter automatically appears in the To Be Faxed field of transactions when you select this customer. To fax NetSuite forms, an administrator must first set up fax service at Setup > Set Up Printing, Fax and E-mail > Fax.
     * */
    fax?: string;
    /**
     * @label "Office Phone"
     * @description Enter the contact's work phone number. This number appears only on this record.
     * */
    officephone?: string;
    /**
     * @label "Assistant"
     * @description Select this contact's assistant. You can select only from existing contacts. To add to this list, create another contact record.
     * */
    assistant?: string | RecordRef;
    /**
     * @label "Assistant Phone"
     * @description Enter the phone number for this contact's assistant. This number appears only on this record.
     * */
    assistantphone?: string;
    /**
     * @label "Supervisor"
     * @description Select this contact's supervisor. You can select only from existing contacts. To add to this list, create another contact record.
     * */
    supervisor?: string | RecordRef;
    /**
     * @label "Supervisor Phone"
     * @description Enter the phone number for this contact's supervisor.
     * */
    supervisorphone?: string;
    /**
     * @label "Inactive"
     * @description When you check this box, this contact no longer appears on the Contacts list unless you check the Show Inactives box at the bottom of the page. Also, you can no longer select this contact from lists on transactions, company records, task records or events records.
     * */
    isinactive?: boolean;
    /**
     * @label "Private"
     * @description Check this box if this is a private contact. Private contacts can only be viewed by the person that entered the contact record. They are also excluded from the Duplicate Detection process.
     * */
    isprivate?: boolean;
    /**
     * @label "Category"
     * @description Select this contact's category. You can create new contact categories at Setup > Sales > CRM Lists > New > Contact Category.
     * */
    category?: string | RecordRef;
    /**
     * @label "Comments"
     * @description Enter any other information you want to note about this contact. These notes appears only on this record. You can enter up to 999 characters of text.
     * */
    comments?: string;
    /**
     * @label "Image"
     * @description Select an image from your file cabinet to attach to this record. Select -New- to upload a new image from your hard drive to your file cabinet in a new window.
     * */
    image?: string | RecordRef;
    /**
     * @label "Global Subscription Status"
     * @description Email recipients can have one of four subscription statuses: * Confirmed Opt-In - When an email recipient has indicated that they want to receive your campaign messages, they are assigned this subscription status. Only a recipient can set his or her subscription status to Confirmed Opt-In. * Soft Opt-In - Recipients with this status can receive opt-in messages that enable them to confirm whether or not they want to receive your email campaigns as well as email marketing campaigns. You can set a recipient’s status to Soft Opt-In manually or through a mass update. * Soft Opt-Out - Recipients with this status cannot receive campaign email messages but can receive opt-in messages. You can change this subscription status to Soft Opt-In manually or through a mass update. * Confirmed Opt-Out - Only the recipient can set their subscription status to Confirmed Opt-Out. Recipients with this status cannot receive email campaigns or opt-in messages. Recipients with this status can only opt in again through the Customer Center or by clicking the link in a campaign message they have received prior to opting out.
     * */
    globalsubscriptionstatus?: GlobalSubscriptionStatusEnum | string | RecordRef;
    /**
     * @label "Unsubscribe from Campaigns"
     * @description This box is checked if this contact has unsubscribed from your e-mail marketing campaigns. Unsubscribed contacts receive no marketing campaign e-mail. Contacts can unsubscribe to your e-mail marketing campaigns by clicking a link in any campaign e-mail they receive. To resubscribe to e-mail campaigns, a contact must opt in through the Customer Center or click the Unsubscribe link on a campaign e-mail message. If you are using the US Edition of NetSuite and you want new contacts to be subscribed by default, an administrator can go to Setup > Marketing > Set Up Marketing and clear the Unsubscribed to Marketing by Default box.
     * */
    unsubscribe?: boolean;
    /**
     * @label "Date Created"
     * @description In this field, NetSuite automatically records the date you created this record.
     * @readonly
     * */
    datecreated?: string | Date;
    /**
     * @label "Last Modified Date"
     * @description In this field, NetSuite automatically records the date you created this record.
     * @readonly
     * */
    lastmodifieddate?: string | Date;
}

/**
 * @interface ContactSublists
 * */
export interface ContactSublists {
    /**
     * @label "Address Book"
     * @description Address book sublist for the contact.
     * */
    addressbook?: AddressBook[];
}