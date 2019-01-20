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
    console.log(ldap);
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
            resolve(data[0]);
        });
    });
}

module.exports = searchLdap;