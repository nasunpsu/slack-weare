var LDAP = require('ldap-client');
var ldap = new LDAP({
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
    options = {
        base: 'dc=psu,dc=edu',
        scope: LDAP.SUBTREE,
        filter: '(objectClass=*)',
        attrs: '*'
    }
    ldap.search(options, (err, data) => {
        console.log(data);
    });
});