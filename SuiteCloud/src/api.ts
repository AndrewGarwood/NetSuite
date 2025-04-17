/**
 * @file api.ts
 * @module api
 * @description API functions for calling RESTlets in NetSuite. (javascript files uploaded and deployed on NetSuite)
 * @see './FileCabinet/SuiteScripts/REST/*.js' for examples of RESTlet scripts.
 */
import axios from "axios";
import { RESTLET_URL_STEM } from "./config/env";
import { AxiosCallEnum, AxiosContentTypeEnum } from "./types/auth/AxiosEnums";

/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {AxiosCallEnum} callType {@link AxiosCallEnum}
 * @param {AxiosContentTypeEnum} contentType {@link AxiosContentTypeEnum}
 * @returns 
 */
export async function callRestlet(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    callType: AxiosCallEnum,
    contentType: AxiosContentTypeEnum = AxiosContentTypeEnum.JSON,
): Promise<any> {
    const restletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`;
    try {
        const response = await axios({
            method: callType,
            url: restletUrl,
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
            },
        });
        return response;
    } catch (error) {
        console.error('Error in api.ts callRestlet():', error);
        throw new Error('Failed to call RESTlet');
    }
}

export type PostPayload = AxiosContentTypeEnum.JSON | AxiosContentTypeEnum.PLAIN_TEXT;
/**
 * 
 * @param {string} accessToken 
 * @param {string | number} scriptId 
 * @param {string | number} deployId 
 * @param {Record<string, any>} payload
 * @param {PostPayload} contentType {@link PostPayload}
 * @returns {Promise<any>}
 */
export async function callPostRestletWithPayload(
    accessToken: string, 
    scriptId: string | number, 
    deployId: string | number,
    payload: Record<string, any> | any,
    contentType: PostPayload = AxiosContentTypeEnum.JSON,
): Promise<any> {
    const restletUrl = `${RESTLET_URL_STEM}?script=${scriptId}&deploy=${deployId}`;
    try {
        const response = await axios.post(restletUrl, payload, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': contentType,
            },
        });
        return response;
    } catch (error) {
        console.error('Error in api.ts callPostRestletWithPayload():', error);
        throw new Error('Failed to call RESTlet with payload');
    }
}