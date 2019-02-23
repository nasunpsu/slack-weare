(function setUpPostRequests() {
    $.ajaxSetup({
        type: 'POST',
        data: {},
        dataType: 'json',
        xhrFields: {
            withCredentials: true
        },
        crossDomain: true
    });
})();
const serverUrl = 'https://b34f23ca.ngrok.io/log';
/**
 * Logs an event to the logging database
 * @param {string} eventName Name describing the event to log
 * @param {string} eventContent Description of what happened in the event
 */
const logEvent = async (eventName, eventContent) => {
    const sendObj = {
        content: eventContent,
        type: eventName,
        time: new Date().toString()
    }
    return new Promise((resolve, reject) => {
        $.post(serverUrl, sendObj)
            .done(data => resolve(data))
            .fail(data => reject(data))
    })
}