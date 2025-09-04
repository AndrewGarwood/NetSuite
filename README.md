# Overview:
- A collection of scripts using [NetSuite's][netsuite_home] [SuiteScript 2.0][suitescript_docs] to implement NetSuite as company's ERP.



### Objective 
Transfer historical data exported from QuickBooks Desktop into NetSuite account.
### Context 
- I don't have authorization to use the QuickBooks Desktop SDK, so it was necessary to export the historical data as csv files. 
- I initially used Python and Pandas to transform the data into import-compatible files, but eventually elected to use SuiteScript's [RESTlet][restlet_docs] Script Type because it allows for more control/precision on how records are created/updated (and it would be fun to learn something new).

### Some Things to Note
The formal entry point for this project is [main.ts][main_file]
The project requires a configuration file ("project.config.json") to be defined adjacent to package.json
- The type definition for this configuration is found in [ProjectEnvironment.ts][project_environment_file]
- The ProjectEnvironment object is used to:
    - define directory paths for IO operations
    - define a DataLoaderConfiguration object that provides instructions regarding the DataSourceDictionary used in [dataLoader.ts][data_setup_file]
    - define a SuiteScriptEnvironment object that provides the details necessary to construct the RESTlet URLs used in API calls
The project works by making the following sequence of function calls:
1. initializeEnvironment() from [env.ts][env_setup_file]
2. initializeData() from [dataLoader.ts][data_setup_file]
3. instantiateAuthManager() (this is a function defined in [configureAuth.ts][auth_setup_file] which just creates an instance of [AuthManager][auth_manager_file] that will be used to obtain authorization tokens for API calls)

## Links
-----
[netsuite_home]: https://www.netsuite.com/portal/home.shtml
[suitescript_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4140956840.html
[restlet_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4387799403.html
[record_browser]: https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/account.html
[requests_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/requests/types/Requests.ts
[parse_options_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/parse/types/ParseOptions.ts
[upsert_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/endpoints/record/PUT_Record.js
[auth_setup_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/configureAuth.ts
[auth_manager_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/server/AuthManager.ts
[parser_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/parse/csvParser.ts
[post_process_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/post_process/parseResultsProcessor.ts
[sample_payload_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/samplePayloads.ts
[put_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/requests/put.ts
[main_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/main.ts
[env_setup_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/env.ts
[data_setup_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/dataLoader.ts
[project_environment_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/types/ProjectEnvironment.ts
[project_data_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/types/ProjectData.ts

[suite_script_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/ns/SuiteScript.ts
