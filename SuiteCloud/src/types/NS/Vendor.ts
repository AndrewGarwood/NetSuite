/**
 * @file Vendor.d.ts
 * @description TypeScript definition for the Vendor record in NetSuite.
 * @module Vendor
 * @NetSuiteInternalId vendor
 */
import { RecordRef } from './Record';
import { Address, AddressBook } from './Address';
import { NetSuiteCountryEnum, EmailPreferenceEnum, GlobalSubscriptionStatusEnum } from './Enums';

export interface VendorBase {
    /** @description entityid Required on Add.*/
    entityid: string;
    /** @description Subsidiary Select the subsidiary to associate with this vendor. If you use NetSuite OneWorld, select the primary subsidiary to assign to this vendor. You cannot enter transactions for this vendor unless a subsidiary, or primary subsidiary is assigned. The default primary currency for the vendor is the base currency of the primary subsidiary. If you select this vendor on a transaction, the transaction is associated with this subsidiary. The vendor is able to access only information associated with this subsidiary. Note: After a transaction has posted for the vendor, you are not able to change the subsidiary selected on the vendor record. If you have NetSuite OneWorld, after you save the vendor record, you cannot change the primary subsidiary.*/
    subsidiary: string;
    /** @description isinactive When you check this box, this vendor will no longer appear on a list unless you check the Show Inactives box at the bottom of the list page.*/
    isinactive: boolean;
}


/**
 * Full vendor interface with all possible fields
 */
export interface Vendor extends VendorBase {
    /** @description accountnumber Sets the account number for vendors to reference.*/
    accountnumber?: string;
    /** @description altemail */
    altemail?: string;
    /** @description altphone Phone numbers can be entered in the following formats: 999-999-9999, 1-999-999-9999, (999) 999-9999, 1(999) 999-9999 or 999-999-9999 ext 9999*/
    altphone?: string;
    /** @description autoname This is the name of this person or company.*/
    autoname?: boolean;
    /** @description balance This is a read-only calculated field that returns the vendor's current accounts payable balance. The balance field on the customer is only returned in search if you set the BodyFieldsOnly flag to false.*/
    balance?: number;
    /** @description balanceprimary This is a read-only calculated field that returns the vendor's current accounts payable balance in the specified currency.*/
    balanceprimary?: number;
    /** @description bcn - Enter the 15-digit registration number that identifies this vendor as a client of the Canada Customs and Revenue Agency (CCRA).*/
    bcn?: string;
    /** @description billpay Check this box in order to send this vendor payments online. Before you can use this feature, you must set up Online Bill Pay at Setup > Accounting > Online Bill Pay.*/
    billpay?: boolean;
    /** @description category References a value in a user defined list at Setup > Accounting > Setup Tasks > Accounting Lists > Vendor Categories.*/
    category?: RecordRef;
    /** @description comments - Enter any other information you wish to track for this vendor.*/
    comments?: string;
    /** @description companyname Required on Add when the isPerson field is set to FALSE.*/
    companyname?: string;
    /** @description contact */
    contact?: string;
    /** @description creditlimit A credit limit for your purchases from the vendor. If set, and depending on preferences, a warning is generated when this customer's limit is exceeded during a transaction addition.*/
    creditlimit?: number;
    /** @description currency References a value in a user-defined list at Lists > Accounting > Currencies. This value sets the currency that all transactions involving this vendor are conducted in. If defaults are OFF, this field is required. Can only be set if the multicurrency feature is enabled?*/
    currency?: string;
    /** @description datecreated */
    datecreated?: string;
    /** @description defaultaddress */
    defaultaddress?: Address;
    /** @description defaultbankaccount */
    defaultbankaccount?: string;
    /** @description defaulttaxreg */
    defaulttaxreg?: string;
    /** @description Vendor Email Sets the email address for the vendor. If giveAccess is also set to true this is the email used by the customer for login.*/
    email?: string;
    /** @description Email Preference Reference to a value in a system list. Possible values include: _PDF, _HTML.*/
    emailpreference: EmailPreferenceEnum;
    /** @description Email Transactions Set a preferred transaction delivery method for this vendor. Choose to send transactions by regular mail, by email, by fax, or by a combination of the three. Then, when you select the vendor on a transaction, their preferred delivery method is marked by default. * Email – Check this box to check the To Be Emailed box by default on transactions when this vendor is selected. * Print – Check this box to check the To Be Printed box by default on transactions when this vendor is selected. * Fax – Check this box to check the To Be Faxed box by default on transactions when this vendor is selected. Once you enter these settings on the vendor record, these boxes are checked by default for transactions created from the vendor record or for transactions that are copied or converted. Note: These settings override any customized settings on transaction forms you use. There are also preferences to set default values for new vendor records at Setup > Company > Printing, Fax and Email Preferences. On the Print subtab, Fax subtab, or Email subtab, check Vendors Default to [Print/Fax/Email] Transactions. You can also set these fields using the Mass Update function. Go to Lists > Mass Update > Mass Updates > General and click Vendor.
 */
    emailtransactions?: boolean;
    /** @description Default Expense Account References an existing account to be used for goods and services you purchase from this vendor.*/
    expenseaccount?: string;
    /** @description externalid */
    externalid?: string;
    /** @description Fax Sets the fax number for the vendor.*/
    fax?: string;
    /** @description Fax Transactions Set a preferred transaction delivery method for this vendor. Choose to send transactions by regular mail, by email, by fax, or by a combination of the three. Then, when you select the vendor on a transaction, their preferred delivery method is marked by default. * Email – Check this box to check the To Be Emailed box by default on transactions when this vendor is selected. * Print – Check this box to check the To Be Printed box by default on transactions when this vendor is selected. * Fax – Check this box to check the To Be Faxed box by default on transactions when this vendor is selected. Once you enter these settings on the vendor record, these boxes are checked by default for transactions created from the vendor record or for transactions that are copied or converted. Note: These settings override any customized settings on transaction forms you use. There are also preferences to set default values for new vendor records at Setup > Company > Printing, Fax and Email Preferences. On the Print subtab, Fax subtab, or Email subtab, check Vendors Default to [Print/Fax/Email] Transactions. You can also set these fields using the Mass Update function. Go to Lists > Mass Update > Mass Updates > General and click Vendor.*/
    faxtransactions?: boolean;
    /** @description First Name	- Required on Add when the isPerson field is set to TRUE.*/
    firstname?: string;
    /** @description Login Access - Enables access to your NetSuite account for the vendor. The level of access is defined by the role assigned in the accessRole field.*/
    giveaccess?: boolean;
    /** @description globalsubscriptionstatus */
    globalsubscriptionstatus?: GlobalSubscriptionStatusEnum;
    /** @description homephone */
    homephone?: string;
    /** @description Image Select an image from your file cabinet to attach to this record. Select -New- to upload a new image from your hard drive to your file cabinet in a new window.*/
    image?: RecordRef;
    /** @description Incoterm Choose the standardized three-letter trade term to be used on transactions related to this vendor. These terms are international commercial procurement practices that communicate the tasks, costs, and risks associated with the transportation and delivery of goods. Incoterms define where the customer takes ownership of the product and are typically used for international orders, such as when an item goes through customs or crosses a border.*/
    incoterm?: string;
    /** @description 1099 Eligible	 If this vendor requires you to issue an annual 1099 income statement form, place a check mark in this box. Vendors you pay $600 or more a year for goods and/or services are 1099 eligible. Only vendors that use the U.S. dollar are 1099 eligible.*/
    is1099eligible: boolean;
    /** @description Project Resource	 Check this box to enable this vendor to be chosen as a resource on tasks and jobs. As a job resource, a vendor can be assigned to complete a task or to manage a project. Clear this box if you do not want this vendor assigned as a job resource. Note: If you use NetSuite OneWorld, you cannot share a vendor with multiple subsidiaries and define the vendor as a resource on tasks and jobs.*/
    isjobresourcevend?: boolean;
    /** @description Company -  Next to Type, select to identify the supplier as a Company or Individual.*/
    isperson?: boolean;
    /** @description Labor Cost	 Enter the cost of labor for this vendor in order to be able to calculate profitability on jobs.*/
    laborcost?: number;
    /** @description Last Modified Date	 Returns the date on which the vendor record was last modified.*/
    lastmodifieddate?: string;
    /** @description lastname Optionally enter a last name here.*/
    lastname?: string;
    /** @description Legal Name	 Enter the legal name for this vendor for financial purposes. If you entered a name in the Company Name field, that name appears here.*/
    legalname?: string;
    /** @description middlename Returns the vendor's middle name or initial, if one is entered on the vendor record.*/
    middlename?: string;
    /** @description Mobile Phone	 */
    mobilephone?: string;
    /** @description Opening Balance	Enter the opening balance of your account with this vendor.
 */
    openingbalance?: number;
    /** @description Opening Balance Account	 Select the account this opening balance is applied to.
 */
    openingbalanceaccount?: RecordRef;
    /** @description Opening Balance Date	Enter the date of the balance entered in the Opening Balance field */
    openingbalancedate?: string;
    /** @description Other Relationships	If there are other records in your account for this individual or company, they are listed here. To create another type of record for this customer, click Add New. */
    otherrelationships?: string;
    /** @description Parent */
    parent?: number;
    /** @description Default Payables Account	 Choose the default payable account for this vendor record.*/
    payablesaccount?: RecordRef;
    /** @description Phone - Enter a phone number for your vendor. It will appear on the Vendor List report. This field is required for the Online Bill Pay feature.*/
    phone?: string;
    /** @description Furigana - Enter the furigana character you want to use to sort this record.*/
    phoneticname?: string;
    /** @description Predicted Confidence Level - Enter the confidence you have that this vendor will provide the required material expressed as a percentage.*/
    predconfidence?: number;
    /** @description Predicted Days Late - Enter how late or early you expect this vendor to provide the required material in number of days. To indicate days early, enter a negative number. */
    predicteddays?: number;
    /** @description Prepayment Balance - This field displays the total balance of prepayments made to this vendor that have not been applied to a bill payment yet. */
    prepaymentbalance?: number;
    /** @description Print on Check As - What you enter here prints on the Pay to the Order of line of a check instead of what you entered in the Vendor field.*/
    printoncheckas?: string;
    /** @description Print  Set a preferred transaction delivery method for this vendor. Choose to send transactions by regular mail, by email, by fax, or by a combination of the three. Then, when you select the vendor on a transaction, their preferred delivery method is marked by default. * Email – Check this box to check the To Be Emailed box by default on transactions when this vendor is selected. * Print – Check this box to check the To Be Printed box by default on transactions when this vendor is selected. * Fax – Check this box to check the To Be Faxed box by default on transactions when this vendor is selected. Once you enter these settings on the vendor record, these boxes are checked by default for transactions created from the vendor record or for transactions that are copied or converted. Note: These settings override any customized settings on transaction forms you use. There are also preferences to set default values for new vendor records at Setup > Company > Printing, Fax and Email Preferences. On the Print subtab, Fax subtab, or Email subtab, check Vendors Default to [Print/Fax/Email] Transactions. You can also set these fields using the Mass Update function. Go to Lists > Mass Update > Mass Updates > General and click Vendor.*/
    printtransactions?: boolean;
    /** @description Vendor Bill - Purchase Order Amount Tolerance - Enter the tolerance limit for the discrepancy between the amount on the vendor bill and purchase order.*/
    purchaseorderamount?: number;
    /** @description Vendor Bill - Purchase Order Quantity Tolerance - Enter the tolerance limit for the discrepancy between the quantity on the vendor bill and purchase order*/
    purchaseorderquantity?: number;
    /** @description Vendor Bill - Purchase Order Quantity Difference - Enter the difference limit for the discrepancy between the quantity on the vendor bill and purchase order.*/
    purchaseorderquantitydiff?: number;
    /** @description Vendor Bill - Item Receipt Amount Tolerance - Enter the tolerance limit for the discrepancy between the amount on the vendor bill and item receipt.*/
    receiptamount?: number;
    /** @description Vendor Bill - Item Receipt Quantity Tolerance - Enter the tolerance limit for the discrepancy between the quantity on the vendor bill and item receipt.*/
    receiptquantity?: number;
    /** @description Vendor Bill - Item Receipt Quantity Difference - Enter the difference limit for the discrepancy between the quantity on the vendor bill and item receipt.*/
    receiptquantitydiff?: number;
    /** @description representingsubsidiary Indicates that this entity is an intercompany vendor. Select the subsidiary this vendor represents as the seller in intercompany transactions.*/
    representingsubsidiary?: string;
    /** @description Require Password Change On Next Login Check this box to require this user to change their password on their next login to NetSuite. When the user next logs in, they see the Change Password page and cannot access other NetSuite pages until a new password is created and saved. Requiring this action protects your account from unauthorized access using generic passwords and prepares your account for an audit. The Require Password Change on Next Login box never displays as checked. When you check this box and save the record, an internal flag is set. When the password change occurs, the flag is cleared. If you later check the box again and save the record, the internal flag is reset to require another password change.*/
    requirepwdchange?: boolean;
    /** @description salutation Mr./Ms...*/
    salutation: string;
    /** @description Send Notification Email Check this box to automatically send an email notifying the vendor that you have given limited access to your NetSuite account. The standard NetSuite email message also contains a link to let the user create a password. If you do not check this box, you must check the Manually Assign or Change Password box. You must create the password, and tell the user the password, and when and how to log in. For security reasons, do not send the password by email.*/
    sendemail?: boolean;
    /** @description Password Strength */
    strength?: string;
    /** @description Edition */
    subsidiaryedition?: string;
    /** @description Tax Rounding Precision */
    taxfractionunit?: string;
    /** @description taxidnum - Enter your vendor's tax ID number (SSN for an individual). This is necessary if you are required to issue a 1099 form.*/
    taxidnum: string;
    
    /** @description Tax Code Select the default tax code you want applied to purchase orders and bills for this vendor. You can change the tax code on individual transactions.*/
    taxitem?: string;
    /** @description Tax Rounding Method */
    taxrounding?: string;
    /** @description Tegata Maturity Date */
    tegatamaturity?: number;
    /** @description terms Select the standard discount terms for this vendor's invoices. You can always change terms for an individual order or bill, however. To add choices to this list, go to Setup > Accounting > Accounting Lists > New > Term.*/
    terms: RecordRef;
    /** @description Job Title  */
    title?: string;
    /** @description unbilledorders This field displays the total amount of orders that have been entered but not yet billed. If you have enabled the preference Vendor Credit Limit Includes Orders, then this total is included in credit limit calculations. Set this preference at Setup > Accounting > Preferences > Accounting Preferences > General.*/
    unbilledorders?: number;
    /** @description unbilledordersprimary This field displays the total amount of orders that have been entered but not yet billed in the specified currency.*/
    unbilledordersprimary?: number;
    /** @description URL Only available when isPerson is set to FALSE.*/
    url?: string;
    /** @description VAT Registration No. For the UK edition only. Note that this field is not validated when submitted via Web services.*/
    vatregnumber?: string;
    /** @description Work Calendar Select the work calendar for this vendor.*/
    workcalendar: RecordRef;
    
}

export interface VendorSublists extends VendorBase {
    /** @description addressbook sublist @reference https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/schema/other/vendoraddressbooklist.html?mode=package*/
    addressbook?: AddressBook;
}




/*
Internal ID	Type	nlapiSubmitField	Label	Required	Help
accountnumber	text	true	Account	false	If your vendors assign account numbers to you, enter one here. This number will later appear in these places: * In the Vendor # field on purchase orders * In the Memo field on checks
altemail	email	true	Alt. Email	false	
altphone	phone	true	Alt. Phone	false	Enter an optional alternate phone number for this record. Phone numbers can be entered in the following formats:999-999-9999, 1-999-999-9999, (999) 999-9999, 1(999) 999-9999 or 999-999-9999 ext 9999 .
autoname	checkbox	false	Auto	false	Clear this box to manually enter a name for this record. If you leave this box marked, NetSuite assigns a name or number for this record based on your settings at Setup > Company > Auto-Generated Numbers.
balance	currency	false	Balance	false	The vendor's current accounts payable balance due appears here.
balanceprimary	currency	false	Balance	false	This is a read-only calculated field that returns the vendor's current accounts payable balance in the specified currency.
bcn	text	false	Business Number	false	Enter the 15-digit registration number that identifies this vendor as a client of the Canada Customs and Revenue Agency (CCRA).
billpay	checkbox	false	Enable Online Bill Pay	false	Check this box in order to send this vendor payments online. Before you can use this feature, you must set up Online Bill Pay at Setup > Accounting > Online Bill Pay.
category	select	true	Category	false	You can select the category that applies to this vendor. To add choices to this list, go to Setup > Accounting > Accounting Lists > New > Vendor Category. You must select a Tax agency for sales tax agencies, payroll tax agencies and payroll benefits providers.
comments	textarea	true	Comments	false	Enter any other information you wish to track for this vendor.
companyname	text	true	Company Name	false	In the Company name field, enter the supplier's legal name. If you use Auto-Generated Numbering, you should enter the vendor name here to ensure that it appears along with the code in lists.
contact	select	false	Primary Contact	false	Enter a contact name that will appear below the mailing address on checks and orders. To add to this dropdown list, select New. A popup window will open where you can enter a new contact record. The contact you add will immediately appear in the list and will now show in the contacts list.
creditlimit	poscurrency	true	Credit Limit	false	Enter an optional credit limit for your purchases from this vendor. If you have a NetSuite OneWorld account, enter the global credit limit for this vendor and any assigned subsidiary. This value can exceed the sum of the vendor and subsidiary credit limits. This credit limit sets a maximum currency amount that should be spent using credit without making a payment. The value displays in the vendor’s primary currency. The default is no value, or no credit limit. You can place the vendor on hold by entering 0 (zero.) Any new purchase order or vendor bill transaction displays a warning message. You cannot enter a negative value. NetSuite validates the transaction amounts on purchase orders and vendor bills against the global credit limit specified in the Credit Limit field. NetSuite does not include individual subsidiary credit limits in the global credit limit validation.
currency	select	false	Primary Currency	true	Select the currency that this vendor uses. If you use the Multi-Currency Vendors feature, select this vendor's primary currency. You can enter other transaction currencies on the Currencies subtab below. To view existing currencies or add currencies to this list, go to Lists > Accounting > Currencies.
customform	select	false	Custom Form	true	Standard Vendor Form is selected here by default. Do not select another form if you want to continue using this form. If you have already created a custom vendor form and want to use it, select that form here. To create custom vendor forms, go to Customization > Forms > Entry Forms, and click Customize next to Standard Vendor Form.
datecreated	datetime	false	Date Created	false	The date this record was created displays here.
defaultaddress	address	false	Address	false	This field automatically shows the default billing address that you enter and add using the Address subtab.
defaultbankaccount	select	false	Bank Account	false	Returns the vendor's default bank account, if one is selected on the vendor record.
defaulttaxreg	select	false	Default Tax Reg.	false	Select the default tax registration number for this entity.
defaultvendorpaymentaccount	select		Default Vendor Payment Account	false	
email	email	false	Email	false	Enter the e-mail address of your vendor. If you allow your vendors online access, this becomes part of their access code.
emailpreference	select	true	Email Preference	false	Select the format for email that is sent to this person or company. Select Default to use the preference set at Home > Set Preferences.
emailtransactions	checkbox	true	Email	false	Set a preferred transaction delivery method for this vendor. Choose to send transactions by regular mail, by email, by fax, or by a combination of the three. Then, when you select the vendor on a transaction, their preferred delivery method is marked by default. * Email – Check this box to check the To Be Emailed box by default on transactions when this vendor is selected. * Print – Check this box to check the To Be Printed box by default on transactions when this vendor is selected. * Fax – Check this box to check the To Be Faxed box by default on transactions when this vendor is selected. Once you enter these settings on the vendor record, these boxes are checked by default for transactions created from the vendor record or for transactions that are copied or converted. Note: These settings override any customized settings on transaction forms you use. There are also preferences to set default values for new vendor records at Setup > Company > Printing, Fax and Email Preferences. On the Print subtab, Fax subtab, or Email subtab, check Vendors Default to [Print/Fax/Email] Transactions. You can also set these fields using the Mass Update function. Go to Lists > Mass Update > Mass Updates > General and click Vendor.
entityid	text	true	Vendor ID	true	In the Supplier ID field, enter your supplier's name as it should appear in all lists. If you use Auto-Generated Numbering, this field fills with the vendor number or code.
expenseaccount	select	false	Default Expense Account	false	Select the standard expense account for goods and services you purchase from this vendor. This account appears on any transaction involving this vendor. You can always change this account for any individual order or bill. Select New to set up a new account. For details on accounts, go to Setup > Accounting > Chart of Accounts.
externalid	text	false	ExternalId	false	Returns the vendor's external ID, if one is assigned.
fax	phone	true	Fax	false	Enter a fax number for this record. You should enter the fax number exactly as it must be dialed. If a '1' is required to fax to this number, be sure to include it at the beginning of the number. The number you enter here automatically appears in the To Be Faxed field of transactions when you select this customer. To fax NetSuite forms, an administrator must first set up fax service at Setup > Company > Printing, Fax and Email Preferences.
faxtransactions	checkbox	true	Fax	false	Set a preferred transaction delivery method for this vendor. Choose to send transactions by regular mail, by email, by fax, or by a combination of the three. Then, when you select the vendor on a transaction, their preferred delivery method is marked by default. * Email – Check this box to check the To Be Emailed box by default on transactions when this vendor is selected. * Print – Check this box to check the To Be Printed box by default on transactions when this vendor is selected. * Fax – Check this box to check the To Be Faxed box by default on transactions when this vendor is selected. Once you enter these settings on the vendor record, these boxes are checked by default for transactions created from the vendor record or for transactions that are copied or converted. Note: These settings override any customized settings on transaction forms you use. There are also preferences to set default values for new vendor records at Setup > Company > Printing, Fax and Email Preferences. On the Print subtab, Fax subtab, or Email subtab, check Vendors Default to [Print/Fax/Email] Transactions. You can also set these fields using the Mass Update function. Go to Lists > Mass Update > Mass Updates > General and click Vendor.
firstname	text	false	Name	false	Optionally enter a first name here.
giveaccess	checkbox	false	Give Access	false	Check this box to give your vendor access to NetSuite. On the Roles subtab, assign a role to customize the level of access. You can assign multiple roles. To let your vendor view prior transactions and purchase orders, select the Vendor Center role.
globalsubscriptionstatus	select	false	Global Subscription Status	false	Email recipients can have one of four subscription statuses: * Confirmed Opt-In - When an email recipient has indicated that they want to receive your campaign messages, they are assigned this subscription status. Only a recipient can set his or her subscription status to Confirmed Opt-In. * Soft Opt-In - Recipients with this status can receive opt-in messages that enable them to confirm whether or not they want to receive your email campaigns as well as email marketing campaigns. You can set a recipient’s status to Soft Opt-In manually or through a mass update. * Soft Opt-Out - Recipients with this status cannot receive campaign email messages but can receive opt-in messages. You can change this subscription status to Soft Opt-In manually or through a mass update. * Confirmed Opt-Out - Only the recipient can set their subscription status to Confirmed Opt-Out. Recipients with this status cannot receive email campaigns or opt-in messages. Recipients with this status can only opt in again through the Vendor Center or by clicking the link in a campaign message they have received prior to opting out.
homephone	phone	true	Home Phone	false	
image	select	false	Image	false	Select an image from your file cabinet to attach to this record. Select -New- to upload a new image from your hard drive to your file cabinet in a new window.
incoterm	select	false	Incoterm	false	Choose the standardized three-letter trade term to be used on transactions related to this vendor. These terms are international commercial procurement practices that communicate the tasks, costs, and risks associated with the transportation and delivery of goods. Incoterms define where the customer takes ownership of the product and are typically used for international orders, such as when an item goes through customs or crosses a border.
is1099eligible	checkbox	true	1099 Eligible	false	If this vendor requires you to issue an annual 1099 income statement form, place a check mark in this box. Vendors you pay $600 or more a year for goods and/or services are 1099 eligible. Only vendors that use the U.S. dollar are 1099 eligible.
isinactive	checkbox	true	Inactive	false	When you check this box, this vendor will no longer appear on a list unless you check the Show Inactives box at the bottom of the list page.
isjobresourcevend	checkbox	true	Project Resource	false	Check this box to enable this vendor to be chosen as a resource on tasks and jobs. As a job resource, a vendor can be assigned to complete a task or to manage a project. Clear this box if you do not want this vendor assigned as a job resource. Note: If you use NetSuite OneWorld, you cannot share a vendor with multiple subsidiaries and define the vendor as a resource on tasks and jobs.
isperson	radio	true	Company	false	Next to Type, select to identify the supplier as a Company or Individual.
laborcost	currency	true	Labor Cost	false	Enter the cost of labor for this vendor in order to be able to calculate profitability on jobs.
lastmodifieddate	datetime	false	Last Modified Date	false	Returns the date on which the vendor record was last modified.
lastname	text	false		false	Optionally enter a last name here.
legalname	text	false	Legal Name	false	Enter the legal name for this vendor for financial purposes. If you entered a name in the Company Name field, that name appears here.
middlename	text	false		false	Returns the vendor's middle name or initial, if one is entered on the vendor record.
mobilephone	phone	true	Mobile Phone	false	
openingbalance	currency	false	Opening Balance	false	Enter the opening balance of your account with this vendor.
openingbalanceaccount	select	false	Opening Balance Account	false	Select the account this opening balance is applied to.
openingbalancedate	date	false	Opening Balance Date	false	Enter the date of the balance entered in the Opening Balance field
otherrelationships	select	false	Other Relationships	false	If there are other records in your account for this individual or company, they are listed here. To create another type of record for this customer, click Add New.
parent	integer	false	Parent	false	
payablesaccount	select	false	Default Payables Account	false	Choose the default payable account for this vendor record.
phone	phone	true	Phone	false	Enter a phone number for your vendor. It will appear on the Vendor List report. This field is required for the Online Bill Pay feature.
phoneticname	text	false	Furigana	false	Enter the furigana character you want to use to sort this record.
predconfidence	percent	false	Predicted Confidence Level	false	Enter the confidence you have that this vendor will provide the required material expressed as a percentage.
predicteddays	integer	false	Predicted Days Late	false	Enter how late or early you expect this vendor to provide the required material in number of days. To indicate days early, enter a negative number.
prepaymentbalance	currency		Prepayment Balance	false	This field displays the total balance of prepayments made to this vendor that have not been applied to a bill payment yet.
printoncheckas	text	false	Print on Check As	false	What you enter here prints on the Pay to the Order of line of a check instead of what you entered in the Vendor field.
printtransactions	checkbox	true	Print	false	Set a preferred transaction delivery method for this vendor. Choose to send transactions by regular mail, by email, by fax, or by a combination of the three. Then, when you select the vendor on a transaction, their preferred delivery method is marked by default. * Email – Check this box to check the To Be Emailed box by default on transactions when this vendor is selected. * Print – Check this box to check the To Be Printed box by default on transactions when this vendor is selected. * Fax – Check this box to check the To Be Faxed box by default on transactions when this vendor is selected. Once you enter these settings on the vendor record, these boxes are checked by default for transactions created from the vendor record or for transactions that are copied or converted. Note: These settings override any customized settings on transaction forms you use. There are also preferences to set default values for new vendor records at Setup > Company > Printing, Fax and Email Preferences. On the Print subtab, Fax subtab, or Email subtab, check Vendors Default to [Print/Fax/Email] Transactions. You can also set these fields using the Mass Update function. Go to Lists > Mass Update > Mass Updates > General and click Vendor.
purchaseorderamount	posfloat	false	Vendor Bill - Purchase Order Amount Tolerance	false	Enter the tolerance limit for the discrepancy between the amount on the vendor bill and purchase order.
purchaseorderquantity	posfloat	false	Vendor Bill - Purchase Order Quantity Tolerance	false	Enter the tolerance limit for the discrepancy between the quantity on the vendor bill and purchase order
purchaseorderquantitydiff	posfloat	false	Vendor Bill - Purchase Order Quantity Difference	false	Enter the difference limit for the discrepancy between the quantity on the vendor bill and purchase order.
receiptamount	posfloat	false	Vendor Bill - Item Receipt Amount Tolerance	false	Enter the tolerance limit for the discrepancy between the amount on the vendor bill and item receipt.
receiptquantity	posfloat	false	Vendor Bill - Item Receipt Quantity Tolerance	false	Enter the tolerance limit for the discrepancy between the quantity on the vendor bill and item receipt.
receiptquantitydiff	posfloat	false	Vendor Bill - Item Receipt Quantity Difference	false	Enter the difference limit for the discrepancy between the quantity on the vendor bill and item receipt.
representingsubsidiary	select	false	Represents Subsidiary	false	Indicates that this entity is an intercompany vendor. Select the subsidiary this vendor represents as the seller in intercompany transactions.
requirepwdchange	checkbox	false	Require Password Change On Next Login	false	Check this box to require this user to change their password on their next login to NetSuite. When the user next logs in, they see the Change Password page and cannot access other NetSuite pages until a new password is created and saved. Requiring this action protects your account from unauthorized access using generic passwords and prepares your account for an audit. The Require Password Change on Next Login box never displays as checked. When you check this box and save the record, an internal flag is set. When the password change occurs, the flag is cleared. If you later check the box again and save the record, the internal flag is reset to require another password change.
salutation	text	true	Mr./Ms...	false	
sendemail	checkbox	false	Send Notification Email	false	Check this box to automatically send an email notifying the vendor that you have given limited access to your NetSuite account. The standard NetSuite email message also contains a link to let the user create a password. If you do not check this box, you must check the Manually Assign or Change Password box. You must create the password, and tell the user the password, and when and how to log in. For security reasons, do not send the password by email.
strength	text	false	Password Strength	false	
subsidiary	select	false	Subsidiary	true	Select the subsidiary to associate with this vendor. If you use NetSuite OneWorld, select the primary subsidiary to assign to this vendor. You cannot enter transactions for this vendor unless a subsidiary, or primary subsidiary is assigned. The default primary currency for the vendor is the base currency of the primary subsidiary. If you select this vendor on a transaction, the transaction is associated with this subsidiary. The vendor is able to access only information associated with this subsidiary. Note: After a transaction has posted for the vendor, you are not able to change the subsidiary selected on the vendor record. If you have NetSuite OneWorld, after you save the vendor record, you cannot change the primary subsidiary.
subsidiaryedition	text	false	Edition	false	
taxfractionunit	select	false	Tax Rounding Precision	false	
taxidnum	text	true	Tax ID	false	Enter your vendor's tax ID number (SSN for an individual). This is necessary if you are required to issue a 1099 form.
taxitem	select	false	Tax Code	false	Select the default tax code you want applied to purchase orders and bills for this vendor. You can change the tax code on individual transactions.
taxrounding	select	false	Tax Rounding Method	false	
tegatamaturity	integer	false	Tegata Maturity Date	false	
terms	select	true	Terms	false	Select the standard discount terms for this vendor's invoices. You can always change terms for an individual order or bill, however. To add choices to this list, go to Setup > Accounting > Accounting Lists > New > Term.
title	text	false	Job Title	false	
unbilledorders	currency	false	Unbilled Orders	false	This field displays the total amount of orders that have been entered but not yet billed. If you have enabled the preference Vendor Credit Limit Includes Orders, then this total is included in credit limit calculations. Set this preference at Setup > Accounting > Preferences > Accounting Preferences > General.
unbilledordersprimary	currency	false	Unbilled Orders	false	This field displays the total amount of orders that have been entered but not yet billed in the specified currency.
unsubscribe	select	false	Unsubscribe from Campaigns	false	This box is checked if this vendor has unsubscribed from your e-mail marketing campaigns. Unsubscribed vendors receive no marketing campaign e-mail. Vendors can unsubscribe to your e-mail marketing campaigns by clicking a link in any campaign e-mail they receive. To resubscribe to e-mail campaigns, a vendor must click the Unsubscribe link on a campaign e-mail message. If you are using the US Edition of NetSuite and you want new vendors to be subscribed by default, an administrator can go to Setup > Marketing > Set Up Marketing and clear the Unsubscribed to Marketing by Default box.
url	url	true	Web Address	false	Enter a URL for this vendor's Web address. When you return to this record for viewing, this address is a link.
vatregnumber	text	false	Tax Reg. Number	false	Enter this vendor's VAT tax registration number.
workcalendar	select	true	Work Calendar	true	Select the work calendar for this vendor.



Sublists

addressbook - Address Book
Internal ID	Type	Label	Required	Help
addressbookaddress	summary	Edit	false	
addressid	text		false	
defaultbilling	checkbox	Default Billing	false	
defaultshipping	checkbox	Default Shipping	false	
internalid	integer		false	
label	text	Label	false	

currency - Currencies
Internal ID	Type	Label	Required	Help
balance	currency	Balance	false	
currency	select	Currency	true	
unbilledorders	currency	Unbilled Orders	false	

currencylist - Currencies
Internal ID	Type	Label	Required	Help
prepaymentbalance	currency	Prepayment Balance	false	

taxregistration - Tax Registrations
Internal ID	Type	Label	Required	Help
address	select	Address	false	
id	text		false	
nexus	select	Nexus	false	
nexuscountry	select	Country	false	
taxregistrationnumber	text	Tax Reg. Number	false	


Transform Types
Target Record Type	Field Defaults
purchaseorder	customform
vendorbill	customform,entity,poids
vendorpayment	customform*/