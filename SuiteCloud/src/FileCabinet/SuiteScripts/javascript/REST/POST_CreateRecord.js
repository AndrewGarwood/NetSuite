/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName POST_CreateRecord
 * @ProdNScriptId number
 * @ProdDeployId number
 * @SbNScriptId number
 * @SbDeployId number
 */

// import * as record from '@hitc/netsuite-types/N/record.d.ts';

define(['N/record', 'N/log'], (record, log) => {
    /**
     * @TODO : decide if want to take out N/log statements from writeLog() and uncomment them in main functions
     * @type {{timestamp: string, type: string, title: string, details: any}[]} 
     * @see {@link writeLog}(type, title, details)
     * @description return logArray in post response so can process in client
     * e.g. in client write logArray to a json or txt file in a readable format
     * or use logArray to display in a UI component (e.g. table, list, etc.)
     * */
    const logArray = [];

    const post = (/**@type {CreateRecordRequest} */req) => {
        // log.debug('POST (CreateRecordRequest) triggered', req);
        writeLog(LogTypeEnum.DEBUG, 'POST (CreateRecordRequest) triggered', req);
        const recId = processCreateRecordRequest(req);
        if (recId) {
            return { 
                success: true, 
                recordId: recId, 
                message: `Successfully created ${req.recordType} record with ID ${recId}`, 
                logArray 
            };
        } else {
            return { 
                success: false, 
                message: 'Error creating record', 
                logArray 
            };
        }
    }
    /**
     * @param {CreateRecordRequest} createReq {@link CreateRecordRequest}
     * @returns {number} recordId or null if error
     */
    function processCreateRecordRequest(createReq) {
        let {recordType, fieldDict, sublistDict} = createReq;
        if (!recordType || (!fieldDict && !sublistDict)) {
            // log.error('Input Error in Post_BatchCreateRecordRequest.processRecordRequest(createReq)', 'createReq {CreateRecordRequest} is missing required parameters: recordType and one of (fieldDict, sublistDict)');
            writeLog(LogTypeEnum.ERROR, 'Input Error in Post_BatchCreateRecordRequest.processRecordRequest(createReq)', 'createReq {CreateRecordRequest} is missing required parameters: recordType and one of (fieldDict, sublistDict)');
            return null;
        }
        recordType = recordType.toLowerCase();
        if (Object.keys(RecordTypeEnum).includes(recordType.toUpperCase())) {
            recordType = RecordTypeEnum[recordType.toUpperCase()];
        } else if (!Object.values(RecordTypeEnum).includes(recordType)) {
            // log.error('Invalid recordType', `Invalid recordType: ${recordType}. Must be a RecordTypeEnum key or one of RecordTypeEnum's values: ${Object.values(RecordTypeEnum).join(', ')}.`);
            writeLog(LogTypeEnum.ERROR, 'Invalid recordType', `Invalid recordType: ${recordType}. Must be a RecordTypeEnum key or one of RecordTypeEnum's values: ${Object.values(RecordTypeEnum).join(', ')}.`);
            return null;
        }
        try {
            const rec = record.create({ type: recordType });
            /**@type {string[]} */
            const validFieldIds = rec.getFields();
            /**@type {string[]} */
            const validSublistIds = rec.getSublists();
            // log.debug(`Creating ${recordType} record`);
            writeLog(LogTypeEnum.DEBUG, `Creating ${recordType} record`);
            if (fieldDict) {
                if (fieldDict.textFields && Array.isArray(fieldDict.textFields)) {
                    fieldDict.textFields.forEach(({fieldId, text}) => {
                        fieldId = fieldId.toLowerCase();
                        if (!validFieldIds.includes(fieldId)) {
                            // log.error({ title: `Invalid fieldId: ${fieldId}`, details: `Field ID not found in ${recordType} record.` });
                            writeLog(LogTypeEnum.ERROR, `Invalid fieldId: ${fieldId}`, `Field ID not found in ${recordType} record.`);
                            return; // continue to next textField
                        } 
                        rec.setText({ fieldId, text });
                    });
                }
                if (fieldDict.valueFields && Array.isArray(fieldDict.valueFields)) {
                    fieldDict.valueFields.forEach(({fieldId, value}) => {
                        fieldId = fieldId.toLowerCase();
                        if (!validFieldIds.includes(fieldId)) {
                            // log.error({ title: `Invalid fieldId: ${fieldId}`, details: `Field ID not found in ${recordType} record.` });
                            writeLog(LogTypeEnum.ERROR, `Invalid fieldId: ${fieldId}`, `Field ID not found in ${recordType} record.`);
                            return; // continue to next valueField
                        }
                        rec.setValue({ fieldId, value });
                    });
                }
            }
            if (sublistDict) {
                for (let sublistId in Object.keys(sublistDict)) {
                    sublistId = sublistId.toLowerCase();
                    if (validSublistIds.includes(sublistId)) {
                        /**@type {string[]} */
                        const validSublistFieldIds = rec.getSublistFields({ sublistId });
                        // log.debug(`Processing sublistId: ${sublistId}`);
                        writeLog(LogTypeEnum.DEBUG, `Processing sublistId: ${sublistId}`);
                        /**@type {SublistFieldDictionary} */
                        const sublistFieldDict = sublistDict[sublistId];                    
                        if (sublistFieldDict.textFields && Array.isArray(sublistFieldDict.textFields)) {
                            sublistFieldDict.textFields.forEach(({fieldId, line, text}) => {
                                fieldId = fieldId.toLowerCase();
                                if (!validSublistFieldIds.includes(fieldId)) {
                                    // log.error({ title: `Invalid fieldId: ${fieldId}`, details: `Field ID not found in ${recordType} record.` });
                                    writeLog(LogTypeEnum.ERROR, `Invalid fieldId: ${fieldId}`, `Field ID not found in ${recordType} record.`);
                                    return; // continue to next textField
                                }
                                rec.setSublistText({ sublistId, fieldId, line, text });
                            });
                        }
                        if (sublistFieldDict.valueFields && Array.isArray(sublistFieldDict.valueFields)) {
                            sublistFieldDict.valueFields.forEach(({fieldId, line, value}) => {
                                fieldId = fieldId.toLowerCase();
                                if (!validSublistFieldIds.includes(fieldId)) {
                                    // log.error({ title: `Invalid fieldId: ${fieldId}`, details: `Field ID not found in ${recordType} record.` });
                                    writeLog(LogTypeEnum.ERROR, `Invalid fieldId: ${fieldId}`, `Field ID not found in ${recordType} record.`);
                                    return; // continue to next valueField
                                }
                                rec.setSublistValue({ sublistId, fieldId, line, value });
                            });
                        }
                    } else {
                        // log.error({ title: `Invalid sublistId: ${sublistId}`, details: `Sublist ID not found in ${recordType} record.` });
                        writeLog(LogTypeEnum.ERROR, `Invalid sublistId: ${sublistId}`, `Sublist ID not found in ${recordType} record.`);
                        continue;
                    }
                }
            }
            const recId = rec.save();
            // log.audit(`Successfully created ${recordType} record`, { recordId: recId });
            writeLog(LogTypeEnum.AUDIT, `Successfully created ${recordType} record`, { recordId: recId });
            return recId;
        } catch (e) {
            // log.error(`Error creating ${recordType} record`, e);
            writeLog(LogTypeEnum.ERROR, `Error creating ${recordType} record`, e);
            return null;
        }
    }

    /**
     * @enum {string} LogTypeEnum
     */
    const LogTypeEnum = {
        DEBUG: 'debug',
        ERROR: 'error',
        AUDIT: 'audit',
        EMERGENCY: 'emergency',
    };
    /**
     * Calls NetSuite log module and saves pushes log with timestamp to {@link logArray} to return later
     * @reference ~\node_modules\@hitc\netsuite-types\N\log.d.ts
     * @param {LogTypeEnum} type {@link LogTypeEnum}
     * @param {string} title 
     * @param {any} [details]
     * @returns {void} 
     */
    function writeLog(type, title, details) {
        if (!type || !title) {
            log.error('Invalid log', 'type and title are required');
            return;
        }
        if (!Object.values(LogTypeEnum).includes(type)) {
            log.error('Invalid log type', `type must be one of ${Object.values(LogTypeEnum).join(', ')}`);
            return;
        }
        if (type === LogTypeEnum.DEBUG) {
            log.debug(title, details);
        } else if (type === LogTypeEnum.ERROR) {
            log.error(title, details);
        } else if (type === LogTypeEnum.AUDIT) {
            log.audit(title, details);
        } else if (type === LogTypeEnum.EMERGENCY) {
            log.emergency(title, details);
        }
        details = typeof details === 'object' ? JSON.stringify(details, null, 4) : details;
        logArray.push({ timestamp: getCurrentPacificTime(), type, title, details });
    }

    /**
     * Gets the current date and time in Pacific Time
     * @returns {string} The current date and time in Pacific Time
     */
    function getCurrentPacificTime() {
        const currentDate = new Date();
        const pacificTime = currentDate.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
        return pacificTime;
    }

/**
 * @typedef {Object} CreateRecordRequest
 * @property {RecordTypeEnum} recordType - The record type to create, see {@link RecordTypeEnum} (e.g., 'assemblyitem', 'bom', 'bomrevision', 'inventoryitem', 'customer', 'salesorder', 'invoice', etc.)
 * @property {FieldDictionary} [fieldDict] 
 * - {@link FieldDictionary} = { textFields: Array<{@link SetFieldTextOptions}>, valueFields: Array<{@link SetFieldValueOptions}> } 
 * - an object containing field IDs and their corresponding values.
 * @property {Record.<[sublistId: string], SublistFieldDictionary>} [sublistDict] 
 * - Record<[sublistId: string], {@link SublistFieldDictionary}> = { sublistId: { textFields: Array<{@link SetSublistTextOptions}>, valueFields: Array<{@link SetSublistValueOptions}> } }. 
 * - an object containing sublist IDs and their corresponding field IDs and values.
 */


/**
 * @description set a record's field values organized by field type
 * @typedef {Object} FieldDictionary
 * @property {Array.<SetFieldTextOptions>} textFields 
 * - Array<{@link SetFieldTextOptions}> = Array<{fieldId: string, text: string}>. 
 * - For record fields: record.setText(fieldId, text)
 * @property {Array.<SetFieldValueOptions>} valueFields 
 * - Array<{@link SetFieldValueOptions}> = Array<{fieldId: string, value: {@link FieldValue}}>. 
 * - For record fields: record.setValue(fieldId, value)
 */

/**
 * @description set a record's sublist's field values organized by field type
 * @typedef {Object} SublistFieldDictionary
 * @property {Array.<SetSublistTextOptions>} textFields 
 * - Array<{@link SetSublistTextOptions}> = Array<{sublistId: string, fieldId: string, line: number, text: string}>. 
 * - For record sublist fields: rec.setSublistText(sublistId, fieldId, line, text)
 * @property {Array.<SetSublistValueOptions>} valueFields  
 * - Array<{@link SetSublistValueOptions}> = Array<{sublistId: string, fieldId: string, line: number, value: {@link FieldValue}}>. 
 * - For record sublist fields: rec.setSublistValue(sublistId, fieldId, line, value)
 */


/**
 * @typedef {Date | number | number[] | string | string[] | boolean | null} FieldValue 
 * @description The value type must correspond to the field type being set. For example:
 * - Text, Radio and Select fields accept string values.
 * - Checkbox fields accept Boolean values.
 * - Date and DateTime fields accept Date values.
 * - Integer, Float, Currency and Percent fields accept number values.
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 */

/**
 * @typedef {Object} SetFieldValueOptions
 * @property {string} fieldId - The internal ID of a standard or custom field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the field to. 
 * - = {Date | number | number[] | string | string[] | boolean | null}
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 */

/**
 * @typedef {Object} SetFieldTextOptions
 * @property {string} fieldId - The internal ID of a standard or custom field.
 * @property {string} text - The text to set the value to.
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 */

/**
 * @typedef {Object} SetSublistTextOptions
 * @property {string} sublistId - The internal ID of the sublist.
 * @property {string} fieldId - (i.e. sublistFieldId) The internal ID of a standard or custom sublist field.
 * @property {number} line - The line number for the field.
 * @property {string} text - The text to set the value to.
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 */

/**
 * @typedef {Object} SetSublistValueOptions
 * @property {string} sublistId - The internal ID of the sublist.
 * @property {string} fieldId - The internal ID of a standard or custom sublist field.
 * @property {number} line - The line number for the field.
 * @property {FieldValue} value 
 * - The {@link FieldValue} to set the sublist field to.
 * - = {Date | number | number[] | string | string[] | boolean | null}
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 */


/**
 * @enum {string} RecordTypeEnum
 * @readonly
 * @description supported NetSuite API record types As of 4 June 2024
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * 
 * @property {string} ACCOUNT - account
 * @property {string} ACCOUNTING_BOOK - accountingbook
 * @property {string} ACCOUNTING_CONTEXT - accountingcontext
 * @property {string} ACCOUNTING_PERIOD - accountingperiod
 * @property {string} ADV_INTER_COMPANY_JOURNAL_ENTRY - advintercompanyjournalentry
 * @property {string} ALLOCATION_SCHEDULE - allocationschedule
 * @property {string} AMORTIZATION_SCHEDULE - amortizationschedule
 * @property {string} AMORTIZATION_TEMPLATE - amortizationtemplate
 * @property {string} ASSEMBLY_BUILD - assemblybuild
 * @property {string} ASSEMBLY_ITEM - assemblyitem
 * @property {string} ASSEMBLY_UNBUILD - assemblyunbuild
 * @property {string} AUTOMATED_CLEARING_HOUSE - automatedclearinghouse
 * @property {string} BALANCE_TRX_BY_SEGMENTS - balancetrxbysegments
 * @property {string} BILLING_ACCOUNT - billingaccount
 * @property {string} BILLING_CLASS - billingclass
 * @property {string} BILLING_RATE_CARD - billingratecard
 * @property {string} BILLING_REVENUE_EVENT - billingrevenueevent
 * @property {string} BILLING_SCHEDULE - billingschedule
 * @property {string} BIN - bin
 * @property {string} BIN_TRANSFER - bintransfer
 * @property {string} BIN_WORKSHEET - binworksheet
 * @property {string} BLANKET_PURCHASE_ORDER - blanketpurchaseorder
 * @property {string} BOM - bom
 * @property {string} BOM_REVISION - bomrevision
 * @property {string} BONUS - bonus
 * @property {string} BONUS_TYPE - bonustype
 * @property {string} BUDGET_EXCHANGE_RATE - budgetexchangerate
 * @property {string} BULK_OWNERSHIP_TRANSFER - bulkownershiptransfer
 * @property {string} BUNDLE_INSTALLATION_SCRIPT - bundleinstallationscript
 * @property {string} CALENDAR_EVENT - calendarevent
 * @property {string} CAMPAIGN - campaign
 * @property {string} CAMPAIGN_RESPONSE - campaignresponse
 * @property {string} CAMPAIGN_TEMPLATE - campaigntemplate
 * @property {string} CARDHOLDER_AUTHENTICATION - cardholderauthentication
 * @property {string} CASH_REFUND - cashrefund
 * @property {string} CASH_SALE - cashsale
 * @property {string} CHARGE - charge
 * @property {string} CHARGE_RULE - chargerule
 * @property {string} CHECK - check
 * @property {string} CLASSIFICATION - classification
 * @property {string} CLIENT_SCRIPT - clientscript
 * @property {string} CMS_CONTENT - cmscontent
 * @property {string} CMS_CONTENT_TYPE - cmscontenttype
 * @property {string} CMS_PAGE - cmspage
 * @property {string} COMMERCE_CATEGORY - commercecategory
 * @property {string} COMPETITOR - competitor
 * @property {string} CONSOLIDATED_EXCHANGE_RATE - consolidatedexchangerate
 * @property {string} CONTACT - contact
 * @property {string} CONTACT_CATEGORY - contactcategory
 * @property {string} CONTACT_ROLE - contactrole
 * @property {string} COST_CATEGORY - costcategory
 * @property {string} COUPON_CODE - couponcode
 * @property {string} CREDIT_CARD_CHARGE - creditcardcharge
 * @property {string} CREDIT_CARD_REFUND - creditcardrefund
 * @property {string} CREDIT_MEMO - creditmemo
 * @property {string} CURRENCY - currency
 * @property {string} CUSTOMER - customer
 * @property {string} CUSTOMER_CATEGORY - customercategory
 * @property {string} CUSTOMER_DEPOSIT - customerdeposit
 * @property {string} CUSTOMER_MESSAGE - customermessage
 * @property {string} CUSTOMER_PAYMENT - customerpayment
 * @property {string} CUSTOMER_PAYMENT_AUTHORIZATION - customerpaymentauthorization
 * @property {string} CUSTOMER_REFUND - customerrefund
 * @property {string} CUSTOMER_STATUS - customerstatus
 * @property {string} CUSTOMER_SUBSIDIARY_RELATIONSHIP - customersubsidiaryrelationship
 * @property {string} CUSTOM_PURCHASE - custompurchase
 * @property {string} CUSTOM_RECORD - customrecord
 * @property {string} CUSTOM_SALE - customsale
 * @property {string} CUSTOM_TRANSACTION - customtransaction
 * @property {string} DEPARTMENT - department
 * @property {string} DEPOSIT - deposit
 * @property {string} DEPOSIT_APPLICATION - depositapplication
 * @property {string} DESCRIPTION_ITEM - descriptionitem
 * @property {string} DISCOUNT_ITEM - discountitem
 * @property {string} DOWNLOAD_ITEM - downloaditem
 * @property {string} EMAIL_TEMPLATE - emailtemplate
 * @property {string} EMPLOYEE - employee
 * @property {string} EMPLOYEE_CHANGE_REQUEST - employeechangerequest
 * @property {string} EMPLOYEE_CHANGE_REQUEST_TYPE - employeechangerequesttype
 * @property {string} EMPLOYEE_EXPENSE_SOURCE_TYPE - employeeexpensesourcetype
 * @property {string} EMPLOYEE_STATUS - employeestatus
 * @property {string} EMPLOYEE_TYPE - employeetype
 * @property {string} ENTITY_ACCOUNT_MAPPING - entityaccountmapping
 * @property {string} ESTIMATE - estimate
 * @property {string} EXPENSE_AMORTIZATION_EVENT - expenseamortizationevent
 * @property {string} EXPENSE_CATEGORY - expensecategory
 * @property {string} EXPENSE_PLAN - expenseplan
 * @property {string} EXPENSE_REPORT - expensereport
 * @property {string} EXPENSE_REPORT_POLICY - expensereportpolicy
 * @property {string} FAIR_VALUE_PRICE - fairvalueprice
 * @property {string} FINANCIAL_INSTITUTION - financialinstitution
 * @property {string} FIXED_AMOUNT_PROJECT_REVENUE_RULE - fixedamountprojectrevenuerule
 * @property {string} FOLDER - folder
 * @property {string} FORMAT_PROFILE - formatprofile
 * @property {string} FULFILLMENT_REQUEST - fulfillmentrequest
 * @property {string} GENERAL_TOKEN - generaltoken
 * @property {string} GENERIC_RESOURCE - genericresource
 * @property {string} GIFT_CERTIFICATE - giftcertificate
 * @property {string} GIFT_CERTIFICATE_ITEM - giftcertificateitem
 * @property {string} GL_NUMBERING_SEQUENCE - glnumberingsequence
 * @property {string} GLOBAL_ACCOUNT_MAPPING - globalaccountmapping
 * @property {string} GLOBAL_INVENTORY_RELATIONSHIP - globalinventoryrelationship
 * @property {string} GOAL - goal
 * @property {string} IMPORTED_EMPLOYEE_EXPENSE - importedemployeeexpense
 * @property {string} INBOUND_SHIPMENT - inboundshipment
 * @property {string} INTERCOMP_ALLOCATION_SCHEDULE - intercompallocationschedule
 * @property {string} INTER_COMPANY_JOURNAL_ENTRY - intercompanyjournalentry
 * @property {string} INTER_COMPANY_TRANSFER_ORDER - intercompanytransferorder
 * @property {string} INVENTORY_ADJUSTMENT - inventoryadjustment
 * @property {string} INVENTORY_COST_REVALUATION - inventorycostrevaluation
 * @property {string} INVENTORY_COUNT - inventorycount
 * @property {string} INVENTORY_DETAIL - inventorydetail
 * @property {string} INVENTORY_ITEM - inventoryitem
 * @property {string} INVENTORY_NUMBER - inventorynumber
 * @property {string} INVENTORY_STATUS - inventorystatus
 * @property {string} INVENTORY_STATUS_CHANGE - inventorystatuschange
 * @property {string} INVENTORY_TRANSFER - inventorytransfer
 * @property {string} INVENTORY_WORKSHEET - inventoryworksheet
 * @property {string} INVOICE - invoice
 * @property {string} INVOICE_GROUP - invoicegroup
 * @property {string} ISSUE - issue
 * @property {string} ISSUE_PRODUCT - issueproduct
 * @property {string} ISSUE_PRODUCT_VERSION - issueproductversion
 * @property {string} ITEM_ACCOUNT_MAPPING - itemaccountmapping
 * @property {string} ITEM_COLLECTION - itemcollection
 * @property {string} ITEM_COLLECTION_ITEM_MAP - itemcollectionitemmap
 * @property {string} ITEM_DEMAND_PLAN - itemdemandplan
 * @property {string} ITEM_FULFILLMENT - itemfulfillment
 * @property {string} ITEM_GROUP - itemgroup
 * @property {string} ITEM_LOCATION_CONFIGURATION - itemlocationconfiguration
 * @property {string} ITEM_PROCESS_FAMILY - itemprocessfamily
 * @property {string} ITEM_PROCESS_GROUP - itemprocessgroup
 * @property {string} ITEM_RECEIPT - itemreceipt
 * @property {string} ITEM_REVISION - itemrevision
 * @property {string} ITEM_SUPPLY_PLAN - itemsupplyplan
 * @property {string} JOB - job
 * @property {string} JOB_STATUS - jobstatus
 * @property {string} JOB_TYPE - jobtype
 * @property {string} JOURNAL_ENTRY - journalentry
 * @property {string} KIT_ITEM - kititem
 * @property {string} LABOR_BASED_PROJECT_REVENUE_RULE - laborbasedprojectrevenuerule
 * @property {string} LEAD - lead
 * @property {string} LOCATION - location
 * @property {string} LOT_NUMBERED_ASSEMBLY_ITEM - lotnumberedassemblyitem
 * @property {string} LOT_NUMBERED_INVENTORY_ITEM - lotnumberedinventoryitem
 * @property {string} MANUFACTURING_COST_TEMPLATE - manufacturingcosttemplate
 * @property {string} MANUFACTURING_OPERATION_TASK - manufacturingoperationtask
 * @property {string} MANUFACTURING_ROUTING - manufacturingrouting
 * @property {string} MAP_REDUCE_SCRIPT - mapreducescript
 * @property {string} MARKUP_ITEM - markupitem
 * @property {string} MASSUPDATE_SCRIPT - massupdatescript
 * @property {string} MEM_DOC - memdoc
 * @property {string} MERCHANDISE_HIERARCHY_LEVEL - merchandisehierarchylevel
 * @property {string} MERCHANDISE_HIERARCHY_NODE - merchandisehierarchynode
 * @property {string} MERCHANDISE_HIERARCHY_VERSION - merchandisehierarchyversion
 * @property {string} MESSAGE - message
 * @property {string} MFG_PLANNED_TIME - mfgplannedtime
 * @property {string} NEXUS - nexus
 * @property {string} NON_INVENTORY_ITEM - noninventoryitem
 * @property {string} NOTE - note
 * @property {string} NOTE_TYPE - notetype
 * @property {string} OPPORTUNITY - opportunity
 * @property {string} ORDER_RESERVATION - orderreservation
 * @property {string} ORDER_SCHEDULE - orderschedule
 * @property {string} ORDER_TYPE - ordertype
 * @property {string} OTHER_CHARGE_ITEM - otherchargeitem
 * @property {string} OTHER_NAME - othername
 * @property {string} OTHER_NAME_CATEGORY - othernamecategory
 * @property {string} PARTNER - partner
 * @property {string} PARTNER_CATEGORY - partnercategory
 * @property {string} PAYCHECK - paycheck
 * @property {string} PAYCHECK_JOURNAL - paycheckjournal
 * @property {string} PAYMENT_CARD - paymentcard
 * @property {string} PAYMENT_CARD_TOKEN - paymentcardtoken
 * @property {string} PAYMENT_ITEM - paymentitem
 * @property {string} PAYMENT_METHOD - paymentmethod
 * @property {string} PAYROLL_ITEM - payrollitem
 * @property {string} PCT_COMPLETE_PROJECT_REVENUE_RULE - pctcompleteprojectrevenuerule
 * @property {string} PERFORMANCE_METRIC - performancemetric
 * @property {string} PERFORMANCE_REVIEW - performancereview
 * @property {string} PERFORMANCE_REVIEW_SCHEDULE - performancereviewschedule
 * @property {string} PERIOD_END_JOURNAL - periodendjournal
 * @property {string} PHONE_CALL - phonecall
 * @property {string} PICK_STRATEGY - pickstrategy
 * @property {string} PICK_TASK - picktask
 * @property {string} PLANNED_ORDER - plannedorder
 * @property {string} PLANNING_ITEM_CATEGORY - planningitemcategory
 * @property {string} PLANNING_ITEM_GROUP - planningitemgroup
 * @property {string} PLANNING_RULE_GROUP - planningrulegroup
 * @property {string} PLANNING_VIEW - planningview
 * @property {string} PORTLET - portlet
 * @property {string} PRICE_BOOK - pricebook
 * @property {string} PRICE_LEVEL - pricelevel
 * @property {string} PRICE_PLAN - priceplan
 * @property {string} PRICING_GROUP - pricinggroup
 * @property {string} PROJECT_EXPENSE_TYPE - projectexpensetype
 * @property {string} PROJECT_IC_CHARGE_REQUEST - projecticchargerequest
 * @property {string} PROJECT_TASK - projecttask
 * @property {string} PROJECT_TEMPLATE - projecttemplate
 * @property {string} PROMOTION_CODE - promotioncode
 * @property {string} PROSPECT - prospect
 * @property {string} PURCHASE_CONTRACT - purchasecontract
 * @property {string} PURCHASE_ORDER - purchaseorder
 * @property {string} PURCHASE_REQUISITION - purchaserequisition
 * @property {string} REALLOCATE_ITEM - reallocateitem
 * @property {string} RECEIVE_INBOUND_SHIPMENT - receiveinboundshipment
 * @property {string} RESOURCE_ALLOCATION - resourceallocation
 * @property {string} RESTLET - restlet
 * @property {string} RETURN_AUTHORIZATION - returnauthorization
 * @property {string} REVENUE_ARRANGEMENT - revenuearrangement
 * @property {string} REVENUE_COMMITMENT - revenuecommitment
 * @property {string} REVENUE_COMMITMENT_REVERSAL - revenuecommitmentreversal
 * @property {string} REVENUE_PLAN - revenueplan
 * @property {string} REV_REC_FIELD_MAPPING - revrecfieldmapping
 * @property {string} REV_REC_SCHEDULE - revrecschedule
 * @property {string} REV_REC_TEMPLATE - revrectemplate
 * @property {string} SALES_CHANNEL - saleschannel
 * @property {string} SALES_ORDER - salesorder
 * @property {string} SALES_ROLE - salesrole
 * @property {string} SALES_TAX_ITEM - salestaxitem
 * @property {string} SCHEDULED_SCRIPT - scheduledscript
 * @property {string} SCHEDULED_SCRIPT_INSTANCE - scheduledscriptinstance
 * @property {string} SCRIPT_DEPLOYMENT - scriptdeployment
 * @property {string} SERIALIZED_ASSEMBLY_ITEM - serializedassemblyitem
 * @property {string} SERIALIZED_INVENTORY_ITEM - serializedinventoryitem
 * @property {string} SERVICE_ITEM - serviceitem
 * @property {string} SHIP_ITEM - shipitem
 * @property {string} SOLUTION - solution
 * @property {string} STATISTICAL_JOURNAL_ENTRY - statisticaljournalentry
 * @property {string} STORE_PICKUP_FULFILLMENT - storepickupfulfillment
 * @property {string} SUBSCRIPTION - subscription
 * @property {string} SUBSCRIPTION_CHANGE_ORDER - subscriptionchangeorder
 * @property {string} SUBSCRIPTION_LINE - subscriptionline
 * @property {string} SUBSCRIPTION_PLAN - subscriptionplan
 * @property {string} SUBSCRIPTION_TERM - subscriptionterm
 * @property {string} SUBSIDIARY - subsidiary
 * @property {string} SUBSIDIARY_SETTINGS - subsidiarysettings
 * @property {string} SUBTOTAL_ITEM - subtotalitem
 * @property {string} SUITELET - suitelet
 * @property {string} SUPPLY_CHAIN_SNAPSHOT - supplychainsnapshot
 * @property {string} SUPPLY_CHAIN_SNAPSHOT_SIMULATION - supplychainsnapshotsimulation
 * @property {string} SUPPLY_CHANGE_ORDER - supplychangeorder
 * @property {string} SUPPLY_PLAN_DEFINITION - supplyplandefinition
 * @property {string} SUPPORT_CASE - supportcase
 * @property {string} TASK - task
 * @property {string} TAX_ACCT - taxacct
 * @property {string} TAX_GROUP - taxgroup
 * @property {string} TAX_PERIOD - taxperiod
 * @property {string} TAX_TYPE - taxtype
 * @property {string} TERM - term
 * @property {string} TIME_BILL - timebill
 * @property {string} TIME_ENTRY - timeentry
 * @property {string} TIME_OFF_CHANGE - timeoffchange
 * @property {string} TIME_OFF_PLAN - timeoffplan
 * @property {string} TIME_OFF_REQUEST - timeoffrequest
 * @property {string} TIME_OFF_RULE - timeoffrule
 * @property {string} TIME_OFF_TYPE - timeofftype
 * @property {string} TIME_SHEET - timesheet
 * @property {string} TOPIC - topic
 * @property {string} TRANSFER_ORDER - transferorder
 * @property {string} UNITS_TYPE - unitstype
 * @property {string} UNLOCKED_TIME_PERIOD - unlockedtimeperiod
 * @property {string} USAGE - usage
 * @property {string} USEREVENT_SCRIPT - usereventscript
 * @property {string} VENDOR - vendor
 * @property {string} VENDOR_BILL - vendorbill
 * @property {string} VENDOR_CATEGORY - vendorcategory
 * @property {string} VENDOR_CREDIT - vendorcredit
 * @property {string} VENDOR_PAYMENT - vendorpayment
 * @property {string} VENDOR_PREPAYMENT - vendorprepayment
 * @property {string} VENDOR_PREPAYMENT_APPLICATION - vendorprepaymentapplication
 * @property {string} VENDOR_RETURN_AUTHORIZATION - vendorreturnauthorization
 * @property {string} VENDOR_SUBSIDIARY_RELATIONSHIP - vendorsubsidiaryrelationship
 * @property {string} WAVE - wave
 * @property {string} WBS - wbs
 * @property {string} WEBSITE - website
 * @property {string} WORKFLOW_ACTION_SCRIPT - workflowactionscript
 * @property {string} WORK_ORDER - workorder
 * @property {string} WORK_ORDER_CLOSE - workorderclose
 * @property {string} WORK_ORDER_COMPLETION - workordercompletion
 * @property {string} WORK_ORDER_ISSUE - workorderissue
 * @property {string} WORKPLACE - workplace
 * @property {string} ZONE - zone
 */
const RecordTypeEnum = {
    ACCOUNT: 'account',
    ACCOUNTING_BOOK: 'accountingbook',
    ACCOUNTING_CONTEXT: 'accountingcontext',
    ACCOUNTING_PERIOD: 'accountingperiod',
    ADV_INTER_COMPANY_JOURNAL_ENTRY: 'advintercompanyjournalentry',
    ALLOCATION_SCHEDULE: 'allocationschedule',
    AMORTIZATION_SCHEDULE: 'amortizationschedule',
    AMORTIZATION_TEMPLATE: 'amortizationtemplate',
    ASSEMBLY_BUILD: 'assemblybuild',
    ASSEMBLY_ITEM: 'assemblyitem',
    ASSEMBLY_UNBUILD: 'assemblyunbuild',
    AUTOMATED_CLEARING_HOUSE: 'automatedclearinghouse',
    BALANCE_TRX_BY_SEGMENTS: 'balancetrxbysegments',
    BILLING_ACCOUNT: 'billingaccount',
    BILLING_CLASS: 'billingclass',
    BILLING_RATE_CARD: 'billingratecard',
    BILLING_REVENUE_EVENT: 'billingrevenueevent',
    BILLING_SCHEDULE: 'billingschedule',
    BIN: 'bin',
    BIN_TRANSFER: 'bintransfer',
    BIN_WORKSHEET: 'binworksheet',
    BLANKET_PURCHASE_ORDER: 'blanketpurchaseorder',
    BOM: 'bom',
    BOM_REVISION: 'bomrevision',
    BONUS: 'bonus',
    BONUS_TYPE: 'bonustype',
    BUDGET_EXCHANGE_RATE: 'budgetexchangerate',
    BULK_OWNERSHIP_TRANSFER: 'bulkownershiptransfer',
    BUNDLE_INSTALLATION_SCRIPT: 'bundleinstallationscript',
    CALENDAR_EVENT: 'calendarevent',
    CAMPAIGN: 'campaign',
    CAMPAIGN_RESPONSE: 'campaignresponse',
    CAMPAIGN_TEMPLATE: 'campaigntemplate',
    CARDHOLDER_AUTHENTICATION: 'cardholderauthentication',
    CASH_REFUND: 'cashrefund',
    CASH_SALE: 'cashsale',
    CHARGE: 'charge',
    CHARGE_RULE: 'chargerule',
    CHECK: 'check',
    CLASSIFICATION: 'classification',
    CLIENT_SCRIPT: 'clientscript',
    CMS_CONTENT: 'cmscontent',
    CMS_CONTENT_TYPE: 'cmscontenttype',
    CMS_PAGE: 'cmspage',
    COMMERCE_CATEGORY: 'commercecategory',
    COMPETITOR: 'competitor',
    CONSOLIDATED_EXCHANGE_RATE: 'consolidatedexchangerate',
    CONTACT: 'contact',
    CONTACT_CATEGORY: 'contactcategory',
    CONTACT_ROLE: 'contactrole',
    COST_CATEGORY: 'costcategory',
    COUPON_CODE: 'couponcode',
    CREDIT_CARD_CHARGE: 'creditcardcharge',
    CREDIT_CARD_REFUND: 'creditcardrefund',
    CREDIT_MEMO: 'creditmemo',
    CURRENCY: 'currency',
    CUSTOMER: 'customer',
    CUSTOMER_CATEGORY: 'customercategory',
    CUSTOMER_DEPOSIT: 'customerdeposit',
    CUSTOMER_MESSAGE: 'customermessage',
    CUSTOMER_PAYMENT: 'customerpayment',
    CUSTOMER_PAYMENT_AUTHORIZATION: 'customerpaymentauthorization',
    CUSTOMER_REFUND: 'customerrefund',
    CUSTOMER_STATUS: 'customerstatus',
    CUSTOMER_SUBSIDIARY_RELATIONSHIP: 'customersubsidiaryrelationship',
    CUSTOM_PURCHASE: 'custompurchase',
    CUSTOM_RECORD: 'customrecord',
    CUSTOM_SALE: 'customsale',
    CUSTOM_TRANSACTION: 'customtransaction',
    DEPARTMENT: 'department',
    DEPOSIT: 'deposit',
    DEPOSIT_APPLICATION: 'depositapplication',
    DESCRIPTION_ITEM: 'descriptionitem',
    DISCOUNT_ITEM: 'discountitem',
    DOWNLOAD_ITEM: 'downloaditem',
    EMAIL_TEMPLATE: 'emailtemplate',
    EMPLOYEE: 'employee',
    EMPLOYEE_CHANGE_REQUEST: 'employeechangerequest',
    EMPLOYEE_CHANGE_REQUEST_TYPE: 'employeechangerequesttype',
    EMPLOYEE_EXPENSE_SOURCE_TYPE: 'employeeexpensesourcetype',
    EMPLOYEE_STATUS: 'employeestatus',
    EMPLOYEE_TYPE: 'employeetype',
    ENTITY_ACCOUNT_MAPPING: 'entityaccountmapping',
    ESTIMATE: 'estimate',
    EXPENSE_AMORTIZATION_EVENT: 'expenseamortizationevent',
    EXPENSE_CATEGORY: 'expensecategory',
    EXPENSE_PLAN: 'expenseplan',
    EXPENSE_REPORT: 'expensereport',
    EXPENSE_REPORT_POLICY: 'expensereportpolicy',
    FAIR_VALUE_PRICE: 'fairvalueprice',
    FINANCIAL_INSTITUTION: 'financialinstitution',
    FIXED_AMOUNT_PROJECT_REVENUE_RULE: 'fixedamountprojectrevenuerule',
    FOLDER: 'folder',
    FORMAT_PROFILE: 'formatprofile',
    FULFILLMENT_REQUEST: 'fulfillmentrequest',
    GENERAL_TOKEN: 'generaltoken',
    GENERIC_RESOURCE: 'genericresource',
    GIFT_CERTIFICATE: 'giftcertificate',
    GIFT_CERTIFICATE_ITEM: 'giftcertificateitem',
    GL_NUMBERING_SEQUENCE: 'glnumberingsequence',
    GLOBAL_ACCOUNT_MAPPING: 'globalaccountmapping',
    GLOBAL_INVENTORY_RELATIONSHIP: 'globalinventoryrelationship',
    GOAL: 'goal',
    IMPORTED_EMPLOYEE_EXPENSE: 'importedemployeeexpense',
    INBOUND_SHIPMENT: 'inboundshipment',
    INTERCOMP_ALLOCATION_SCHEDULE: 'intercompallocationschedule',
    INTER_COMPANY_JOURNAL_ENTRY: 'intercompanyjournalentry',
    INTER_COMPANY_TRANSFER_ORDER: 'intercompanytransferorder',
    INVENTORY_ADJUSTMENT: 'inventoryadjustment',
    INVENTORY_COST_REVALUATION: 'inventorycostrevaluation',
    INVENTORY_COUNT: 'inventorycount',
    INVENTORY_DETAIL: 'inventorydetail',
    INVENTORY_ITEM: 'inventoryitem',
    INVENTORY_NUMBER: 'inventorynumber',
    INVENTORY_STATUS: 'inventorystatus',
    INVENTORY_STATUS_CHANGE: 'inventorystatuschange',
    INVENTORY_TRANSFER: 'inventorytransfer',
    INVENTORY_WORKSHEET: 'inventoryworksheet',
    INVOICE: 'invoice',
    INVOICE_GROUP: 'invoicegroup',
    ISSUE: 'issue',
    ISSUE_PRODUCT: 'issueproduct',
    ISSUE_PRODUCT_VERSION: 'issueproductversion',
    ITEM_ACCOUNT_MAPPING: 'itemaccountmapping',
    ITEM_COLLECTION: 'itemcollection',
    ITEM_COLLECTION_ITEM_MAP: 'itemcollectionitemmap',
    ITEM_DEMAND_PLAN: 'itemdemandplan',
    ITEM_FULFILLMENT: 'itemfulfillment',
    ITEM_GROUP: 'itemgroup',
    ITEM_LOCATION_CONFIGURATION: 'itemlocationconfiguration',
    ITEM_PROCESS_FAMILY: 'itemprocessfamily',
    ITEM_PROCESS_GROUP: 'itemprocessgroup',
    ITEM_RECEIPT: 'itemreceipt',
    ITEM_REVISION: 'itemrevision',
    ITEM_SUPPLY_PLAN: 'itemsupplyplan',
    JOB: 'job',
    JOB_STATUS: 'jobstatus',
    JOB_TYPE: 'jobtype',
    JOURNAL_ENTRY: 'journalentry',
    KIT_ITEM: 'kititem',
    LABOR_BASED_PROJECT_REVENUE_RULE: 'laborbasedprojectrevenuerule',
    LEAD: 'lead',
    LOCATION: 'location',
    LOT_NUMBERED_ASSEMBLY_ITEM: 'lotnumberedassemblyitem',
    LOT_NUMBERED_INVENTORY_ITEM: 'lotnumberedinventoryitem',
    MANUFACTURING_COST_TEMPLATE: 'manufacturingcosttemplate',
    MANUFACTURING_OPERATION_TASK: 'manufacturingoperationtask',
    MANUFACTURING_ROUTING: 'manufacturingrouting',
    MAP_REDUCE_SCRIPT: 'mapreducescript',
    MARKUP_ITEM: 'markupitem',
    MASSUPDATE_SCRIPT: 'massupdatescript',
    MEM_DOC: 'memdoc',
    MERCHANDISE_HIERARCHY_LEVEL: 'merchandisehierarchylevel',
    MERCHANDISE_HIERARCHY_NODE: 'merchandisehierarchynode',
    MERCHANDISE_HIERARCHY_VERSION: 'merchandisehierarchyversion',
    MESSAGE: 'message',
    MFG_PLANNED_TIME: 'mfgplannedtime',
    NEXUS: 'nexus',
    NON_INVENTORY_ITEM: 'noninventoryitem',
    NOTE: 'note',
    NOTE_TYPE: 'notetype',
    OPPORTUNITY: 'opportunity',
    ORDER_RESERVATION: 'orderreservation',
    ORDER_SCHEDULE: 'orderschedule',
    ORDER_TYPE: 'ordertype',
    OTHER_CHARGE_ITEM: 'otherchargeitem',
    OTHER_NAME: 'othername',
    OTHER_NAME_CATEGORY: 'othernamecategory',
    PARTNER: 'partner',
    PARTNER_CATEGORY: 'partnercategory',
    PAYCHECK: 'paycheck',
    PAYCHECK_JOURNAL: 'paycheckjournal',
    PAYMENT_CARD: 'paymentcard',
    PAYMENT_CARD_TOKEN: 'paymentcardtoken',
    PAYMENT_ITEM: 'paymentitem',
    PAYMENT_METHOD: 'paymentmethod',
    PAYROLL_ITEM: 'payrollitem',
    PCT_COMPLETE_PROJECT_REVENUE_RULE: 'pctcompleteprojectrevenuerule',
    PERFORMANCE_METRIC: 'performancemetric',
    PERFORMANCE_REVIEW: 'performancereview',
    PERFORMANCE_REVIEW_SCHEDULE: 'performancereviewschedule',
    PERIOD_END_JOURNAL: 'periodendjournal',
    PHONE_CALL: 'phonecall',
    PICK_STRATEGY: 'pickstrategy',
    PICK_TASK: 'picktask',
    PLANNED_ORDER: 'plannedorder',
    PLANNING_ITEM_CATEGORY: 'planningitemcategory',
    PLANNING_ITEM_GROUP: 'planningitemgroup',
    PLANNING_RULE_GROUP: 'planningrulegroup',
    PLANNING_VIEW: 'planningview',
    PORTLET: 'portlet',
    PRICE_BOOK: 'pricebook',
    PRICE_LEVEL: 'pricelevel',
    PRICE_PLAN: 'priceplan',
    PRICING_GROUP: 'pricinggroup',
    PROJECT_EXPENSE_TYPE: 'projectexpensetype',
    PROJECT_IC_CHARGE_REQUEST: 'projecticchargerequest',
    PROJECT_TASK: 'projecttask',
    PROJECT_TEMPLATE: 'projecttemplate',
    PROMOTION_CODE: 'promotioncode',
    PROSPECT: 'prospect',
    PURCHASE_CONTRACT: 'purchasecontract',
    PURCHASE_ORDER: 'purchaseorder',
    PURCHASE_REQUISITION: 'purchaserequisition',
    REALLOCATE_ITEM: 'reallocateitem',
    RECEIVE_INBOUND_SHIPMENT: 'receiveinboundshipment',
    RESOURCE_ALLOCATION: 'resourceallocation',
    RESTLET: 'restlet',
    RETURN_AUTHORIZATION: 'returnauthorization',
    REVENUE_ARRANGEMENT: 'revenuearrangement',
    REVENUE_COMMITMENT: 'revenuecommitment',
    REVENUE_COMMITMENT_REVERSAL: 'revenuecommitmentreversal',
    REVENUE_PLAN: 'revenueplan',
    REV_REC_FIELD_MAPPING: 'revrecfieldmapping',
    REV_REC_SCHEDULE: 'revrecschedule',
    REV_REC_TEMPLATE: 'revrectemplate',
    SALES_CHANNEL: 'saleschannel',
    SALES_ORDER: 'salesorder',
    SALES_ROLE: 'salesrole',
    SALES_TAX_ITEM: 'salestaxitem',
    SCHEDULED_SCRIPT: 'scheduledscript',
    SCHEDULED_SCRIPT_INSTANCE: 'scheduledscriptinstance',
    SCRIPT_DEPLOYMENT: 'scriptdeployment',
    SERIALIZED_ASSEMBLY_ITEM: 'serializedassemblyitem',
    SERIALIZED_INVENTORY_ITEM: 'serializedinventoryitem',
    SERVICE_ITEM: 'serviceitem',
    SHIP_ITEM: 'shipitem',
    SOLUTION: 'solution',
    STATISTICAL_JOURNAL_ENTRY: 'statisticaljournalentry',
    STORE_PICKUP_FULFILLMENT: 'storepickupfulfillment',
    SUBSCRIPTION: 'subscription',
    SUBSCRIPTION_CHANGE_ORDER: 'subscriptionchangeorder',
    SUBSCRIPTION_LINE: 'subscriptionline',
    SUBSCRIPTION_PLAN: 'subscriptionplan',
    SUBSCRIPTION_TERM: 'subscriptionterm',
    SUBSIDIARY: 'subsidiary',
    SUBSIDIARY_SETTINGS: 'subsidiarysettings',
    SUBTOTAL_ITEM: 'subtotalitem',
    SUITELET: 'suitelet',
    SUPPLY_CHAIN_SNAPSHOT: 'supplychainsnapshot',
    SUPPLY_CHAIN_SNAPSHOT_SIMULATION: 'supplychainsnapshotsimulation',
    SUPPLY_CHANGE_ORDER: 'supplychangeorder',
    SUPPLY_PLAN_DEFINITION: 'supplyplandefinition',
    SUPPORT_CASE: 'supportcase',
    TASK: 'task',
    TAX_ACCT: 'taxacct',
    TAX_GROUP: 'taxgroup',
    TAX_PERIOD: 'taxperiod',
    TAX_TYPE: 'taxtype',
    TERM: 'term',
    TIME_BILL: 'timebill',
    TIME_ENTRY: 'timeentry',
    TIME_OFF_CHANGE: 'timeoffchange',
    TIME_OFF_PLAN: 'timeoffplan',
    TIME_OFF_REQUEST: 'timeoffrequest',
    TIME_OFF_RULE: 'timeoffrule',
    TIME_OFF_TYPE: 'timeofftype',
    TIME_SHEET: 'timesheet',
    TOPIC: 'topic',
    TRANSFER_ORDER: 'transferorder',
    UNITS_TYPE: 'unitstype',
    UNLOCKED_TIME_PERIOD: 'unlockedtimeperiod',
    USAGE: 'usage',
    USEREVENT_SCRIPT: 'usereventscript',
    VENDOR: 'vendor',
    VENDOR_BILL: 'vendorbill',
    VENDOR_CATEGORY: 'vendorcategory',
    VENDOR_CREDIT: 'vendorcredit',
    VENDOR_PAYMENT: 'vendorpayment',
    VENDOR_PREPAYMENT: 'vendorprepayment',
    VENDOR_PREPAYMENT_APPLICATION: 'vendorprepaymentapplication',
    VENDOR_RETURN_AUTHORIZATION: 'vendorreturnauthorization',
    VENDOR_SUBSIDIARY_RELATIONSHIP: 'vendorsubsidiaryrelationship',
    WAVE: 'wave',
    WBS: 'wbs',
    WEBSITE: 'website',
    WORKFLOW_ACTION_SCRIPT: 'workflowactionscript',
    WORK_ORDER: 'workorder',
    WORK_ORDER_CLOSE: 'workorderclose',
    WORK_ORDER_COMPLETION: 'workordercompletion',
    WORK_ORDER_ISSUE: 'workorderissue',
    WORKPLACE: 'workplace',
    ZONE: 'zone'
};

    return { post };
});


