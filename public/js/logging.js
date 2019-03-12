const serverUrl = 'http://16778e8a.ngrok.io/log';

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

const scrollElements = [{
    id: 'home-table',
    route: '/home',
    label: 'home view table'
}]

const triggerScrollEvent = () => {
    const doc = document.documentElement;
    const yStart = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
    const yEnd = (window.innerHeight || doc.clientHeight) + yStart;
    const visibleElements = calcVisibleElements(yStart, yEnd);
    const content = {
        yStart,
        yEnd,
        elements: visibleElements
    }
    logEvent('Scroll', content);
}

const calcVisibleElements = (yStart, yEnd) => {
    return scrollElements.filter(scrollElement => {
        const element = $(`#${scrollElement.id}`);
        const top = $(element).offset().top;
        const bottom = top + $(element).height();
        return yStart < top &&  bottom < yEnd;
    })
    .map(scrollElement => scrollElement.label);
}


document.addEventListener('click', (event) => {
    actionPerformed();
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
    actionPerformed();
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




/**
 * Logs an event to the logging database
 * @param {string} eventName Name describing the event to log
 * @param {Object} content Extra parameters to send to the server
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

/** Time in milliseconds without the use doing anything to trigger an inactive event */
const inactiveThreshold = 10000; 
/** Time that the last action was performed */
let lastActionTime = new Date();
/** If the user is currently not doing anythign  */
let isIdle = false;

const actionPerformed = () => {
    lastActionTime = new Date();
    if(isIdle){
        logEvent('Activity', {type: 'Active'});
        isIdle = false;
    }
}

setInterval(() => {
    const currentTime = new Date();
    if(!isIdle && currentTime - lastActionTime > inactiveThreshold){
        logEvent('Activity', {type: 'Inactive'});
        isIdle = true;
    }
});

/** Time in milliseconds without scroll to trigger a scroll event*/
const scrollThreshold = 2000;
/** Last time the document scroll event was triggered */
let lastScroll = null;
let isScrolling = false;

setInterval(() => {
    const currentTime = new Date();
    if(!isScrolling){
        return;
    }
    if(currentTime - lastScroll > scrollThreshold){
        isScrolling = false;
        triggerScrollEvent();
    }
}, 100);

document.addEventListener('scroll', () => {
    actionPerformed();
    lastScroll = new Date();
    isScrolling = true;
});

document.addEventListener('mousemove', actionPerformed);