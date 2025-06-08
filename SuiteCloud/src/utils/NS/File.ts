/**
 * @file src/utils/ns/File.ts
 * @reference {@link https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4205693274.html}
 */

/** 
 * @enum {string} **`NetSuiteFileEncodingEnum`**
 * @description Enumeration that holds the string values for supported character encoding.
 * @property {string} UTF_8 - UTF-8 encoding.
 * @property {string} WINDOWS_1252 - Windows 1252 encoding.
 * @property {string} ISO_8859_1 - ISO 8859-1 encoding.
 * @property {string} GB18030 - GB18030 encoding.
 * @property {string} SHIFT_JIS - Shift JIS encoding.
 * @property {string} MAC_ROMAN - Mac Roman encoding.
 * @property {string} GB2312 - GB2312 encoding.
 * @property {string} BIG5 - Big5 encoding.
 */
export enum NetSuiteFileEncodingEnum {
    UTF_8  = 'UTF_8',
    WINDOWS_1252  = 'WINDOWS_1252',
    ISO_8859_1  = 'ISO_8859_1',
    GB18030  = 'GB18030',
    SHIFT_JIS  = 'SHIFT_JIS',
    MAC_ROMAN  = 'MAC_ROMAN',
    GB2312  = 'GB2312',
    BIG5  = 'BIG5',
}

/** 
 * @enum {string} **`NetSuiteFileTypeEnum`**
 * @description Enumeration that holds the string values for supported file types.
 * @property {string} APPCACHE - Application Cache file.
 * @property {string} AUTOCAD - AutoCAD file.
 * @property {string} BMPIMAGE - Bitmap Image file.
 * @property {string} CERTIFICATE - Certificate file.
 * @property {string} CONFIG - Configuration file.
 * @property {string} CSV - Comma Separated Values file.
 * @property {string} EXCEL - Excel file.
 * @property {string} FLASH - Flash file.
 * @property {string} FREEMARKER - FreeMarker file.
 * @property {string} GIFIMAGE - Graphics Interchange Format Image file.
 * @property {string} GZIP - Gzip file.
 * @property {string} HTMLDOC - HTML Document file.
 * @property {string} ICON - Icon file.
 * @property {string} JAVASCRIPT - JavaScript file.
 * @property {string} JPGIMAGE - JPEG Image file.
 * @property {string} JSON - JavaScript Object Notation file.
 * @property {string} MESSAGERFC - Message RFC file.
 * @property {string} MP3 - MPEG Audio file.
 * @property {string} MPEGMOVIE - MPEG Movie file.
 * @property {string} MSPROJECT - Microsoft Project file.
 * @property {string} PDF - Portable Document Format file.
 * @property {string} PJPGIMAGE - Progressive JPEG Image file.
 * @property {string} PLAINTEXT - Plain Text file.
 * @property {string} PNGIMAGE - Portable Network Graphics Image file.
 * @property {string} POSTSCRIPT - PostScript file.
 * @property {string} POWERPOINT - Microsoft PowerPoint file.
 * @property {string} QUICKTIME - QuickTime file.
 * @property {string} RTF - Rich Text Format file.
 * @property {string} SCSS - Sassy CSS file.
 * @property {string} SMS - Short Message Service file.
 * @property {string} STYLESHEET - Stylesheet file.
 * @property {string} SVG - Scalable Vector Graphics file.
 * @property {string} TAR - Tape Archive file.
 * @property {string} TIFFIMAGE - Tagged Image File Format Image file.
 * @property {string} VISIO - Microsoft Visio file.
 * @property {string} WEBAPPPAGE - Web Application Page file.
 * @property {string} WEBAPPSCRIPT - Web Application Script file.
 * @property {string} WORD - Microsoft Word file.
 * @property {string} XMLDOC - XML Document file.
 * @property {string} XSD - XML Schema Definition file.
 * @property {string} ZIP - Zip file.
 */
export enum NetSuiteFileTypeEnum {
    APPCACHE = 'APPCACHE',
    AUTOCAD = 'AUTOCAD',
    BMPIMAGE = 'BMPIMAGE',
    CERTIFICATE = 'CERTIFICATE',
    CONFIG = 'CONFIG',
    CSV = 'CSV',
    EXCEL = 'EXCEL',
    FLASH = 'FLASH',
    FREEMARKER = 'FREEMARKER',
    GIFIMAGE = 'GIFIMAGE',
    GZIP = 'GZIP',
    HTMLDOC = 'HTMLDOC',
    ICON = 'ICON',
    JAVASCRIPT = 'JAVASCRIPT',
    JPGIMAGE = 'JPGIMAGE',
    JSON = 'JSON',
    MESSAGERFC = 'MESSAGERFC',
    MP3 = 'MP3',
    MPEGMOVIE = 'MPEGMOVIE',
    MSPROJECT = 'MSPROJECT',
    PDF = 'PDF',
    PJPGIMAGE = 'PJPGIMAGE',
    PLAINTEXT = 'PLAINTEXT',
    PNGIMAGE = 'PNGIMAGE',
    POSTSCRIPT = 'POSTSCRIPT',
    POWERPOINT = 'POWERPOINT',
    QUICKTIME = 'QUICKTIME',
    RTF = 'RTF',
    SCSS = 'SCSS',
    SMS = 'SMS',
    STYLESHEET = 'STYLESHEET',
    SVG = 'SVG',
    TAR = 'TAR',
    TIFFIMAGE = 'TIFFIMAGE',
    VISIO = 'VISIO',
    WEBAPPPAGE = 'WEBAPPPAGE',
    WEBAPPSCRIPT = 'WEBAPPSCRIPT',
    WORD = 'WORD',
    XMLDOC = 'XMLDOC',
    XSD = 'XSD',
    ZIP = 'ZIP'
}