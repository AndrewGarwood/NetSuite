/**
 * @file src/parse_configurations/vendor/vendorConstants.ts
 */
import { DATA_DIR, mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING } from "../../config";
import { clean, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION } from "../../utils/regex";
import { readJsonFileAsObject as read, validatePath } from "../../utils/io/reading";
import { hasKeys } from "../../utils/typeValidation";
import path from "node:path";

/** `${DATA_DIR}/.constants` */
const CONSTANTS_DIR = path.join(DATA_DIR, '.constants') as string;
/** `${DATA_DIR}/.constants/human_vendors.json` */
const humanVendorsFilePath = path.join(CONSTANTS_DIR, 'human_vendors.json') as string;
validatePath(CONSTANTS_DIR, humanVendorsFilePath);
let jsonObject = read(humanVendorsFilePath) as Record<string, any>;
if (!hasKeys(jsonObject, ['humanVendors'])) {
    mlog.error(`[vendorConstants.ts ERROR]:`,
        TAB+`Invalid JSON structure at 'humanVendorsFilePath'.`,
        TAB+`Expected keys: ['humanVendors']`,
        TAB+`Received keys: ${JSON.stringify(Object.keys(jsonObject))}`,
        TAB+`    File path: '${humanVendorsFilePath}'`
    );
    STOP_RUNNING(1, 'Stopping execution due to missing or malformed data.')
}
export const HUMAN_VENDOR_LIST = jsonObject.humanVendors as string[];
export const HUMAN_VENDORS_TRIMMED = HUMAN_VENDOR_LIST.map(
    (name: string) => clean(name, STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION)
);