const serverUrl = window.location.origin + '/log';

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
    label: 'home view table'
}];

const triggerScrollEvent = () => {
    const doc = document.documentElement;
    const yStart = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
    const yEnd = (window.innerHeight || doc.clientHeight) + yStart;
    const visibleElements = calcVisibleElements(yStart, yEnd);
    if(visibleElements.length === 0){
       return;
    }
    const visibleElement = visibleElements[0];
    logEvent('Scroll', 'User scrolled to ' + visibleElement);
};

const calcVisibleElements = (yStart, yEnd) => {
    return scrollElements.filter(scrollElement => {
        const element = $(`#${scrollElement.id}`);
        const top = $(element).offset().top;
        const bottom = top + $(element).height();
        return yStart < top &&  bottom < yEnd;
    })
    .map(scrollElement => scrollElement.label);
};

const clickElements = [
   {id: 'connectList', label: 'Connect dropdown'},
   {id: 'profile_uid', label: 'Profile dropdown'},
   {id: 'open-slack', label: 'Open slack button'},
   {id: 'help-button', label: 'Help button'},
   {className: 'slack-link', label: 'Slack link'},
];


document.addEventListener('click', (event) => {
    actionPerformed();
    const { target } = event;
    const label = clickElements.filter(element => {
       if(!!element.className){
          return $(target).closest('.' + element.className).length === 1;
       }
       return $(target).closest('#' + element.id).length === 1;
    }).map(element => element.label)[0];  
    const content = label + ' clicked';
    logEvent('Click', content);
});

// document.addEventListener('keyup', (event) => {
//     actionPerformed();
//     const {key, target} = event;
//     const {id, nodeName, classList, value, innerText} = target;
//     const targetObj = {
//         nodeType: nodeName.toLowerCase(),
//         classList: classList.toString(),
//         tag: target.cloneNode(false).outerHTML
//     };
//     if(!!id){
//         targetObj['id'] = id;
//     }
//     if(!!value){
//         targetObj['value'] = value;
//     }
//     if(!!innerText){
//         targetObj['innerText'] = innerText;
//     }
//     const content = {key, target: targetObj };
//     logEvent('Keyup', content);
// });




/**
 * Logs an event to the logging database
 * @param {string} eventName Name describing the event to log
 * @param {Object} content Extra parameters to send to the server
 */
const logEvent = async (eventName, content) => {
   const timestamp = new Date();
    const sendObj = {
        type: eventName,
        path: window.location.pathname,
        timestamp,
        time: timestamp.toString(),
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
        logEvent('Activity', 'User became active');
        isIdle = false;
    }
};

setInterval(() => {
    const currentTime = new Date();
    if(!isIdle && currentTime - lastActionTime > inactiveThreshold){
        logEvent('Activity', 'User became inactive');
        isIdle = true;
    }
});

/** Time in milliseconds without scroll to trigger a scroll event*/
const scrollThreshold = 500;
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
