/**
 * @file src/misc.ts
 * @description someone from other team needs help with task.
 */
import * as fs from "fs";
import path from "node:path";
import { DATA_DIR, LOCAL_LOG_DIR, ONE_DRIVE_DIR, } from "./config";
import { 
    STOP_RUNNING, DELAY, 
    miscLogger as mlog, INDENT_LOG_LINE as TAB, NEW_LINE as NL, MISC_LOG_FILEPATH
} from "./config";
import {
    readJsonFileAsObject as read,
    writeObjectToJson as write,
    writeRowsToCsv as writeRows,
    trimFile, clearFile, 
    getCurrentPacificTime,
    formatDebugLogFile, 
    concatenateFiles,
    getRows,
    getColumnValues,
    getIndexedColumnValues, validatePath,
    indentedStringify
} from "./utils/io";
import { equivalentAlphanumericStrings, CleanStringOptions, clean, 
    stringContainsAnyOf, RegExpFlagsEnum } from "./utils/regex";
import { SalesOrderColumnEnum } from "./parse_configurations/salesorder/salesOrderConstants";
import { CustomerColumnEnum } from "./parse_configurations/customer/customerConstants";
import { hasKeys, isIntegerArray, isNonEmptyArray } from "./utils/typeValidation";
import * as validate from "./utils/argumentValidation";
import { search as fuzzySearch, MatchData } from "fast-fuzzy";

enum SourceColumnEnum {
    ENTITY = 'Entity',
    ADDRESS = 'Address'
}

const ENT_TOLERANCE = 0.9;
const ADDR_TOLERANCE = 0.8;

async function main(): Promise<void> {
    const source = `[misc.main()]`
    clearFile(MISC_LOG_FILEPATH);
    mlog.info(`${source} START at ${getCurrentPacificTime()}`);

    // await searchInCustomers();
    /*
    > Pause
        •      num unique ents:  48
        • num unique addresses:  39
    */

    trimFile(5, MISC_LOG_FILEPATH);
    formatDebugLogFile(MISC_LOG_FILEPATH);
    STOP_RUNNING(0);
}

main().catch(error => {
    mlog.error(`ERROR [misc.main()]:`, JSON.stringify(error as any));
    STOP_RUNNING(1);
});


async function searchInCustomers(): Promise<void> {
    const source = `[misc.searchInCustomers()]`
    const entFile = path.join(DATA_DIR, 'reports', 'client_entity_list.tsv');
    const customerFile = path.join(DATA_DIR, 'customers', 'customer.tsv');
    validate.multipleExistingFileArguments(source, '.tsv', {customerFile, entFile})
    
    const indexedMatches: { [matchedEntity: string]: number[] } = {};
    const customerRows = await getRows(customerFile);
    const entRows = await getRows(entFile);
    const targetEntDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ENTITY);
    const targetAddressDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ADDRESS);
    
    mlog.debug([`Pause`, 
        `     num unique ents:  ${Object.keys(targetEntDict).length}`,
        `num unique addresses:  ${Object.keys(targetAddressDict).length}`,
        ].join(TAB),
    );
    STOP_RUNNING(1);
    const POTENTIAL_ENT_COLUMNS = [
        CustomerColumnEnum.PRIMARY_CONTACT, 
        CustomerColumnEnum.ENTITY_ID, 
        CustomerColumnEnum.STREET_ONE, CustomerColumnEnum.STREET_TWO, 
        CustomerColumnEnum.BILL_TO_ONE, CustomerColumnEnum.BILL_TO_TWO,
        CustomerColumnEnum.SHIP_TO_STREET_ONE, CustomerColumnEnum.SHIP_TO_STREET_TWO, 
        CustomerColumnEnum.SHIP_TO_ONE, CustomerColumnEnum.SHIP_TO_TWO, 
        CustomerColumnEnum.SECONDARY_CONTACT,
    ];
    const entSearchResults: { [entity: string]: { [colName: string]: MatchData<string>[] } } = {}
    for (const targetEnt in targetEntDict) {
        entSearchResults[targetEnt] = {};
        for (let entCol of POTENTIAL_ENT_COLUMNS) {
            let potentialEnts = await getIndexedColumnValues(customerRows, entCol);
            let searchResults = fuzzySearch(targetEnt, Object.keys(potentialEnts), {returnMatchData: true})
            if (isNonEmptyArray(searchResults) && searchResults[0].score > 0.6) {
                entSearchResults[targetEnt][entCol] = searchResults;
            }
        }
    }
    write(entSearchResults, path.join(ONE_DRIVE_DIR, `5_entity_fuzzy_search.json`));

}

async function searchInSalesOrders(): Promise<void> {
    const filePath = path.join(DATA_DIR, 'reports', 'client_entity_list.tsv');
    const SALES_ORDER_DIR = path.join(DATA_DIR, 'salesorders', 'all');
    validatePath(
        path.join(DATA_DIR, 'reports', 'state_to_abbreviation.json'), 
        SALES_ORDER_DIR,
        filePath,
        MISC_LOG_FILEPATH
    )

    const stateToAbbreviation = read(
        path.join(DATA_DIR, 'reports', 'state_to_abbreviation.json')
    );
    validate.objectArgument(`misc.main`, {stateToAbbreviation});
    // const abbreviationToState: Record<string, string> = {};
    // for (const [state, abbr] of Object.entries(stateToAbbreviation)) {
    //     abbreviationToState[abbr] = state;
    // }

    const concatStart = new Date();
    const compositeRows = await concatenateFiles(SALES_ORDER_DIR);
    mlog.debug(
        `Finished concatenateFiles() after ${
            ((new Date().getTime() - concatStart.getTime()) / 1000).toFixed(5)
        } seconds.`,
        NL+`Total Number of Sales Order Rows (# of line items): ${compositeRows.length}`
    );

    const SHIP_TO_COLUMN = 'Ship To Address';
    compositeRows.forEach(row => addConcatenatedAddressColumn(row, 
        SHIP_TO_COLUMN, {
            street1: SalesOrderColumnEnum.SHIP_TO_STREET_ONE,
            street2: SalesOrderColumnEnum.SHIP_TO_STREET_TWO,
            city: SalesOrderColumnEnum.SHIP_TO_CITY,
            state: SalesOrderColumnEnum.SHIP_TO_STATE,
            zip: SalesOrderColumnEnum.SHIP_TO_ZIP
        }
    ));
    const compositeFieldDict: Record<SourceColumnEnum, {
        [label: string]: Record<string, number[]>
    }> = {
        [SourceColumnEnum.ENTITY]: { // try to match target ent to row value in these columns...
            entityId: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.ENTITY_ID),
            street1: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.STREET_ONE),
            street2: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.STREET_TWO),
            shipTo1: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.SHIP_TO_STREET_ONE),
            shipTo2: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.SHIP_TO_STREET_TWO)
        },
        [SourceColumnEnum.ADDRESS]: {
            billing: await getIndexedColumnValues(compositeRows, SalesOrderColumnEnum.NAME_ADDRESS),
            shipping: await getIndexedColumnValues(compositeRows, SHIP_TO_COLUMN)
        }
    }

    // indices in the number[] values of the composite dicts all refer to rows in compositeRows
    // const compositeEntDict = await getIndexedColumnValues(
    //     compositeRows, SalesOrderColumnEnum.ENTITY_ID
    // ) as Record<string, number[]>;
    mlog.debug(`Number of Unique Entities From SO Directory Files: ${
        Object.keys(compositeFieldDict.Entity.entityId).length
        // Object.keys(compositeEntDict).length
    }`);
    
    const indexedMatches: { [matchedEntity: string]: number[] } = {};
    const entRows = await getRows(filePath);
    const targetEntDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ENTITY);
    const targetAddressDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ADDRESS);
    // mlog.info([`Let's see for how many ppl we gotta search for...`,
    //     `     num unique ents: ${Object.keys(targetEntDict).length}`,
    //     `num unique addresses: ${Object.keys(targetAddressDict).length}`
    // ].join(TAB))
    let stats: { [key: string]: any} = {
        // tolerance: `${indentedStringify({ENT_TOLERANCE, ADDR_TOLERANCE})}`,
        // entityExactMatchCount: 0,
        // entityLevenshteinCount: 0,
        // foundByFuzzySearch: 0,
        // foundByBilling: 0,
        // foundByShipping: 0
    }
    for (const targetEnt in targetEntDict) {
        let matchFound = false;
        entityFieldLoop:
        for (const entityField of Object.keys(compositeFieldDict.Entity)) {
            const indexedValues = compositeFieldDict.Entity[entityField];
            // mlog.debug([`start entityFieldLoop for field '${entityField}'`,
            //     `entity: '${targetEnt}'`,
            //     `num '${entityField}' values to compare: ${Object.keys(indexedValues).length}`
            // ].join(TAB));
            if (isIntegerArray(indexedValues[targetEnt])) { 
                // exact match with row value at SalesOrderColumnEnum.ENTITY_ID
                indexedMatches[targetEnt] = indexedValues[targetEnt];
                // stats.entityExactMatchCount++;
                stats[entityField] = (stats[entityField] || 0) + 1;
                matchFound = true;
                break entityFieldLoop;
            }
            let entMatch: string | undefined = Object.keys(indexedValues).find(val => {
                return equivalentAlphanumericStrings(targetEnt, val, ENT_TOLERANCE);
            });
            if (entMatch) {
                indexedMatches[targetEnt] = indexedValues[entMatch];
                // stats.levenshteinCount++
                stats[entityField] = (stats[entityField] || 0) + 1;
                matchFound = true;
                break entityFieldLoop;
            }
        }
        if (matchFound) continue;
        // try matching by address string
        let sourceRows = targetEntDict[targetEnt].map(
            sourceRowIndex => entRows[sourceRowIndex]
        ) as { Entity: string, Address: string }[];
        let sourceAddresses: string[] = Array.from(new Set(sourceRows.map(r => r.Address)));
        const targetAddresses: string[] = [...sourceAddresses];
        addToTargetAddressesLoop:
        for (const addr of sourceAddresses) {
            stateRegexLoop:
            for (const [state, abbrev] of Object.entries(stateToAbbreviation)) {
                let stateRegex = new RegExp(state, RegExpFlagsEnum.IGNORE_CASE);
                let abbrevRegex = new RegExp(abbrev, RegExpFlagsEnum.IGNORE_CASE);
                if (stateRegex.test(addr)) {
                    let altAddr = addr.replace(stateRegex, abbrev);
                    targetAddresses.push(altAddr);
                    break stateRegexLoop;
                } else if (abbrevRegex.test(addr)) {
                    let altAddr = addr.replace(abbrevRegex, state);
                    targetAddresses.push(altAddr);
                    break stateRegexLoop;
                }
            }
        }
        // mlog.debug([`address search info for entity '${targetEnt}'`,
        //     `(original) sourceAddresses.length: ${sourceAddresses.length}`,
        //     `(expanded) targetAddresses.length: ${targetAddresses.length}`
        // ].join(TAB));
        addressSearchLoop:
        for (const targetAddr of targetAddresses) {
            addressComparisonLoop:
            for (const addressField of Object.keys(compositeFieldDict.Address)) {
                const indexedValues = compositeFieldDict.Address[addressField];
                let addrMatch = Object.keys(indexedValues).find(addr => 
                    equivalentAlphanumericStrings(targetAddr, addr, ADDR_TOLERANCE)
                );
                if (addrMatch) {
                    indexedMatches[targetEnt] = indexedValues[addrMatch];
                    matchFound = true;
                    stats[addressField] = (stats[addressField] || 0) + 1;
                    break addressComparisonLoop;
                }
            }
            if (matchFound) break addressSearchLoop;
        }
    }
    let numFound = Object.keys(indexedMatches).length;
    let diff = Object.keys(targetEntDict).length - numFound;
    mlog.debug([`Finished searching for entity matches...`, 
        indentedStringify(stats),
        `     num unique ents:  ${Object.keys(targetEntDict).length}`,
        `num unique addresses:  ${Object.keys(targetAddressDict).length}`,
        `   num of ents found:  ${numFound}`,
        `  remainder to find =  ${diff}`
        ].join(TAB),
        NL+`${diff === 0 ? `wow` : `oh no`}`
    );
    const unmatchedEnts: string[] = Object.keys(targetEntDict)
        .filter(ent => !(ent in indexedMatches));
    let pairedNames: { nameInQuickBooks: string, nameFromEmail: string }[] = []
    for (const ent in indexedMatches) {
        let rows = indexedMatches[ent].map(rowIndex => compositeRows[rowIndex]);
        const qbName = rows[0][SalesOrderColumnEnum.ENTITY_ID] ?? 'MISSING_ENTITY_ID';
        pairedNames.push({
            nameInQuickBooks: qbName,
            nameFromEmail: ent
        })
    }
    write({
        unmatchedNames: unmatchedEnts,
        pairedNames
    }, path.join(ONE_DRIVE_DIR, 'misc_entity_match_results.json'));
}


type AddressColumns = {
    street1: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
}

function addConcatenatedAddressColumn(
    row: Record<string, any>,
    outputColumn: string, 
    addr: AddressColumns,
    separator: string = ' '
): void {
    let source = `misc.addConcatenatedAddressColumn`;
    validate.objectArgument(source, {row});
    validate.stringArgument(source, {outputColumn});
    if (!row || !outputColumn) return;
    if (!hasKeys(row, Object.values(addr))) {
        throw new Error(`${source} row is missing address column key(s)...`)
    }
    row[outputColumn] = [
        row[addr.street1],
        row[addr.street2],
        row[addr.city] + ',',
        row[addr.state],
        row[addr.zip]
    ].map(part => clean(part)).join(separator)
}

