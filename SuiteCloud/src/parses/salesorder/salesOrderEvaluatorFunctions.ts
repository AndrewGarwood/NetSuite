/**
 * @file src/parses/salesorder/salesOrderEvaluatorFunctions.ts
 */
import { 
    CustomerStatusEnum,
    FieldValue,
} from "../../utils/api/types";
import { parseLogger as plog, mainLogger as mlog, DEBUG_LOGS } from "../../config";
import { RADIO_FIELD_TRUE, RADIO_FIELD_FALSE } from "../../utils/typeValidation";
import { 
    checkForOverride,
    cleanString,
    STRIP_DOT_IF_NOT_END_WITH_ABBREVIATION,
    ValueMapping, equivalentAlphanumericStrings as equivalentAlphanumeric, 
} from "../../utils/io";
import { isPerson, firstName, middleName, lastName, entityId } from "../evaluatorFunctions";
import { SalesOrderColumnEnum as C } from "./salesOrderConstants";

export const externalId = (row: Record<string, any>, ...idColumns: string[]): string => {
    return '';
}