/**
 * @file src/parse_configurations/customer/customerConstants.ts
 */
import path from "node:path";
import { DATA_DIR, CLOUD_LOG_DIR } from "src/config/env";
import { ValueMapping, readJsonFileAsObject as read } from "src/utils/io";

/** `${DATA_DIR}/customers` */
export const CUSTOMER_DIR = `${DATA_DIR}/customers` as string;
/** `${CLOUD_LOG_DIR}/customers` */
export const CUSTOMER_LOG_DIR = `${CLOUD_LOG_DIR}/customers` as string;
/** `${DATA_DIR}/customers/company.tsv` */
export const SINGLE_COMPANY_FILE = `${CUSTOMER_DIR}/company.tsv` as string;
/** `${DATA_DIR}/customers/human.tsv` */
export const SINGLE_HUMAN_FILE = `${CUSTOMER_DIR}/human.tsv` as string;
/** `${DATA_DIR}/customers/subset.tsv` */
export const SUBSET_FILE = `${CUSTOMER_DIR}/subset.tsv` as string;
/**`${DATA_DIR}/customers/small_subset.tsv` */
export const SMALL_SUBSET_FILE = `${CUSTOMER_DIR}/small_subset.tsv` as string;
/** `${DATA_DIR}/customers/customer.tsv` */
export const COMPLETE_FILE = `${CUSTOMER_DIR}/customer.tsv` as string;
/** `${DATA_DIR}/customers/customer_part1.tsv` */
export const FIRST_PART_FILE = `${CUSTOMER_DIR}/customer_part1.tsv` as string;
/** `${DATA_DIR}/customers/customer_part2.tsv` */
export const SECOND_PART_FILE = `${CUSTOMER_DIR}/customer_part2.tsv` as string;
/** `${DATA_DIR}/customers/customer_part3.tsv` */
export const THIRD_PART_FILE = `${CUSTOMER_DIR}/customer_part3.tsv` as string;
/** `${DATA_DIR}/customers/edge_cases.tsv` */
export const EDGE_CASES_FILE = `${CUSTOMER_DIR}/edge_cases.tsv` as string;
/** 
 * maybe this is unnecessary... but I like enums 
 * @enum {string} **`CustomerColumnEnum`**
 * */
export enum CustomerColumnEnum {
    ENTITY_ID = 'Customer',
    CATEGORY = 'Customer Type',
    FIRST_NAME = 'First Name',
    MIDDLE_NAME = 'M.I.',
    LAST_NAME = 'Last Name',
    SALUTATION = 'Mr./Ms./...',
    WEBSITE = 'Website',
    COMPANY = 'Company',
    PRIMARY_CONTACT = 'Primary Contact',
    SECONDARY_CONTACT = 'Secondary Contact',
    WORK_PHONE = 'Work Phone',
    PHONE = 'Main Phone',
    HOME_PHONE = 'Home Phone',
    MOBILE_PHONE = 'Mobile',
    FAX = 'Fax',
    ALT_PHONE = 'Alt. Phone',
    ALT_MOBILE = 'Alt. Mobile',
    ALT_FAX = 'Alt. Fax',
    EMAIL = 'Main Email',
    ALT_EMAIL = 'Alt. Email 1',
    CC_EMAIL = 'CC Email',
    TERMS = 'Terms',
    ACCOUNT_NUMBER = 'Account No.',
    STREET_ONE = 'Street1',
    STREET_TWO = 'Street2',
    CITY = 'City',
    STATE = 'State',
    ZIP = 'Zip',
    COUNTRY = 'Country',
    SHIP_TO_STREET_ONE = 'Ship To Street1',
    SHIP_TO_STREET_TWO = 'Ship To Street2',
    SHIP_TO_CITY = 'Ship To City',
    SHIP_TO_STATE = 'Ship To State',
    SHIP_TO_ZIP = 'Ship To Zip',
    SHIP_TO_COUNTRY = 'Ship To Country',
    BILL_TO_ONE = 'Bill to 1',
    BILL_TO_TWO = 'Bill to 2',
    BILL_TO_THREE = 'Bill to 3',
    BILL_TO_FOUR = 'Bill to 4',
    BILL_TO_FIVE = 'Bill to 5',
    SHIP_TO_ONE = 'Ship to 1',
    SHIP_TO_TWO = 'Ship to 2',
    SHIP_TO_THREE = 'Ship to 3',
    SHIP_TO_FOUR = 'Ship to 4',
    SHIP_TO_FIVE = 'Ship to 5',
    COMMENTS = 'Note',
    TITLE = 'Job Title',
    CLASS = 'Class',
}

const filePath = path.join(DATA_DIR, '.constants', 'customer_constants.json');
export const CUSTOMER_CONSTANTS = read(filePath);
if (!CUSTOMER_CONSTANTS || typeof CUSTOMER_CONSTANTS !== 'object') {
    throw new Error(
        `Invalid or missing customer_constants.json file. received: '${filePath}'`
    );
}

export const CUSTOMER_CATEGORY_MAPPING: ValueMapping = CUSTOMER_CONSTANTS.CUSTOMER_CATEGORY_MAPPING;
if (!CUSTOMER_CATEGORY_MAPPING || typeof CUSTOMER_CATEGORY_MAPPING !== 'object') {
    throw new Error(
        `Invalid or missing 'CUSTOMER_CATEGORY_MAPPING' from file at '${filePath}'`
    );
}