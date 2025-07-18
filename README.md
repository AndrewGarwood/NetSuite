# Overview:
- A collection of scripts using [NetSuite's][netsuite_home] [SuiteScript 2.0][suitescript_docs] to implement NetSuite as company's ERP.
- There are multiple entry points to create/update/delete data from one's NetSuite account/instance. I prefer the REST entry point: [NetSuite Applications Suite - SuiteScript 2.x RESTlet Script Type][restlet_docs]
- An essential reference: NetSuite's [Record Browser][record_browser] to determine the structure & properties of records and subrecords.


### My current approach is as follows:
1. Write API endpoints (e.g. [PUT_Record.js][upsert_file] for creating/updating records)
2. I wanted to use TypeScript in VSCode, so I set up an Oauth2.0 flow to communicate with these endpoints (see [AuthManager.ts][oauth_file])
3. In my use case, the goal is to read data from csv files and store them into [payloads][sample_payloads_file]
4. Determine proper mapping by using aforementioned [Record Browser][record_browser] and write [ParseOptions][parse_options_file] objects.
5. Then use [ParseOptions][parse_options_file] as a parameter of parseRecordsCsv() in [csvParser.ts][parser_file]
6. Then do some post-processing in [parseResultsProcessor.ts][post_process_file]
7. Use tokens from authorization flow to make API calls. (e.g. [put.ts][put_file])
8. Write more features/improvements and refactor as work continues. @TODO JWT tokens

## Links
-----
[netsuite_home]: https://www.netsuite.com/portal/home.shtml
[suitescript_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4140956840.html
[restlet_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4387799403.html
[record_browser]: https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/account.html
[requests_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/requests/types/Requests.ts
[parse_options_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/io/types/ParseOptions.ts
[upsert_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/endpoints/record/PUT_Record.js
[ouath_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/server/AuthManager.ts
[parser_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/csvParser.ts
[post_process_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/parseResultsProcessor.ts
[sample_payloads_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/samplePayloads.ts
[put_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/api/requests/put.ts

