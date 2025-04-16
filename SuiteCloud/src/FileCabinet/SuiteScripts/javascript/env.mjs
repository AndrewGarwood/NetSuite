import dotenv from 'dotenv';
dotenv.config();

export const NODE_ENV = (process.env.NODE_ENV || 'MISSING_ENV_VARIABLE-NODE_ENV');
export const inDevelopment = NODE_ENV === 'development';
export const inProduction = NODE_ENV === 'production';

export const REST_CLIENT_ID = inProduction 
    ? process.env.PROD_REST_CLIENT_ID 
    : (inDevelopment ? process.env.SB_REST_CLIENT_ID : 'MISSING_ENV_VARIABLE-REST_CLIENT_ID');
export const REST_CLIENT_SECRET = inProduction
    ? process.env.PROD_REST_CLIENT_SECRET
    : (inDevelopment ? process.env.SB_REST_CLIENT_SECRET : 'MISSING_ENV_VARIABLE-REST_CLIENT_SECRET');
export const REST_APPLICATION_ID = inProduction
    ? process.env.PROD_REST_APPLICATION_ID
    : (inDevelopment ? process.env.SB_REST_APPLICATION_ID : 'MISSING_ENV_VARIABLE-REST_APPLICATION_ID');


export const ACCOUNT_ID = (process.env.ACCOUNT_ID || 'MISSING_ENV_VARIABLE-ACCOUNT_ID');
export const NLAUTH_EMAIL = (process.env.NLAUTH_EMAIL || 'MISSING_ENV_VARIABLE-NLAUTH_EMAIL');
export const NLAUTH_SIGNATURE = (process.env.NLAUTH_SIGNATURE || 'MISSING_ENV_VARIABLE-NLAUTH_SIGNATURE');

export const NLAUTH_ADMIN = '3';
export const NLAUTH_DEV = '55';

export const AUTH_HEADER = `\
NLAuth nlauth_account=${ACCOUNT_ID}, nlauth_email=${NLAUTH_EMAIL}, \
nlauth_signature=${NLAUTH_SIGNATURE}, nlauth_role=${NLAUTH_DEV}, \
nlauth_application_id=${REST_APPLICATION_ID}`;

export const REST_ACCESS_TOKEN_ID = (process.env.REST_ACCESS_TOKEN_ID || 'MISSING_ENV_VARIABLE-REST_ACCESS_TOKEN_ID');
export const REST_ACCESS_TOKEN_SECRET = (process.env.REST_ACCESS_TOKEN_SECRET || 'MISSING_ENV_VARIABLE-REST_ACCESS_TOKEN_SECRET');

export const SANDBOX_ACCOUNT_ID=`${ACCOUNT_ID}_SB1`;
export const SANDBOX_SUITETALK_URL=`https://${SANDBOX_ACCOUNT_ID}.suitetalk.api.netsuite.com/`;
export const SANDBOX_REST_URL=`https://${SANDBOX_ACCOUNT_ID}.restlets.api.netsuite.com/`;
export const SANDBOX_AUTH_ENDPOINT = `https://${SANDBOX_ACCOUNT_ID}.app.netsuite.com/app/login/oauth2/authorize.nl`
export const SANDBOX_ACCESS_TOKEN_ENDPOINT = `https://${SANDBOX_ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`
