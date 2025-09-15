/**
 * @file src/services/maintenance/entitySearch.ts
 */

import { isNonEmptyArray, isEmptyArray, hasKeys,
    isNonEmptyString, 
    isIntegerArray,
} from "typeshi:utils/typeValidation";
import { 
    mainLogger as mlog, simpleLogger as slog, 
    INDENT_LOG_LINE as TAB, NEW_LINE as NL, STOP_RUNNING, 
    getProjectFolders, 
} from "../../config";
import { 
    getRows, 
    writeObjectToJsonSync as write, readJsonFileAsObject as read, 
    getIndexedColumnValues, 
    indentedStringify,
    getSourceString,
    concatenateFiles,
    isDirectory
} from "typeshi:utils/io";
import * as validate from "typeshi:utils/argumentValidation";
import path from "node:path";
import { clean, equivalentAlphanumericStrings, RegExpFlagsEnum } from "@typeshi/regex";
import { CustomerColumnEnum } from "src/parse_configurations/customer/customerConstants";
import { MatchData, search as fuzzySearch } from "fast-fuzzy";
import { SalesOrderColumnEnum } from "src/parse_configurations/salesorder/salesOrderConstants";

export { searchInCustomers, searchInSalesOrders }

enum SourceColumnEnum {
    ENTITY = 'Entity',
    ADDRESS = 'Address'
}

async function searchInCustomers(
    targetEntFile: string,
    customerFile: string,
    outputDir?: string,
): Promise<void> {
    const source = getSourceString(__filename, searchInCustomers.name);
    validate.multipleExistingFileArguments(source, '.tsv', {customerFile, targetEntFile})
    
    const customerRows = await getRows(customerFile);
    const entRows = await getRows(targetEntFile);
    const targetEntDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ENTITY);
    const targetAddressDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ADDRESS);
    
    slog.debug([`${source} Pause after init`, 
        `     num unique ents: ${Object.keys(targetEntDict).length}`,
        `num unique addresses: ${Object.keys(targetAddressDict).length}`,
    ].join(TAB));
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
    if (isNonEmptyString(outputDir) && isDirectory(outputDir)) {
        write(entSearchResults, path.join(outputDir, `entity_fuzzy_search.json`));
    }
}

async function searchInSalesOrders(
    targetEntFile: string,// = path.join(DATA_DIR, 'reports', 'client_entity_list.tsv'),
    soDirectory: string,// = path.join(DATA_DIR, 'salesorders', 'all'),
    entTolerance: number = 0.9,
    addrTolerance: number = 0.8,
    outputDir?: string,
): Promise<void> {
    const source = getSourceString(__filename, searchInSalesOrders.name);
    validate.existingFileArgument(source, '.tsv', {targetEntFile});
    validate.existingDirectoryArgument(source, {soDirectory});

    const stateToAbbreviation = read(
        path.join(getProjectFolders().dataDir, 'reports', 'state_to_abbreviation.json')
    );
    validate.objectArgument(`misc.main`, {stateToAbbreviation});
    // const abbreviationToState: Record<string, string> = {};
    // for (const [state, abbr] of Object.entries(stateToAbbreviation)) {
    //     abbreviationToState[abbr] = state;
    // }

    const concatStart = new Date();
    const compositeRows = await concatenateFiles(soDirectory);
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
    const entRows = await getRows(targetEntFile);
    const targetEntDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ENTITY);
    const targetAddressDict = await getIndexedColumnValues(entRows, SourceColumnEnum.ADDRESS);
    // mlog.info([`Let's see for how many ppl we gotta search for...`,
    //     `     num unique ents: ${Object.keys(targetEntDict).length}`,
    //     `num unique addresses: ${Object.keys(targetAddressDict).length}`
    // ].join(TAB))
    let stats: { [key: string]: any} = {
    }
    for (const targetEnt in targetEntDict) {
        let matchFound = false;
        entityFieldLoop:
        for (const entityField of Object.keys(compositeFieldDict.Entity)) {
            const indexedValues = compositeFieldDict.Entity[entityField];
            if (isIntegerArray(indexedValues[targetEnt])) { 
                // exact match with row value at SalesOrderColumnEnum.ENTITY_ID
                indexedMatches[targetEnt] = indexedValues[targetEnt];
                stats[entityField] = (stats[entityField] || 0) + 1;
                matchFound = true;
                break entityFieldLoop;
            }
            let entMatch: string | undefined = Object.keys(indexedValues).find(val => {
                return equivalentAlphanumericStrings(targetEnt, val, entTolerance);
            });
            if (entMatch) {
                indexedMatches[targetEnt] = indexedValues[entMatch];
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
        addressSearchLoop:
        for (const targetAddr of targetAddresses) {
            addressComparisonLoop:
            for (const addressField of Object.keys(compositeFieldDict.Address)) {
                const indexedValues = compositeFieldDict.Address[addressField];
                let addrMatch = Object.keys(indexedValues).find(addr => 
                    equivalentAlphanumericStrings(targetAddr, addr, addrTolerance)
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
    mlog.debug([`${source} Finished searching for entity matches...`, 
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
    if (isNonEmptyString(outputDir) && isDirectory(outputDir)) {
        write({
            unmatchedNames: unmatchedEnts,
            pairedNames
        }, path.join(outputDir, 'misc_entity_match_results.json'));
    }
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
    let source = getSourceString(__filename, addConcatenatedAddressColumn.name)
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
