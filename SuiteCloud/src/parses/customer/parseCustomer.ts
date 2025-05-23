/**
 * @file src/parses/customer/parseCustomer.ts
 * @see {@link parseEntityFile}
 */
import { DATA_DIR } from "src/config/env";
import { parseEntityFile } from "../parseEntity";

/** `${DATA_DIR}/customers` */
export const CUSTOMER_DIR = `${DATA_DIR}/customers` as string;
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