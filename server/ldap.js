const LDAP = require('ldap-client');
const getLdap = (() => {
    let ldap = null;
    return () => new Promise((resolve, reject) => {
        if (!!ldap) {
            resolve(ldap);
            return;
        }
        ldap = new LDAP({
            uri: 'ldap://ldap.psu.edu:389',
            validatecert: false,
            connecttimeout: -1,
            base: 'dc=psu,dc=edu',
            attrs: '*',
            filter: '(objectClass=*)',
            scope: LDAP.SUBTREE,
            connect: () => null,
            disconnect: () => null,
        }, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(ldap);
        });

    });
})();

const searchLdap = async (email) => {
    const ldap = await getLdap();
    console.log(ldap);
    options = {
        base: 'dc=psu,dc=edu',
        scope: LDAP.SUBTREE,
        filter: `(mail=${email})`,
        attrs: '*'
    }
    return new Promise((resolve, reject) => {
        ldap.search(options, (err, data) => {
            if(err){
                reject(err);
                return;
            }
            resolve(data);
        });
    });
}
searchLdap('mrm6089@psu.edu').then(res => {
    console.log(res);
});