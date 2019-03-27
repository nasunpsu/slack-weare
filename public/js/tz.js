
window.addEventListener("DOMContentLoaded", function () {

    // var detail_list = Array.prototype.slice.call(document.getElementsByClassName("user-detail"));
    // console.log(detail_list);

    // var UserOver = function (e) {
    //     console.log('detail hovered');
    //     e.preventDefault();
    //     $(e.target).addClass('user-over')
    // };
    // Array.from(detail_list).forEach(function (element) {
    //     element.addEventListener('mouseover', UserOver);
    // });

    $(".user").hover(function () {
        $(this).find('.user-detail').css({ "opacity": "1", "z-index": "3" });
        $(this).find('.user-img').css({ "z-index": "3" });
    }, function () {
        $(this).find('.user-detail').css({ "opacity": "0", "z-index": "1" });
        $(this).find('.user-img').css({ "z-index": "2" });
    });
    // var ws = new WebSocket('ws://localhost:8080/temporal/presenceUpdate');
    var ws = new WebSocket('wss://weconnect.ist.psu.edu:8443/temporal/presenceUpdate');
    ws.onmessage = function (message) {
        console.log('message is ' + JSON.stringify(message.data))
        var obj_data = JSON.parse(message.data);
        var update = document.getElementById(obj_data.team + '_' + obj_data.user);
        if (update) {
            if (obj_data.presence == "away") $(update.getElementsByClassName("user-presence")[0]).addClass("user-presence-away");
            else $(update.getElementsByClassName("user-presence")[0]).removeClass("user-presence-away");
        }
        // update.innerHTML = obj_data.user+ ' from '+ obj_data.team + 'is ' + obj_data.presence;
    }
    $.ajax({
        type: 'POST', url: '/rtmconnect',
    }).done(function (res) {
        if (res.success) {
            console.log('rtmConnect updating', res);
            // window.location.reload();
        } else {
            console.log('error...ajax');
        };
    });
    // (function () {

    var clockElements = Array.prototype.slice.call(document.getElementsByClassName("clock"));

    function updateClock(clocks) {
        clocks.forEach(clock => {
            // console.log(clock.getAttribute("tz"));
            if(clock.getAttribute("locale"))clock.innerHTML = new Date().toLocaleTimeString(clock.getAttribute("locale"),
                {
                    timeZone: clock.getAttribute("tz"),
                    hour: '2-digit',
                    minute: '2-digit'
                });
            else clock.innerHTML = 'Unknown time'
        });
    }
    updateClock(clockElements);
    setInterval(function () {
        updateClock(clockElements);
    }, 1000 * 60);

    //   }());

});
