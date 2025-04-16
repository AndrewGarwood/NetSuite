/**
 * @file Enums.d.ts
 * @description TypeScript definitions for various enums used in NetSuite.
 * @module Enums
 */

/*
    Net 30  
    50 Prepay/50 Net30  
    Upon Receipt  
    Net 15  
    Prepay-Payment  
    Credit Card  
    Net 10  
    Check in Advance  
    Net 60  
    50 prepay/50 upon delivery  
    Net 20  
    Cash  
    Pay In Full  
    Net 90


*/
export enum UnitsTypeEnum {
    QUANTITY = "Quantity",
    WEIGHT = "Weight",
    LENGTH = "Length",
    VOLUME = "Volume",
}

export enum UnitsEnum {
    EACH = "each",
    DOZEN = "dozen",
    GRAMS = "grams",
    KILOGRAMS = "kilograms",
    MILLIGRAMS = "milligrams",
    LITERS = "liters",
    MILLILITERS = "milliliters",
    GALLONS = "gallons",
    POUNDS = "pounds",
}

export enum EmailPreferenceEnum {
    HTML = "_HTML",
    PDF = "_PDF",
}

/**
 * @enum {string} GlobalSubscriptionStatusEnum
 * @description Enum for global subscription status in NetSuite.
 * @reference https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/schema/enum/globalsubscriptionstatus.html?mode=package
 * @property {string} CONFIRMED_OPT_IN - Confirmed Opt In
 * @property {string} CONFIRMED_OPT_OUT - Confirmed Opt Out
 * @property {string} SOFT_OPT_IN - Soft Opt In
 * @property {string} SOFT_OPT_OUT - Soft Opt Out
 */
export enum GlobalSubscriptionStatusEnum {
    CONFIRMED_OPT_IN = "_confirmedOptIn",
    CONFIRMED_OPT_OUT = "_confirmedOptOut",
    SOFT_OPT_IN = "_softOptIn",
    SOFT_OPT_OUT = "_softOptOut",
}


/**
 * @reference https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/schema/enum/itemsource.html?mode=package
 * - Namespace: urn:types.common.platform.webservices.netsuite.com
 * @enum {string} ItemSourceEnum
 * @description Enum for item source types in NetSuite.
 * @property {string} STOCK - Represents stock items.
 * @property {string} PHANTOM - Represents phantom items.
 * @property {string} WORK_ORDER - Represents work order items.
 * @property {string} PURCHASE_ORDER - Represents purchase order items.
 */
export enum ItemSourceEnum {
    STOCK = "_stock",
    PHANTOM = "_phantom",
    WORK_ORDER = "_workOrder",
    PURCHASE_ORDER = "_purchaseOrder"
}



/**
 * @reference https://9866738-sb1.app.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/schema/enum/country.html?mode=package
 * - Namespace: urn:types.common.platform.webservices.netsuite.com
 * @enum {string} NetSuiteCountryEnum
 * @description Enum for country field in NetSuite records.
 * @property {string} AFGHANISTAN - Afghanistan
 * @property {string} UNITED_STATES - United States
 * @property {string} CANADA - Canada
 * @property {string} CHINA - China
 * @property {string} HONG_KONG - Hong Kong
 * @property {string} IRAQ - Iraq
 * @property {string} JAPAN - Japan
 * @property {string} SOUTH_KOREA - South Korea
 * @more ...
 */
export enum NetSuiteCountryEnum {
    AFGHANISTAN = "_afghanistan",
    ALAND_ISLANDS = "_alandIslands",
    ALBANIA = "_albania",
    ALGERIA = "_algeria",
    AMERICAN_SAMOA = "_americanSamoa",
    ANDORRA = "_andorra",
    ANGOLA = "_angola",
    ANGUILLA = "_anguilla",
    ANTARCTICA = "_antarctica",
    ANTIGUA_AND_BARBUDA = "_antiguaAndBarbuda",
    ARGENTINA = "_argentina",
    ARMENIA = "_armenia",
    ARUBA = "_aruba",
    AUSTRALIA = "_australia",
    AUSTRIA = "_austria",
    AZERBAIJAN = "_azerbaijan",
    BAHAMAS = "_bahamas",
    BAHRAIN = "_bahrain",
    BANGLADESH = "_bangladesh",
    BARBADOS = "_barbados",
    BELARUS = "_belarus",
    BELGIUM = "_belgium",
    BELIZE = "_belize",
    BENIN = "_benin",
    BERMUDA = "_bermuda",
    BHUTAN = "_bhutan",
    BOLIVIA = "_boliviaPlurinationalStateOf",
    BONAIRE_SINT_EUSTATIUS_AND_SABA = "_bonaireSintEustatiusAndSaba",
    BOSNIA_AND_HERZEGOVINA = "_bosniaAndHerzegovina",
    BOTSWANA = "_botswana",
    BOUVET_ISLAND = "_bouvetIsland",
    BRAZIL = "_brazil",
    BRITISH_INDIAN_OCEAN_TERRITORY = "_britishIndianOceanTerritory",
    BRUNEI_DARUSSALAM = "_bruneiDarussalam",
    BULGARIA = "_bulgaria",
    BURKINA_FASO = "_burkinaFaso",
    BURUNDI = "_burundi",
    CABO_VERDE = "_caboVerde",
    CAMBODIA = "_cambodia",
    CAMEROON = "_cameroon",
    CANADA = "_canada",
    CANARY_ISLANDS = "_canaryIslands",
    CAYMAN_ISLANDS = "_caymanIslands",
    CENTRAL_AFRICAN_REPUBLIC = "_centralAfricanRepublic",
    CEUTA_AND_MELILLA = "_ceutaAndMelilla",
    CHAD = "_chad",
    CHILE = "_chile",
    CHINA = "_china",
    CHRISTMAS_ISLAND = "_christmasIsland",
    COCOS_KEELING_ISLANDS = "_cocosKeelingIslands",
    COLOMBIA = "_colombia",
    COMOROS = "_comoros",
    CONGO = "_congo",
    CONGO_DEMOCRATIC_REPUBLIC = "_congoTheDemocraticRepublicOfThe",
    COOK_ISLANDS = "_cookIslands",
    COSTA_RICA = "_costaRica",
    COTE_DIVOIRE = "_coteDIvoire",
    CROATIA = "_croatia",
    CUBA = "_cuba",
    CURACAO = "_curacao",
    CYPRUS = "_cyprus",
    CZECHIA = "_czechia",
    DENMARK = "_denmark",
    DJIBOUTI = "_djibouti",
    DOMINICA = "_dominica",
    DOMINICAN_REPUBLIC = "_dominicanRepublic",
    ECUADOR = "_ecuador",
    EGYPT = "_egypt",
    EL_SALVADOR = "_elSalvador",
    EQUATORIAL_GUINEA = "_equatorialGuinea",
    ERITREA = "_eritrea",
    ESTONIA = "_estonia",
    ESWATINI = "_eswatini",
    ETHIOPIA = "_ethiopia",
    FALKLAND_ISLANDS = "_falklandIslandsMalvinas",
    FAROE_ISLANDS = "_faroeIslands",
    FIJI = "_fiji",
    FINLAND = "_finland",
    FRANCE = "_france",
    FRENCH_GUIANA = "_frenchGuiana",
    FRENCH_POLYNESIA = "_frenchPolynesia",
    FRENCH_SOUTHERN_TERRITORIES = "_frenchSouthernTerritories",
    GABON = "_gabon",
    GAMBIA = "_gambia",
    GEORGIA = "_georgia",
    GERMANY = "_germany",
    GHANA = "_ghana",
    GIBRALTAR = "_gibraltar",
    GREECE = "_greece",
    GREENLAND = "_greenland",
    GRENADA = "_grenada",
    GUADELOUPE = "_guadeloupe",
    GUAM = "_guam",
    GUATEMALA = "_guatemala",
    GUERNSEY = "_guernsey",
    GUINEA = "_guinea",
    GUINEA_BISSAU = "_guineaBissau",
    GUYANA = "_guyana",
    HAITI = "_haiti",
    HEARD_ISLAND_AND_MCDONALD_ISLANDS = "_heardIslandAndMcdonaldIslands",
    HOLY_SEE = "_holySee",
    HONDURAS = "_honduras",
    HONG_KONG = "_hongKong",
    HUNGARY = "_hungary",
    ICELAND = "_iceland",
    INDIA = "_india",
    INDONESIA = "_indonesia",
    IRAN = "_iranIslamicRepublicOf",
    IRAQ = "_iraq",
    IRELAND = "_ireland",
    ISLE_OF_MAN = "_isleOfMan",
    ISRAEL = "_israel",
    ITALY = "_italy",
    JAMAICA = "_jamaica",
    JAPAN = "_japan",
    JERSEY = "_jersey",
    JORDAN = "_jordan",
    KAZAKHSTAN = "_kazakhstan",
    KENYA = "_kenya",
    KIRIBATI = "_kiribati",
    NORTH_KOREA = "_koreaTheDemocraticPeoplesRepublicOf",
    SOUTH_KOREA = "_koreaTheRepublicOf",
    KOSOVO = "_kosovo",
    KUWAIT = "_kuwait",
    KYRGYZSTAN = "_kyrgyzstan",
    LAO = "_laoPeoplesDemocraticRepublic",
    LATVIA = "_latvia",
    LEBANON = "_lebanon",
    LESOTHO = "_lesotho",
    LIBERIA = "_liberia",
    LIBYA = "_libya",
    LIECHTENSTEIN = "_liechtenstein",
    LITHUANIA = "_lithuania",
    LUXEMBOURG = "_luxembourg",
    MACAO = "_macao",
    MADAGASCAR = "_madagascar",
    MALAWI = "_malawi",
    MALAYSIA = "_malaysia",
    MALDIVES = "_maldives",
    MALI = "_mali",
    MALTA = "_malta",
    MARSHALL_ISLANDS = "_marshallIslands",
    MARTINIQUE = "_martinique",
    MAURITANIA = "_mauritania",
    MAURITIUS = "_mauritius",
    MAYOTTE = "_mayotte",
    MEXICO = "_mexico",
    MICRONESIA = "_micronesiaFederatedStatesOf",
    MOLDOVA = "_moldovaTheRepublicOf",
    MONACO = "_monaco",
    MONGOLIA = "_mongolia",
    MONTENEGRO = "_montenegro",
    MONTSERRAT = "_montserrat",
    MOROCCO = "_morocco",
    MOZAMBIQUE = "_mozambique",
    MYANMAR = "_myanmar",
    NAMIBIA = "_namibia",
    NAURU = "_nauru",
    NEPAL = "_nepal",
    NETHERLANDS = "_netherlands",
    NEW_CALEDONIA = "_newCaledonia",
    NEW_ZEALAND = "_newZealand",
    NICARAGUA = "_nicaragua",
    NIGER = "_niger",
    NIGERIA = "_nigeria",
    NIUE = "_niue",
    NORFOLK_ISLAND = "_norfolkIsland",
    NORTHERN_MARIANA_ISLANDS = "_northernMarianaIslands",
    NORTH_MACEDONIA = "_northMacedonia",
    NORWAY = "_norway",
    OMAN = "_oman",
    PAKISTAN = "_pakistan",
    PALAU = "_palau",
    PALESTINE = "_palestineStateOf",
    PANAMA = "_panama",
    PAPUA_NEW_GUINEA = "_papuaNewGuinea",
    PARAGUAY = "_paraguay",
    PERU = "_peru",
    PHILIPPINES = "_philippines",
    PITCAIRN = "_pitcairn",
    POLAND = "_poland",
    PORTUGAL = "_portugal",
    PUERTO_RICO = "_puertoRico",
    QATAR = "_qatar",
    REUNION = "_reunion",
    ROMANIA = "_romania",
    RUSSIAN_FEDERATION = "_russianFederation",
    RWANDA = "_rwanda",
    SAINT_BARTHELEMY = "_saintBarthelemy",
    SAINT_HELENA = "_saintHelenaAscensionAndTristanDaCunha",
    SAINT_KITTS_AND_NEVIS = "_saintKittsAndNevis",
    SAINT_LUCIA = "_saintLucia",
    SAINT_MARTIN = "_saintMartinFrenchPart",
    SAINT_PIERRE_AND_MIQUELON = "_saintPierreAndMiquelon",
    SAINT_VINCENT_AND_GRENADINES = "_saintVincentAndTheGrenadines",
    SAMOA = "_samoa",
    SAN_MARINO = "_sanMarino",
    SAO_TOME_AND_PRINCIPE = "_saoTomeAndPrincipe",
    SAUDI_ARABIA = "_saudiArabia",
    SENEGAL = "_senegal",
    SERBIA = "_serbia",
    SEYCHELLES = "_seychelles",
    SIERRA_LEONE = "_sierraLeone",
    SINGAPORE = "_singapore",
    SINT_MAARTEN = "_sintMaartenDutchPart",
    SLOVAKIA = "_slovakia",
    SLOVENIA = "_slovenia",
    SOLOMON_ISLANDS = "_solomonIslands",
    SOMALIA = "_somalia",
    SOUTH_AFRICA = "_southAfrica",
    SOUTH_GEORGIA = "_southGeorgiaAndTheSouthSandwichIslands",
    SOUTH_SUDAN = "_southSudan",
    SPAIN = "_spain",
    SRI_LANKA = "_sriLanka",
    SUDAN = "_sudan",
    SURINAME = "_suriname",
    SVALBARD_AND_JAN_MAYEN = "_svalbardAndJanMayen",
    SWEDEN = "_sweden",
    SWITZERLAND = "_switzerland",
    SYRIA = "_syrianArabRepublic",
    TAIWAN = "_taiwan",
    TAJIKISTAN = "_tajikistan",
    TANZANIA = "_tanzaniaTheUnitedRepublicOf",
    THAILAND = "_thailand",
    TIMOR_LESTE = "_timorLeste",
    TOGO = "_togo",
    TOKELAU = "_tokelau",
    TONGA = "_tonga",
    TRINIDAD_AND_TOBAGO = "_trinidadAndTobago",
    TUNISIA = "_tunisia",
    TURKIYE = "_turkiye",
    TURKMENISTAN = "_turkmenistan",
    TURKS_AND_CAICOS_ISLANDS = "_turksAndCaicosIslands",
    TUVALU = "_tuvalu",
    UGANDA = "_uganda",
    UKRAINE = "_ukraine",
    UNITED_ARAB_EMIRATES = "_unitedArabEmirates",
    UNITED_KINGDOM = "_unitedKingdom",
    UNITED_STATES = "_unitedStates",
    UNITED_STATES_MINOR_OUTLYING_ISLANDS = "_unitedStatesMinorOutlyingIslands",
    URUGUAY = "_uruguay",
    UZBEKISTAN = "_uzbekistan",
    VANUATU = "_vanuatu",
    VENEZUELA = "_venezuelaBolivarianRepublicOf",
    VIETNAM = "_vietNam",
    VIRGIN_ISLANDS_BRITISH = "_virginIslandsBritish",
    VIRGIN_ISLANDS_US = "_virginIslandsUS",
    WALLIS_AND_FUTUNA = "_wallisAndFutunaIslands",
    WESTERN_SAHARA = "_westernSahara",
    YEMEN = "_yemen",
    ZAMBIA = "_zambia",
    ZIMBABWE = "_zimbabwe"
}

