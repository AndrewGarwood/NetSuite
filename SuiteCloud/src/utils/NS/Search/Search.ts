/**
 * @notimplemented
 * @file src/utils/api/types/NS/Search/Search.ts
 */

export enum ConsolidationEnum {
    ACCTTYPE,
    AVERAGE,
    CURRENT,
    HISTORICAL,
    NONE,
}

export enum IncludePeriodTransactionEnum {
    F,
    FALSE,
    T,
    TRUE
}

export enum Operator {
    AFTER,
    ALLOF,
    ANY,
    ANYOF,
    BEFORE,
    BETWEEN,
    CONTAINS,
    DOESNOTCONTAIN,
    DOESNOTSTARTWITH,
    EQUALTO,
    GREATERTHAN,
    GREATERTHANOREQUALTO,
    HASKEYWORDS,
    IS,
    ISEMPTY,
    ISNOT,
    ISNOTEMPTY,
    LESSTHAN,
    LESSTHANOREQUALTO,
    NONEOF,
    NOTAFTER,
    NOTALLOF,
    NOTBEFORE,
    NOTBETWEEN,
    NOTEQUALTO,
    NOTGREATERTHAN,
    NOTGREATERTHANOREQUALTO,
    NOTLESSTHAN,
    NOTLESSTHANOREQUALTO,
    NOTON,
    NOTONORAFTER,
    NOTONORBEFORE,
    NOTWITHIN,
    ON,
    ONORAFTER,
    ONORBEFORE,
    STARTSWITH,
    WITHIN,
}

export enum Summary {
    GROUP,
    COUNT,
    SUM,
    AVG,
    MIN,
    MAX,
}

export enum Sort {
    ASC,
    DESC,
    NONE,
}