# Overview:
- A collection of scripts using [NetSuite's][netsuite_home] [SuiteScript 2.0][suitescript_docs] to implement NetSuite as company's ERP.
- There are multiple entry points to create/update/delete data from one's NetSuite account/instance. I prefer the REST entry point: [NetSuite Applications Suite - SuiteScript 2.x RESTlet Script Type][restlet_docs]
- An essential reference: NetSuite's [Record Browser][record_browser] to determine the structure & properties of records and subrecords.

**Note: In process of rewriting/refactoring some files after simplifying the data structures used in Post Request Bodies.** 
- (i.e. I simplified the types in [Requests.ts][requests_file] and [ParseOptions][parse_options_file] because I decided to make [PUT_UpsertRecord.js][upsert_file] handle the complexity of conforming to SuiteScript's internal API syntax/data structures; So creating payloads will be easier.) (e.g. compare [samplePayloads.ts][sample_payloads_file]'s [new format][new_put_options_image] to its [previous format][old_put_options_image] )

### My current approach is as follows:
0. Determine desired objective. For example, if I need to upload a substantial amount of data, I can create records through POST requests 
1. Write API endpoints so I can make requests to them with paylaods (e.g. [PUT_UpsertRecord.js][upsert_file] for creating/updating records)
2. I wanted to use TypeScript in VSCode, so I set up an Oauth2.0 flow to communicate with these endpoints (see [authServer.ts][oauth_file])
3. In my use case, the goal is to read data from csv files and store them into [payloads][sample_payloads_file]
4. Determine proper mapping by using aforementioned [Record Browser][record_browser] and store it into [ParseOptions][parse_options_file] objects.
5. Then use [ParseOptions][parse_options_file] as a parameter of 
6. Use authorization tokens generated from authorization flow to make API calls. (e.g. [put.ts][put_file])
7. Write more features/improvements and refactor as work continues. @TODO JWT tokens

#### Guides I found helpful for using SuiteScript: 
- [NetSuite RESTlet Creation - SuiteScript 2.0 with OAuth 2 - YouTube][oauth_video]
- [The SuiteScript Developer's Guide on NetSuite Subrecords - NetSuite Insights][subrecord_guide]

## Links
-----
[netsuite_home]: https://www.netsuite.com/portal/home.shtml
[suitescript_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4140956840.html
[restlet_docs]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4387799403.html
[record_browser]: https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/account.html
[requests_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/api/types/Requests.ts
[parse_options_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/io/types/ParseOptions.ts
[upsert_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/FileCabinet/SuiteScripts/REST/PUT/PUT_UpsertRecord.js
[ouath_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/server/authServer.ts
[sample_payloads_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/api/samplePayloads.ts
[put_file]: https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/api/put.ts
[oauth_video]: https://www.youtube.com/watch?v=MAOMQp5dh0U
[subrecord_guide]: https://netsuite.smash-ict.com/suitescript-developers-guide-on-netsuite-subrecords-part-1/
[new_put_options_image]: ./images/New_PostRecordOptions.png
[old_put_options_image]: ./images/Old_PostRecordOptions.png