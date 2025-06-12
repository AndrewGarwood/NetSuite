/**
 * @file src/utils/ns/record/relationships/Employee.ts
 */
import { RecordRef } from "../Record";
import { Relationship } from "./Relationship";



/**
 * @interface **`Employee`**
 * @extends {Relationship} 
 * **{@link Relationship}**`.keys()` = 
 * `['email', 'datecreated', 'entityid', 'externalid', 'internalid',
 *  'firstname', 'title', 'salutation', 'isinactive', 'homephone', 'mobilephone', 'fax', 
 * 'phone', 'lastname', 'comments', 'subsidiary', 'middlename', 'globalsubscriptionstatus',]`
 * */
export interface Employee extends Relationship {
    initials?: string;
    supervisor?: string | RecordRef;
    department?: string | RecordRef;
    class?: string | RecordRef;
    issalesrep?: boolean;
    isjobmanager?: boolean;
    isjobresource?: boolean;
    i9verified?: boolean;
    directdeposit?: boolean;
    hiredate?: Date | string;
    workplace?: string | RecordRef;
    approver?: string | RecordRef;
}