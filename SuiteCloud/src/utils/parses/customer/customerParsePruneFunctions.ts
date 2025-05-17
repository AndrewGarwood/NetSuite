/**
 * @file src/utils/parses/customer/customerParsePruneFunctions.ts
 */
import { 
    FieldValue,
    FieldDictionary,
    CreateRecordOptions,
    SetFieldValueOptions,
    SetSublistValueOptions,
    SetSubrecordOptions,
    SublistFieldDictionary,
} from "../../api/types";
import { mainLogger as log } from 'src/config/setupLog';
import { isNullLike, RADIO_FIELD_TRUE } from "../../typeValidation";