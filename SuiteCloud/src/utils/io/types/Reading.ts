/**
 * @file src/utils/io/Reading.ts
 */
import {
    StringCaseOptions, StringPadOptions, StringStripOptions
} from "../regex/index"
import { parseExcelForOneToMany } from "../reading"


/**
 * @deprecated
 * @typedefn **`ParseOneToManyOptions`**
 * @property {StringStripOptions} [keyStripOptions] - options for stripping characters from the key
 * @property {StringStripOptions} [valueStripOptions] - options for stripping characters from the value
 * @property {StringCaseOptions} [keyCaseOptions] - options for changing the case of the key
 * @property {StringCaseOptions} [valueCaseOptions] - options for changing the case of the value
 * @property {StringPadOptions} [keyPadOptions] - options for padding values read from the `keyColumn`
 * @property {StringPadOptions} [valuePadOptions] - options for padding values read from the `valueColumn`
 * 
 * - {@link StringStripOptions} = `{ char: string, escape?: boolean, stripLeftCondition?: (s: string, ...args: any[]) => boolean, leftArgs?: any[], stripRightCondition?: (s: string, ...args: any[]) => boolean, rightArgs?: any[] }`
 * - {@link StringCaseOptions}  = `{ toUpper: boolean, toLower: boolean, toTitle: boolean }`
 * - {@link StringPadOptions} = `{ padLength: number, padChar: string, padLeft: boolean, padRight: boolean }`
 * @see {@link parseExcelForOneToMany}
 */
export type ParseOneToManyOptions = {
    keyStripOptions?: StringStripOptions,
    valueStripOptions?: StringStripOptions,
    keyCaseOptions?: StringCaseOptions,
    valueCaseOptions?: StringCaseOptions,
    keyPadOptions?: StringPadOptions,
    valuePadOptions?: StringPadOptions
}

