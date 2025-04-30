# Overview:
- A collection of scripts using [NetSuite's](https://www.netsuite.com/portal/home.shtml) [SuiteScript 2.0](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4140956840.html) to facilitate implementation of NetSuite as company's ERP.
- There are multiple entry points to create/update/delete data from one's NetSuite account/instance. I prefer the REST entry point: [NetSuite Applications Suite - SuiteScript 2.x RESTlet Script Type](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4387799403.html)
- An essential reference for is NetSuite's [Record Browser](https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/account.html) 

### My current approach is as follows:
0. Determine desired objective. For example, if I need to upload a substantial amount of data, I can create records through POST requests (see [POST_CreateRecord.js](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/FileCabinet/SuiteScripts/REST/POST_CreateRecord.js) and [POST_BatchCreateRecord.js](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/FileCabinet/SuiteScripts/REST/POST_BatchCreateRecord.js))
1. Write API endpoints so I can make requests to them with paylaods (see [SuiteCloud/src/FileCabinet/SuiteScripts/REST](https://github.com/AndrewGarwood/NetSuite/tree/master/SuiteCloud/src/FileCabinet/SuiteScripts/REST))
2. I wanted to use TypeScript in VSCode, so I set up an Oauth2.0 flow so that I can communicate with these endpoints (see [src/server/authServer.ts](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/server/authServer.ts))
3. In my use case, read data from csv files and store them into [payloads](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/api/samplePayloads.ts)
4. Determine proper mapping by using aforementioned [Record Browser](https://system.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2024_2/script/record/account.html) and store it into ParseOption objects (types defined in [SuiteCloud/src/types/api/CsvToApiMapping.ts](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/types/api/CsvToApiMapping.ts) - see [SuiteCloud/src/vendorParseOptions.ts](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/vendorParseOptions.ts) for an example.
5. with [parseCsvToRequestBody](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/parseCsvToRequestBody.ts) 
6. Use authorization tokens generated from authorization flow to make API calls, e.g. in [SuiteCloud/src/main.ts](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/main.ts) using functions from [SuiteCloud/src/utils/api/callApi.ts](https://github.com/AndrewGarwood/NetSuite/blob/master/SuiteCloud/src/utils/api/callApi.ts)
7. Keep writing more features and improvements.
8. oh and type definitions + docmentation.

### Guides I found useful: 
- [NetSuite RESTlet Creation - SuiteScript 2.0 with OAuth 2 - YouTube](https://www.youtube.com/watch?v=MAOMQp5dh0U)
- [The SuiteScript Developer's Guide on NetSuite Subrecords - NetSuite Insights](https://netsuite.smash-ict.com/suitescript-developers-guide-on-netsuite-subrecords-part-1/)
