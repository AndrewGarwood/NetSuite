/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName GET_RetrieveRecordById
 * @ProdNScriptId 
 * @ProdDeployId 
 * @SbNScriptId 171
 * @SbDeployId 1
 */

define(['N/search', 'N/log'], (search, log) => {
    /**
     * @type {LogStatement[]} - `Array<`{@link LogStatement}`>` = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
     * @see {function} {@link writeLog}`(type, title, ...details)`
     * */
    const logArray = [];
    /**
     * @param {RetrieveRecordByIdRequest} reqParams = `{recordType`: string, `name`: string` }`
     * @param {RecordTypeEnum | string} reqParams.recordType - The type of the record to retrieve.
     * @param {idPropertyEnum | string} reqParams.idProperty - The property to search for the record.
     * @param {string} reqParams.searchTerm - The name of the record to search for.
     * @returns {RetrieveRecordByIdResponse} - {@link RetrieveRecordByIdResponse} = `{success`: boolean, `message`: string, `internalId`: string | number` }`
     */
    const get = (/**@type {RetrieveRecordByIdRequest}*/reqParams) => {
        let { recordType, idProperty, searchTerm } = reqParams;
        if (!recordType || !searchTerm) {
            writeLog(LogTypeEnum.ERROR, 'Invalid request', 'recordType and name are required');
            throw new Error('recordType and name are required');
        }
        idProperty = idProperty ? idProperty.toLowerCase() : idPropertyEnum.NAME;
        recordType = recordType.toLowerCase();
        if (Object.keys(idPropertyEnum).includes(idProperty.toUpperCase())) {
            idProperty = idPropertyEnum[idProperty.toUpperCase()];
        } else if (!Object.values(idPropertyEnum).includes(idProperty)) {
            log.error({ title: 'Invalid idProperty', details: `Invalid idProperty: ${idProperty}. Must be an idPropertyEnum key or one of idPropertyEnum's values: ${Object.values(idPropertyEnum).join(', ')}.` });
            throw new Error(`Invalid idProperty: ${idProperty}. Must be an idPropertyEnum key or one of idPropertyEnum's values: ${Object.values(idPropertyEnum).join(', ')}.`); 
        }
        if (Object.keys(RecordTypeEnum).includes(recordType.toUpperCase())) {
            recordType = RecordTypeEnum[recordType.toUpperCase()];
        } else if (!Object.values(RecordTypeEnum).includes(recordType)) {
            writeLog(LogTypeEnum.ERROR, 'Invalid recordType', `recordType must be a RecordTypeEnum key or one of ${Object.values(RecordTypeEnum).join(', ')}`);
            throw new Error(`Invalid recordType: ${recordType}. Must be a RecordTypeEnum key or one of RecordTypeEnum's values: ${Object.values(RecordTypeEnum).join(', ')}.`);
        }
        let internalId = undefined;
        try {
            search.create({
                type: recordType,
                filters: [
                    [idProperty, 'is', searchTerm]
                ],
                columns: [idProperty]
            }).run().each(result => {
                internalId = result.id;
                return false; // Stop after the first result
            });
        } catch (e) {
            writeLog(LogTypeEnum.ERROR, 'Error executing search.create({...})', e);
            throw new Error(`Error executing search.create({...}): ${e.message}`);
        }
        /**@type {RetrieveRecordByIdResponse} see {@link RetrieveRecordByIdResponse} */
        const response = {
            success: false,
            message: `No ${recordType} record found with ${idProperty} == '${searchTerm}'`,
            internalId: undefined
        }
        if (internalId) {
            writeLog(LogTypeEnum.AUDIT, 'Record found', `Record found with ${idProperty}: ${internalId}`);
            response.message = `${recordType} record found with ${idProperty} == '${searchTerm}', record.internalid=${internalId}`;
            response.success = true;
            response.internalId = internalId;
            return response;
        } else {
            writeLog(LogTypeEnum.DEBUG, 'Record not found', `No ${recordType} record found with ${idProperty} == '${searchTerm}'`);
            return response;
        }
    }

    /**
     * Calls NetSuite log module and pushes log with timestamp={@link getCurrentPacificTime}() to {@link logArray} to return at end of post request.
     * @reference ~\node_modules\@hitc\netsuite-types\N\log.d.ts
     * @param {LogTypeEnum} type {@link LogTypeEnum}
     * @param {string} title 
     * @param {any} [details]
     * @returns {void} 
     */
    function writeLog(type, title, ...details) {
        if (!type || !title) {
            log.error('Invalid log', 'type and title are required');
            return;
        }
        if (!Object.values(LogTypeEnum).includes(type)) {
            log.error('Invalid log type', `type must be one of ${Object.values(LogTypeEnum).join(', ')}`);
            return;
        }
        const payload = details
            .map(d => (typeof d === 'string' ? d : JSON.stringify(d, null, 4)))
            .join(' ');
            switch (type) {
                case LogTypeEnum.DEBUG:
                    log.debug(title, payload);
                    break;
                case LogTypeEnum.ERROR:
                    log.error(title, payload);
                    break;
                case LogTypeEnum.AUDIT:
                    log.audit(title, payload);
                    break;
                case LogTypeEnum.EMERGENCY:
                    log.emergency(title, payload);
                    break;
            }
        logArray.push({ timestamp: getCurrentPacificTime(), type, title, details, message: payload });
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
 * @typedef {Object} RetrieveRecordByIdRequest
 * @property {RecordTypeEnum} recordType - The type of the record to retrieve. see {@link RecordTypeEnum}
 * @property {idPropertyEnum} idProperty - The property to search for the record. see {@link idPropertyEnum}
 * @property {string} searchTerm - The name of the record to search for.
 */

/**
 * @typedef {Object} RetrieveRecordByIdResponse
 * @property {boolean} success - Whether the record was found or not.
 * @property {string} message - The message to return.
 * @property {string | number} [internalId] - The internal ID of the record, if found.
 */

/**
 * @enum {string} `idPropertyEnum`
 * @property {string} INTERNAL_ID - The internal ID of the record. fieldId = `internalid`
 * @property {string} EXTERNAL_ID - The external ID of the record. fieldId = `externalid`
 * @property {string} ENTITY_ID - The entity ID of the record. appears on vendor and contact records. fieldId = `entityid`
 * @property {string} NAME - The name of the record.
 * @readonly
 */
const idPropertyEnum = {
    INTERNAL_ID: 'internalid',
    EXTERNAL_ID: 'externalid',
    ENTITY_ID: 'entityid',
    NAME: 'name'
};

/**
 * @enum {string} `LogTypeEnum`
 * @description `Enum` for NetSuite's log module types
 * @property {string} DEBUG - Debug log type
 * @property {string} ERROR - Error log type
 * @property {string} AUDIT - Audit log type
 * @property {string} EMERGENCY - Emergency log type
 * @readonly
 */
const LogTypeEnum = {
    DEBUG: 'debug',
    ERROR: 'error',
    AUDIT: 'audit',
    EMERGENCY: 'emergency',
};
/**
 * - typeof elements of the {@link logArray} array
 * @typedef {Object} LogStatement
 * @property {string} timestamp - The timestamp of the log entry.
 * @property {LogTypeEnum} type - The type of log entry (see {@link LogTypeEnum}).
 * @property {string} title - The title of the log entry.
 * @property {any} details - The details of the log entry.
 * @property {string} message - The message of the log entry = concatenated string of details's contents (if details is an array).
 */



/**
 * @enum {string} **`RecordTypeEnum`**
 * @readonly
 * @description supported NetSuite API record types As of 4 June 2024
 * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 *  */
const RecordTypeEnum = { // As of 4 June 2024
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
    return { get };
});