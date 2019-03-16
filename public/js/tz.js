var ws = new WebSocket('ws://localhost:8080/temporal/presenceUpdate');
ws.onmessage = function (message) {
    console.log('message is ' + JSON.stringify(message.data))
    var obj_data = JSON.parse(message.data);
    var update = document.getElementById(obj_data.team+'_'+obj_data.user);
    if(obj_data.presence=="away")$(update.getElementsByClassName("user-presence")[0]).addClass("user-presence-away");
    else $(update.getElementsByClassName("user-presence")[0]).removeClass("user-presence-away");
    // update.innerHTML = obj_data.user+ ' from '+ obj_data.team + 'is ' + obj_data.presence;
} 