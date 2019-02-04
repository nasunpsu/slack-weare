//File used to extract basic ldap data like major from psu's database

const LDAP = require('ldap-client');

/** ldap object that allows us to search psu's data */
let ldap = null;

/**
 * Function to get ldap object used to query psu's ldap database (opens ldap connection if necessary)
 * @returns promise containing ldap object connected and ready to use for psu's ldap database
 */
const getLdap = () => {
    return new Promise((resolve, reject) => {
        //if ldap defined, return it otherwise set it up
        if (!!ldap) {
            resolve(ldap);
            return;
        }
        /** Function when ldap connection is established */
        const onReady = (error) => {
            // if there is an error reject the promise
            if (error) {
                reject(error);
                return;
            }
            resolve(ldap);
        };
        ldap = new LDAP({
            uri: 'ldap://ldap.psu.edu:389',
            validatecert: false,
            connecttimeout: -1,
            base: 'dc=psu,dc=edu',
            attrs: '*',
            filter: '(objectClass=*)',
            scope: LDAP.SUBTREE,
        }, onReady);
    });
};

/**
 * Function that searches the ldap database for a given email
 * @param {string} email Email of the user to search for
 * @returns {Promise<User>} promise containing full ldap data for the user found
 */
const searchLdap = async (email) => {
    const ldap = await getLdap();
    options = {
        filter: `(mail=${email})`,
        attrs: '*'
    }
    return new Promise((resolve, reject) => {
        ldap.search(options, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            if (!Array.isArray(data)) {
                reject('Result is an unexpected type');
                return;
            }
            if (data.length === 0) {
                reject('No results found');
                return;
            }
            if (data.length > 1) {
                console.log(`Multiple results found for ldap query ${options.filter}`);
            }
            const user = new User(data[0]);
            resolve(user);
        });
    });
}

/** Closes ldap connection if it was opened (void) */
const closeLdapConnection = () => {
    if(!ldap){
        return;
    }
    ldap.close();
    ldap = null;
}

/**
 * Uses ldap data to add fields for user in the database
 * @param {email} email Email of user to update
 */
const updateUserWithLdapData = async (email, DB) => {
    let ldapUser = null;
    try{
        ldapUser = await searchLdap(email);
    }
    catch(e){
        console.warn(`Email ${email} not found in ldap`);
        return;
    }
    const insertObj = {
        affiliation: ldapUser.eduPrimaryAffiliation,
        campus: ldapUser.psCampus,
        major: ldapUser.psCurriculum
    };
    for(key in insertObj){
        if(!insertObj[key]){
            delete insertObj[key];
        }
    }
    if(Object.keys(insertObj).length === 0){
        return;
    }
    const query = {email};
    const options = {upsert: true}
    const res = await DB.collection('users').updateOne(query, {$set: insertObj}, options);
    if(!res.result.ok){
        console.warn('Problematic ldap query');
    }
    closeLdapConnection();
}

/** Class containing all attributes the ldap provides */
class User {
    constructor(ldapUser) {
        /** Email address */
        this.eduPersonPrincipalName = ldapUser.eduPersonPrincipalName[0];

        //3 id numbers represented as strings
        // this.uidNumber = ldapUser.uidNumber[0];
        // this.psDirIDN = ldapUser.psDirIDN[0];
        // this.gidNumber = ldapUser.gidNumber[0];

        //3 directories for computs
        // this.psMacLabHomeDir = ldapUser.psMacLabHomeDir[0];
        // this.loginShell = ldapUser.loginShell[0];
        // this.homeDirectory = ldapUser.homeDirectory[0];
        if(this.isValidField(ldapUser.mail)){
            /** PSU email */
            this.mail = ldapUser.mail[0];
        }
        /** Array of waht this person is a part of like 'eduPerson', 'person', 'eduMember' */
        this.objectClass = ldapUser.objectClass;
        /** Array of strings that may contain email lists or enrolled courses not sure */
        this.psMemberOf = ldapUser.psMemberOf;
        if(this.isValidField(ldapUser.psCampus)){
            /** Campus name that student attends */
            this.psCampus = ldapUser.psCampus[0];
        }
        if(this.isValidField(ldapUser.title)){
            /** Title like 'Undergrad Student' */
            this.title = ldapUser.title[0];
        }
        if(!!ldapUser.eduPrimaryAffiliation){
            /** Title like 'Student' */
            this.eduPrimaryAffiliation = ldapUser.eduPrimaryAffiliation;
        }
        /** Array of all affiliations */
        this.eduPersonalAffiliation = ldapUser.eduPersonalAffiliation;
        /** Array of all emails and aliases */
        this.psuMailID = ldapUser.psuMailID;
        if(this.isValidField(ldapUser.cn)){
            /** Full name */
            this.cn = ldapUser.cn[0];
        }
        if(this.isValidField(ldapUser.psCurriculum)){
            /** Major */
            this.psCurriculum = ldapUser.psCurriculum[0];
        }
        /** Search param */
        this.dn = ldapUser.dn;

        /** Full name */
        // this.displayName = ldapUser.displayName[0];
        /** PSU microsoft email */
        // this.psMailbox = ldapUser.psMailbox[0];
        // this.psMailHost = ldapUser.psMailHost[0];
        /** First name */
        // this.givenName = ldapUser.givenName[0];
        // this.psFERPAExam = ldapUser.psFERPAExam[0];
    }

    isValidField(field){
        return !!field && Array.isArray(field) && field.length > 0
    }
}

module.exports = {updateUserWithLdapData};