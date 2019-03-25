window.addEventListener("DOMContentLoaded", function () {

    document.getElementById("new").addEventListener("click", function (e) {
        console.log('save clicked');
        // e.preventDefault();
        location.href = "/meeting/new";
    });

    var remind_list = Array.prototype.slice.call(document.getElementsByClassName("button remind"));
    console.log(remind_list);
    
    var updateRemind = function (e) {
        console.log('remind clicked');
        e.preventDefault();
        const attendees = JSON.parse(e.target.getAttribute("data-attendees"));
        $.ajax({
            type: 'POST', url: '/remindmeeting', data: {
                mid: e.target.getAttribute("data-mid"),
                attendees: attendees
            }, success: function (data) {
                console.log(data);
                console.log('successfully remind');
            }
        });
    };
    Array.from(remind_list).forEach(function (element) {
        element.addEventListener('click', updateRemind);
    });
    var react_list = Array.prototype.slice.call(document.getElementsByClassName("reject")).concat(Array.prototype.slice.call(document.getElementsByClassName("accept")));//[...Array.from(document.getElementsByClassName("reject")), ...Array.from(document.getElementsByClassName("accept"))];
    console.log(react_list);
    var reactUpdate = function (e) {
        console.log('react reject/accept clicked');
        const attendees = JSON.parse(e.target.getAttribute("data-attendees")).map(x => x.uid);
        e.preventDefault();
        $.ajax({
            type: 'POST', url: '/reactmeeting', data: {
                mid: e.target.getAttribute("data-mid"),
                react: e.target.getAttribute("data-react"),
                who_react: document.getElementById("profile_uid").getAttribute("data-uid"),
                attendees: attendees
            }, success: function (data) {
                console.log(data);
                console.log('successfully reject');
            }
        });
    };
    // for (var i = 0; i < react_list.length; i++) {
    //     react_list[i].addEventListener('click', reactUpdate, false);
    // }

    Array.from(react_list).forEach(function (element) {
        element.addEventListener('click', reactUpdate);
    });

    // document.getElementById("reject").addEventListener("click", function (e) {
    //     console.log('reject clicked');
    //     e.preventDefault();
    //     $.ajax({ type: 'POST', url: '/reactmeeting', data: {
    //         mid:meeting.e.target.getAttribute("data-mid"),
    //         react: e.target.getAttribute("data-react"),
    //         who_react: document.getElementById("profile_uid").getAttribute("data-uid"),
    //         attendees: e.target.getAttribute("data-attendees")
    //     },success: function(data) {
    //         console.log(data);
    //         console.log('successfully reject');
    //     }});

    // });

    // document.getElementById("accept").addEventListener("click", function (e) {
    //     console.log('save clicked');
    //     e.preventDefault();
    //     $.ajax({ type: 'POST', url: '/reactmeeting', data: {
    //         mid:meeting.e.target.getAttribute("data-mid"),
    //         react: e.target.getAttribute("data-react"),
    //         who_react: document.getElementById("profile_uid").getAttribute("data-uid"),
    //         attendees: e.target.getAttribute("data-attendees")
    //     },success: function(data) {
    //         console.log(data);
    //         console.log('successfully accept');
    //     }});

    // });
}, false);