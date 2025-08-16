/**
 * @file src/utils/io/parsers/ParserFactory.ts
 * @description Factory for creating parsing strategy instances
 */

import { ParseStrategy as Parser, ParseStrategyEnum } from "./types/ParseStrategy";
import { StandardParser } from "./StandardParser";
import { GroupedParser } from "./GroupedParser";
import { HierarchyOptions } from "./types/ParseStrategy";

/**
 * @class **`ParserFactory`**
 * Factory for creating appropriate parsing strategy instances
 */
export class ParserFactory {
    /**
     * Creates a parsing strategy instance based on the strategy type
     * @param strategy - The parsing strategy to use
     * @param groupOptions - Optional group options for grouped parsing
     * @returns The appropriate parser instance - {@link Parser}
     */
    static createParser(
        strategy: ParseStrategyEnum, 
        groupOptions?: HierarchyOptions
    ): Parser {
        switch (strategy) {
            case ParseStrategyEnum.STANDARD:
                return new StandardParser();
            case ParseStrategyEnum.GROUPED:
                if (!groupOptions) {
                    throw new Error('[ParserFactory.createParser()] GroupedParser requires groupOptions to be provided');
                }
                return new GroupedParser(groupOptions);
            default:
                throw new Error(`[ParserFactory.createParser()] Unsupported parsing strategy: ${strategy}`);
        }
    }

    /**
     * Determines the best parsing strategy based on available options
     * @param groupOptions - Optional group options
     * @returns **`strategy`** {@link ParseStrategyEnum} | `string`
     * - `ParseStrategyEnum.GROUPED` if `groupOptions` are provided and has valid 'groups' property
     * - `ParseStrategyEnum.STANDARD` `otherwise`
     */
    static recommendStrategy(groupOptions?: HierarchyOptions): ParseStrategyEnum {
        if (groupOptions && groupOptions.groups && groupOptions.groups.length > 0) {
            return ParseStrategyEnum.GROUPED;
        }
        return ParseStrategyEnum.STANDARD;
    }

    /**
     * Gets list of available parsing strategies
     * @returns Array of available strategy names
     */
    static getAvailableStrategies(): ParseStrategyEnum[] {
        return Object.values(ParseStrategyEnum);
    }
}
