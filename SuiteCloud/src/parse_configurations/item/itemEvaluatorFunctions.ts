/**
 * @file src/parse_configurations/item/itemEvaluatorFunctions.ts
 */
import { 
    mainLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL 
} from "../../config";
import { getClassDictionary, getAccountDictionary } from "../../config";
import { isCleanStringOptions, isNonEmptyString } from "../../utils/typeValidation";
import { clean, 
    CleanStringOptions, 
    StringReplaceOptions, 
    StringReplaceParams, StringCaseOptions, 
    extractLeaf, REPLACE_EM_HYPHEN
} from "../../utils/io";
import * as validate from "../../utils/argumentValidation"

