//File used to extract basic ldap data like major from psu's database

const LDAP = require('ldap-client');
/**
 * Function to get ldap object used to query psu's ldap database
 * @returns promise containing ldap object connected and ready to use for psu's ldap database
 */
const getLdap = (() => {
    /** ldap object to return */
    let ldap = null;
    return () => new Promise((resolve, reject) => {
        //if ldap defined, return it otherwise set it up
        if (!!ldap) {
            resolve(ldap);
            return;
        }
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
})();

/**
 * Function that searches the ldap database for a given email
 * @param {*} email Email of the user to search for
 * @returns promise containing full ldap data for the user found
 */
const searchLdap = async (email) => {
    const ldap = await getLdap();
    options = {
        filter: `(mail=${email})`,
        attrs: '*'
    }
    return new Promise((resolve, reject) => {
        ldap.search(options, (err, data) => {
            if(err){
                reject(err);
                return;
            }
            if(!Array.isArray(data)){
                reject('Result is an unexpected type');
                return;
            }
            if(data.length === 0){
                reject('No results found');
                return;
            }
            if(data.length > 1){
                console.log(`Multiple results found for ldap query ${options.filter}`);
            }
            const user = new User(data[0]);
            resolve(user);
        });
    });
}


searchLdap('mrm6089@psu.edu').then(res => {
    console.log(res.mail);
});

class User{
    constructor(user){
        /** Email address */
        this.eduPersonPrincipalName = user.eduPersonPrincipalName[0];

        //3 id numbers represented as strings
        this.uidNumber = user.uidNumber[0];
        this.psDirIDN = user.psDirIDN[0];
        this.gidNumber = user.gidNumber[0];

        //3 directories for computs
        this.psMacLabHomeDir = user.psMacLabHomeDir[0];
        this.loginShell = user.loginShell[0];
        this.homeDirectory = user.homeDirectory[0];

        /** PSU email */
        this.mail = user.mail[0];
        /** Array of waht this person is a part of like 'eduPerson', 'person', 'eduMember' */
        this.objectClass = user.objectClass;
        /** Array of strings that may contain email lists or enrolled courses not sure */
        this.psMemberOf = user.psMemberOf;
        /** Campus name that student attends */
        this.psCampus = user.psCampus[0];
        /** Title like 'Undergrad Student' */
        this.title = user.title[0];
        /** Title like 'Student' */
        this.eduPrimaryAffiliation = user.eduPrimaryAffiliation;
        /** Array of all affiliations */
        this.eduPersonalAffiliation = user.eduPersonalAffiliation;
        /** Array of all emails and aliases */
        this.psuMailID = user.psuMailID;
        /** Full name */
        this.cn = user.cn[0];
        /** Full name */
        this.displayName = user.displayName[0];
        /** PSU microsoft email */
        this.psMailbox = user.psMailbox[0];
        this.psMailHost = user.psMailHost[0];
        /** Frist name */
        this.givenName = user.givenName[0];
        this.psFERPAExam = user.psFERPAExam[0];
        /** Major */
        this.psCurriculum = user.psCurriculum[0];
        /** Search param */
        this.dn = user.dn;
    }
}

module.exports = searchLdap;