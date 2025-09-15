# Note:
**This repository will no longer receive substantial updates because I was laid off and my position was eliminated as a result of company restructuring.**

# Overview:
- A collection of scripts using [NetSuite's][netsuite_home] [SuiteScript 2.0][suitescript_docs] to implement NetSuite as company's ERP.

### Objective 
Transfer historical data exported from QuickBooks Desktop into NetSuite account.
### Context 
- It was necessary to export the historical data as csv files. 
- I initially used Python + Pandas to transform the data into import-compatible files, but later elected to use SuiteScript's [RESTlet][restlet_docs] because it allows for more control/precision/visibility on how records are created/updated and any errors therein. (and it would be fun to learn something new).

### Some Things to Note
The formal entry point for this project is [main.ts][main_file]
The project works by making the following sequence of function calls:
1. **initializeEnvironment()** (a function defined in [env.ts][env_setup_file])
The project requires a configuration file ([project.config.json][env_config_file]) to be defined adjacent to package.json
- The definition for this configuration is found in [ProjectEnvironment.ts][project_env_file]
- The ProjectEnvironment object is used to:
    - define environment type (sandbox or production) (affects request urls)
    - define directory paths for IO operations
    - define a DataLoaderConfiguration object that provides instructions to use in the next step. 
    - define a SuiteScriptEnvironment object that provides the details necessary to construct the RESTlet URLs used in API calls
2. **initializeData()** (a function defined in [dataLoader.ts][data_setup_file])
The project requires a second configuration file ([project.data.config.json][data_config_file]) to be defined adjacent to the first one.
- The definition for this configuration is found in [ProjectData.ts][project_data_file]
- This json file is a DataSourceDictionary object, which groups data into "domains" that are intended to mirror the category hierarchy under the "Lists" tab in the NetSuite UI.
- It is expected that each DataDomainEnum value is both a key in the DataSourceDictionary and the name of a subfolder in the 'dataDir' directory defined in initializeEnvironment()
- The value of each DataDomainEnum is a DataSourceConfiguration object. 
```ts
// from ProjectData.ts
/** can add more entries */
enum DataDomainEnum {
    ACCOUNTING = 'accounting',
    SUPPLY = 'supply',
    RELATIONSHIPS = 'relationships'
}
/** 
 * simplify this? i.e. 
 * `DataSourceDictionary = { [key in DataDomainEnum]: FolderHierarchy & { options?: LoadFileOptions } }` 
 * */
type DataSourceDictionary = { [key in DataDomainEnum]: DataSourceConfiguration }
type DataSourceConfiguration = FolderHierarchy & { options?: LoadFileOptions }
```
3. **instantiateAuthManager()** (a function defined in [configureAuth.ts][auth_setup_file])
- It creates an instance of [AuthManager][auth_manager_file] to obtain auth tokens.
- This step is necessary to make API calls to the [endpoints][record_endpoint_folder] used to manipulate NetSuite records
- Request bodies for these endpoints are defined in [RecordEndpoint.ts][record_endpoint_types_file]

Okay, now we have to extract the csv content and load it into a request body. This is handled by code in [src/services/parse][parse_folder] (to generate ParseResults) and [src/services/post_process][post_process_folder] (to validate/edit ParseResults)
- I'd like to improve the logic and increase the efficiency of the parsing step, but time constraints compelled me to postpone.

// TODO: finish README

## Links
-----
[netsuite_home]: https://www.netsuite.com/portal/home.shtml
[suitescript_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4140956840.html
[restlet_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4387799403.html
[record_browser]: https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/account.html

[parse_folder]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/parse
[parse_options_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/parse/types/ParseOptions.ts
[parser_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/parse/csvParser.ts
[post_process_folder]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/post_process
[post_process_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/services/post_process/parseResultsProcessor.ts

[auth_setup_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/configureAuth.ts
[auth_manager_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/server/AuthManager.ts
[sample_payload_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/samplePayloads.ts
[put_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/requests/put.ts
[main_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/main.ts

[env_setup_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/env.ts
[project_env_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/types/ProjectEnvironment.ts

[data_setup_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/dataLoader.ts
[env_config_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/project.config.json
[project_data_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/config/types/ProjectData.ts
[data_config_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/project.data.config.json


[suite_script_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/ns/SuiteScript.ts
[record_endpoint_types_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/types/RecordEndpoint.ts
[record_endpoint_folder]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/endpoints/record
[put_endpoint_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/endpoints/record/PUT_Record.js

