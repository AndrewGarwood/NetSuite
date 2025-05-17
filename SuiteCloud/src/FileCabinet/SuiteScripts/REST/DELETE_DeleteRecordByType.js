/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NScriptName DELETE_DeleteRecordByType
 * @ProdNScriptId NOT_DEPLOYED
 * @ProdDeployId NOT_DEPLOYED
 * @SbNScriptId NOT_DEPLOYED
 * @SbDeployId NOT_DEPLOYED
 */

// @TODO add prop to DeleteRecordByTypeRequest to specify exceptions that should not be deleted

define(['N/record', 'N/log', 'N/search'], (record, log, search) => {
    /**
     * @type {LogStatement[]} - `Array<`{@link LogStatement}`>` = `{ timestamp`: string, `type`: {@link LogTypeEnum}, `title`: string, `details`: any, `message`: string` }[]`
     * @see {@link writeLog}`(type, title, ...details)`
     * @description return logArray in post response so can process in client
     * */
    const logArray = [];

    /**
     * @param {DeleteRecordByTypeRequest} reqBody {@link DeleteRecordByTypeRequest} - The request body for the delete record by type operation.
     * @param {string} reqBody.recordType - The type of the record to delete ({@link RecordTypeEnum}).
     * @param {DeleteExcludeOptions} [reqBody.excludeOptions] - The options ({@link DeleteExcludeOptions}) for excluding records from deletion.
     * @param {number} [reqBody.maxDeletions] - The maximum number of records to delete. If omitted, all records of the specified type will be deleted.
     * @param {string | string[]} [reqBody.responseProps] - The properties to include in the response in addition to the records' internal IDs.
     * @returns {DeleteRecordByTypeResponse} `response` The response object containing the results of the delete operation.
     * - {@link DeleteRecordByTypeResponse} = `{ success`: boolean, `message`: string, `results`: {@link DeleteRecordResult}`[]`, `error`: string, `logArray`: {@link LogStatement}`[] }`
     * - {@link DeleteRecordResult} = `{ recordType`: {@link RecordTypeEnum}, `internalId`: number, `[fieldId: string]`: {@link FieldValue}` }`
     */
    const doDelete = (/**@type {DeleteRecordByTypeRequest} see {@link DeleteRecordByTypeRequest} */reqBody) => {
        let { recordType, excludeOptions, maxDeletions, responseProps } = reqBody;
        if (!recordType || typeof recordType !== 'string') {
            writeLog(LogTypeEnum.ERROR, 'Invalid record type', '"recordType": string is required');
            return { success: false, message: 'body param "recordType": string is required', results: [], logArray };
        }
        if (maxDeletions && (typeof maxDeletions !== 'number' || maxDeletions <= 0)) {
            writeLog(LogTypeEnum.ERROR, 'Invalid maxDeletions', '"maxDeletions": number > 0 is required');
            return { success: false, message: 'body param "maxDeletions": number > 0 is required', results: [], logArray };
        }
        if (responseProps && typeof responseProps !== 'string' && !Array.isArray(responseProps)) {
            writeLog(LogTypeEnum.ERROR, 'Invalid responseProps', '"responseProps": string | string[] must be a string or an array of strings');
            return { success: false, message: 'body param "responseProps": string | string[] must be a string or an array of strings', results: [], logArray };
        }
        recordType = recordType.toLowerCase();
        if (Object.keys(RecordTypeEnum).includes(recordType.toUpperCase())) {
            recordType = RecordTypeEnum[recordType.toUpperCase()];
        } else if (!Object.values(RecordTypeEnum).includes(recordType)) {
            writeLog(
                LogTypeEnum.ERROR, 'Invalid recordType', 
                `Invalid recordType: '${recordType}'. Must be a RecordTypeEnum key or one of RecordTypeEnum's values: ${Object.values(RecordTypeEnum).join(', ')}.`
            );
            return { success: false, message: `Invalid recordType: '${recordType}'. Must be a RecordTypeEnum key or one of RecordTypeEnum's values: ${Object.values(RecordTypeEnum).join(', ')}.`, results: [], logArray };
        }
        /**@type {number[]} array of internalIds to call rec = record.load({ type: recordType, id: internalId }), rec.getValue(for all responseProps), then rec.deleteRecord()*/
        const recordsToDelete = [];
        try {
            search.create({type: recordType, filters: []}).run().each((result) => {
                let internalId = result.id;
                if (canDelete(internalId, recordType, excludeOptions)) {
                    recordsToDelete.push(internalId);
                } else {
                    writeLog(LogTypeEnum.AUDIT, 
                        'Record excluded from deletion', 
                        `Record ${internalId} of type ${recordType} is excluded from deletion`);
                }
            });
        } catch (e) {
            writeLog(
                LogTypeEnum.ERROR, 
                `Error searching for records to delete, recordType: '${recordType}'`, 
                e.message, 
                e.stack
            );
            return { success: false, message: `Error searching for records of type ${recordType}`, error: e.message, results: [], logArray };
        }
        writeLog(LogTypeEnum.AUDIT, `Found ${recordsToDelete.length} ${recordType}(s) to delete`, 
            `Found ${recordsToDelete.length} ${recordType}(s) to delete`);
        if (recordsToDelete.length === 0) {
            writeLog(LogTypeEnum.AUDIT, 'No records to delete', `No records of type ${recordType} to delete`);
            return { success: true, message: `No records of type ${recordType} to delete`, results: [], logArray };
        }
        /**
         * @type {DeleteRecordResult[]} = `Array<`{@link DeleteRecordResult}`>` 
         * - = `{ internalId`: number , `recordType`: {@link RecordTypeEnum}, `[fieldId]`: {@link FieldValue}` }[]` 
         * */
        const resultArray = [];
        /**@type {DeleteRecordByTypeResponse} = `{ success`: boolean, `message`: string, `results`: `Array<`{@link DeleteRecordResult}`>`, `error`?: string, `logArray`: `Array<`{@link LogStatement}`> }` */
        const response = {};
        const maxDeletionsToProcess = Math.min(maxDeletions || recordsToDelete.length, recordsToDelete.length);
        for (let i = 0; i < maxDeletionsToProcess; i++) {
            const internalId = recordsToDelete[i];
            try {
                const rec = record.load({ type: recordType, id: internalId });
                /**@type {DeleteRecordResult} */
                const result = { internalId, recordType };
                if (responseProps && typeof responseProps === 'string') {
                    result[responseProps] = rec.getValue({ fieldId: responseProps });
                } else if (responseProps && Array.isArray(responseProps)) {
                    for (const prop of responseProps) {
                        result[prop] = rec.getValue({ fieldId: prop });
                    }
                }
                resultArray.push(result);
                rec.deleteRecord();
                writeLog(LogTypeEnum.AUDIT, 'Record deleted successfully', `Record ${internalId} of type ${recordType} deleted`);
            } catch (e) {
                writeLog(
                    LogTypeEnum.ERROR, 
                    `Error deleting record ${internalId} of type ${recordType}`, 
                    e.message, 
                    e.stack
                );
                return { 
                    success: false, 
                    message: `Error deleting record ${internalId} of type ${recordType}`, 
                    error: e.message, 
                    results: resultArray, 
                    logArray 
                };
            }
        }
        response.message = `Deleted ${recordType} ${resultArray.length} records.`;
        response.results = resultArray;
        response.logArray = logArray;
        return response;
    }
    /**
     * 
     * @param {number} id 
     * @param {RecordTypeEnum} recordType 
     * @param {DeleteExcludeOptions} excludeOptions 
     * @returns {boolean} `canDelete` = `true` if the record can be deleted, `false` otherwise
     */
    function canDelete(id, recordType, excludeOptions) {
        if (typeof id !== 'number') {
            writeLog(
                LogTypeEnum.ERROR, 
                `canDelete() Invalid id for recordType '${recordType}'`, 
                `id must be a number. received type: '${typeof id}'`, 
                `id: ${JSON.stringify(id)}`,
            );
            return false;
        }
        if (id < 0) return false;
        if (!excludeOptions) return true;
        if (excludeOptions.excludeIds) {
            if (Array.isArray(excludeOptions.excludeIds)) {
                return !excludeOptions.excludeIds.includes(id);
            } else if (typeof excludeOptions.excludeIds === 'number') {
                return excludeOptions.excludeIds !== id;
            } else {
                writeLog(
                    LogTypeEnum.ERROR, 
                    `canDelete() Invalid excludeIds for recordType: '${recordType}'`, 
                    `excludeIds must be a number or an array of numbers. received type: '${typeof excludeOptions.excludeIds}'`, 
                    `excludeIds: ${JSON.stringify(excludeOptions.excludeIds)}`,
                );
                return false;
            }
        }
        if (excludeOptions.idExcludeRange) {
            const { lowerBound = 200, upperBound } = excludeOptions.idExcludeRange;
            if (lowerBound && typeof lowerBound === 'number' && !upperBound) {
                return id >= lowerBound;
            }
            if (typeof lowerBound !== 'number' || (upperBound && typeof upperBound !== 'number')) {
                writeLog(
                    LogTypeEnum.ERROR, 
                    `canDelete() Invalid idExcludeRange for recordType: '${recordType}'`, 
                    `idExcludeRange must be an object with properties lowerBound?: number and upperBound?: number.`, 
                    `idExcludeRange: ${JSON.stringify(excludeOptions.idExcludeRange)}`,
                );
                return false;
            } else if (lowerBound < 0 || (upperBound && upperBound < 0)) {
                writeLog(
                    LogTypeEnum.ERROR,
                    `canDelete() Invalid idExcludeRange for recordType: '${recordType}'`,
                    `idExcludeRange.lowerBound and upperBound must be positive numbers`,
                    `idExcludeRange: ${JSON.stringify(excludeOptions.idExcludeRange)}`,
                );
                return false;
            } else if (upperBound && lowerBound > upperBound) {
                writeLog(
                    LogTypeEnum.ERROR,
                    `canDelete() Invalid idExcludeRange for recordType: '${recordType}'`,
                    `idExcludeRange must be an object with lowerBound and upperBound properties. received type: '${typeof excludeOptions.idExcludeRange}'`,
                    `idExcludeRange: ${JSON.stringify(excludeOptions.idExcludeRange)}`,
                );
                return false;
            }
            const idIsWithinExcludeRange = id >= lowerBound && (!upperBound || id <= upperBound);
            return !(idIsWithinExcludeRange);
        }
        return false;
    }


    /**
     * Calls NetSuite log module and pushes log with `timestamp`={@link getCurrentPacificTime}`()` to {@link logArray} to return at end of post request.
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
 * @typedef {Object} DeleteRecordByTypeRequest
 * @property {RecordTypeEnum} recordType - The type of the record to delete (see {@link RecordTypeEnum}).
 * @property {DeleteExcludeOptions} [excludeOptions] - The options ({@link DeleteExcludeOptions}) for excluding records from deletion.
 * @property {number} [maxDeletions] - The maximum number of records to delete. If omitted, all records of the specified type will be deleted.
 * @property {string | string[]} [responseProps] - `string | string[]` - The properties to include in the response in addition to the records' internal IDs.
 */

/**
 * @TODO use {@link idPropertyEnum} to specify which id property to use checking if a record is an exception.
 * @typedef {Object} DeleteExcludeOptions
 * @property {number | number[]} [excludeIds] - The internalId(s) of the record to exclude from deletion.
 * @property {{lowerBound?: number; upperBound?: number | undefined}} [idExcludeRange] - Do NOT delete record if `lowerBound <= record.internalId <= upperBound`. `idExclusionRange.lowerBound`.
 */


/**
 * - {@link DeleteRecordByTypeResponse.results} - The internalIds of the deleted recrods and any additional properties specified in {@link DeleteRecordByTypeRequest.responseProps}.
 * @typedef {Object} DeleteRecordByTypeResponse
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} message - A message indicating the result of the request.
 * @property {DeleteRecordResult[]} results - The internalIds of the deleted recrods and any additional properties specified in {@link DeleteRecordByTypeRequest.responseProps}.
 * @property {string} [error] - An error message if the request was not successful.
 * @property {LogStatement[]} logArray - an `Array<`{@link LogStatement}`>` generated during the request processing.
 */

/**
 * @typedef {{
 * recordType: RecordTypeEnum | string; 
 * internalId: number; 
 * [fieldId: string]: FieldValue;
 * }} DeleteRecordResult
 */

/**
 * @typedef {Object} LogStatement
 * @property {string} timestamp - The timestamp of the log entry.
 * @property {LogTypeEnum} type - The type of log entry (see {@link LogTypeEnum}).
 * @property {string} title - The title of the log entry.
 * @property {any} details - The details of the log entry.
 * @property {string} message - The message of the log entry = concatenated string of details's contents (if details is an array).
 * @description typedef for elements of the {@link logArray} array
 */

/**
 * @enum {string} `LogTypeEnum`
 * @description `Enum` for NetSuite's log module types
 * @property {string} DEBUG - `Debug` log type
 * @property {string} ERROR - `Error` log type
 * @property {string} AUDIT - `Audit` log type
 * @property {string} EMERGENCY - `Emergency` log type
 * @readonly
 */
const LogTypeEnum = {
    DEBUG: 'debug',
    ERROR: 'error',
    AUDIT: 'audit',
    EMERGENCY: 'emergency',
};

// FieldValue
/**
 * The value type must correspond to the field type being set. For example:
 * - Text, Radio and Select fields accept `string` values.
 * - Checkbox fields accept `Boolean` values.
 * - Date and DateTime fields accept `Date` values.
 * - Integer, Float, Currency and Percent fields accept `number` values.
 * \@reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
 * @typedef {Date | number | number[] | string | string[] | boolean | null} FieldValue 
 */

/**
 * @enum {string} **`idPropertyEnum`**
 * @property {string} INTERNAL_ID - The `internalid` (for all records).
 * @property {string} EXTERNAL_ID - The `externalid` (for all records).
 * @property {string} ENTITY_ID - The `entityid` (for relationship records)
 * @property {string} ITEM_ID - The `itemid` (for inventory records)
 * @readonly
 */
const idPropertyEnum = {
    /**`'internalid'` */
    INTERNAL_ID: 'internalid',
    /**`'externalid'` */
    EXTERNAL_ID: 'externalid',
    /**`'entityid'` (for relationship records) */
    ENTITY_ID: 'entityid',
    /**`'itemid'` (for inventory records) */
    ITEM_ID: 'itemid',
};




    /**
     * @enum {string} `RecordTypeEnum`
     * @readonly
     * @reference ~\node_modules\@hitc\netsuite-types\N\record.d.ts
     */
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
    return { 
        delete: doDelete 
    };
});