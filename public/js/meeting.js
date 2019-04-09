let string_data = document.getElementById("data_string").getAttribute('data');
let meeting = JSON.parse(string_data);
console.log(meeting);

if (meeting.attendees) $('.select-attendee.ui.fluid.dropdown')
    .dropdown('set selected', meeting.attendees.map(m => m.uid));

if (meeting.who == "all" | meeting.who == undefined) {
    $('.select-attendee.ui.dropdown').addClass("disabled");
};
//   var topic = document.getElementById("hidden-topic").value;

let me_id = document.getElementById('profile_uid').getAttribute('data-uid');
if (meeting.creator_uid != me_id && meeting.attendees) { //the meeting is not created by me
    let attendee_me = meeting.attendees.filter(x => x.uid == me_id)[0];
    if (attendee_me.attend == 'accept') $('#accept').removeClass('basic');
    else if (attendee_me.attend == 'reject') $('#reject').removeClass('basic');
    var value = $('div.scroll')[0].innerHTML;
    $('.scroll').html(value.replace(/\r?\n/g,'<br/>'))
}
$('.select-topic.ui.fluid.dropdown')
    .dropdown('set selected', meeting.topic);

$('.select-scope.ui.fluid.dropdown')
    .dropdown('set selected', meeting.who);

// $('.tz.ui.dropdown')
//     .dropdown('set selected', meeting.tz);

// $('#start, #end').calendar(); //instead of start and end; make it normal to choose a start date and time, and specify duration

$('#pop-date').calendar({
    type: 'date'
});
$('#pop-time').calendar({
    type: 'time'
});

var validationRules = {
    fields: {
        "purpose": {
            identifier: "purpose",
            rules: [
                {
                    type: 'empty',
                    prompt: 'Please enter your purpose.'
                },
                {
                    type: 'maxLength[150]',
                    prompt: 'Your purpose must be at most {ruleValue} characters.'
                }
            ]

        },
        "topic": {
            identifier: "topic",
            rules: [
                {
                    type: 'empty',
                    prompt: 'Please select a topic.'
                }
            ]
        },
        "date": {
            identifier: "date",
            rules: [
                {
                    type: 'empty',
                    prompt: 'Please enter the meeting date.'
                }
            ]
        },
        "time": {
            identifier: "time",
            rules: [
                {
                    type: 'empty',
                    prompt: 'Please enter the meeting time.'
                }
            ]
        },
        duration: {
            identifier: 'duration',
            rules: [
                {
                    type: 'integer[1..100]',
                    prompt: 'Please enter an integer value for duration in minutes'
                }
            ]
        }
        // password: ['minLength[6]', 'empty'],
        // skills: ['minCount[2]', 'empty'],
        // terms: 'checked'
    }
}
$('.ui.form').form(validationRules);//, { onSuccess: submitForm });
//Get value from an input field
function getFieldValue(fieldId) {
    // 'get field' is part of Semantics form behavior API
    return $('.ui.form').form('get field', fieldId).val();
}

window.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("meeting-form");

    document.getElementById("save").addEventListener("click", function (e) {
        console.log('save clicked');
        e.preventDefault();
        $('.meeting-form.ui.form').form('validate form');

        // $('.meeting-form.ui.form').form('submit');
        // form.submit(); //this is not necessary if the semantic element has submit class, but we will use Ajax instead
        const Origobj = {};
        Origobj["attendees"] = [];
        jQuery('#meeting-form').serializeArray().map(function (x) {
            if (x.name == "attendees") {
                Origobj["attendees"].push(x.value);
            }
            else Origobj[x.name] = x.value;
            console.log(`${x.name} value is ${x.value}`);
        });
        const UpdateObj = $.extend({
            mid: meeting.mid,
            cid: meeting.cid,
            cname: meeting.cname,
            tz: meeting.tz
        }, Origobj);
        // obj.mid = meeting.mid;
        // obj.cid = meeting.cid ? meeting.cid : 'T0A286J8K_C0A28BAHG';
        // obj.cname = meeting.cname? meeting.cname:'general';
        console.dir(UpdateObj);
        $.ajax({
            type: 'POST', url: '/meeting/' + meeting.mid,
            data: UpdateObj
        }).done(function (res) {
            if (res.success) {
                console.log('id from ajax call is', res);
                location.href = "/meetings";
                // window.location.reload();
            } else {
                console.log('error...ajax');
            };
        });
    });
    // document.getElementById("invite").addEventListener("click", function (e) {
    //     console.log('save and invite clicked');
    //     e.preventDefault();
    //     document.getElementById("invite_label").value = "true";
    //     $('.meeting-form.ui.form').form('validate form');
    //     console.dir($('.ui.form input').serializeArray());
    //     $('.meeting-form.ui.form').form('set value', 'invite', 'true');
    //     // $('.ui.invite').addClass('submit'); //<===== without submit class, click will not trigger the post behavior
    //     // // $('.meeting-form.ui.form').form('submit');
    //     // form.submit();

    // });

    document.getElementById("delete").addEventListener("click", function (e) {
        console.log('delete clicked');
        e.preventDefault();
        const Origobj = {};

        $.ajax({
            type: 'POST', url: '/deletemeeting',
            data: {
                mid: meeting.mid
            }
        }).done(function (res) {
            if (res.success) {
                console.log('id from ajax call is', res);
                location.href = "/meetings";
                // window.location.reload();
            } else {
                console.log('error...ajax');
            };
        });
    });

    document.getElementById("reject").addEventListener("click", function (e) {
        console.log('reject clicked');
        // if($(e.target).hasClass('basic')) {// element reject/accept clicked
        //     $(e.target).removeClass('basic');
        //     $($(e.target).siblings('.button')[0]).addClass('basic')
        // }
        // else {
        //     $(e.target).addClass('basic');
        //     $($(e.target).siblings('.button')[0]).removeClass('basic');
        // }
        e.preventDefault();
        $.ajax({
            type: 'POST',
            url: '/reactmeeting',
            data: {
                mid: meeting.mid,
                react: "reject",
                who_react: document.getElementById("profile_uid").getAttribute("data-uid"),
                attendees: $(".ui.form").form('get value', 'attendees')
            }
        })
            .done(function (res) {
                if (res.success) {
                    console.log('id from ajax call is', res);
                    location.href = "/meetings";
                    // window.location.reload();
                } else {
                    console.log('error...ajax');
                };
            })
    });



    document.getElementById("accept").addEventListener("click", function (e) {
        console.log('save clicked');
        e.preventDefault();
        $.ajax({
            type: 'POST', url: '/reactmeeting', data: {
                mid: meeting.mid,
                react: "accept",
                who_react: document.getElementById("profile_uid").getAttribute("data-uid"),
                attendees: $(".ui.form").form('get value', 'attendees')
            }, success: function (res) {
                if (res.success) {
                    console.log('id from ajax call is', res);
                    location.href = "/meetings";
                    // window.location.reload();
                } else {
                    console.log('error...ajax');
                };
            }
        });

    });
    document.querySelector('select[name="who"]').onchange = changeEventHandler;
    function changeEventHandler(event) {
        if (event.target.value == 'all') {
            console.log('changing attribute into disabled')
            // document.getElementById("select-attendees").setAttribute("disabled", "disabled");

            $('.select-attendee.ui.fluid.dropdown')
                .dropdown('set selected', meeting.cmembers.map(m => m.uid));
            $('.select-attendee.ui.dropdown').addClass("disabled");
            // $('.select-attendee.ui.dropdown');
        }
        else {
            console.log('removing attribute into disabled')
            // document.getElementById("select-attendees").removeAttribute("disabled");
            $('.select-attendee.ui.dropdown').removeClass("disabled");
        }
    }
}, false);

    // function submitForm() {
    //     console.log('submmitForm() function called');
    //     var formData = {
    //         purpose: getFieldValue('purpose'),
    //         topic: getFieldValue('topic'),
    //         description: getFieldValue('description'),
    //         date: getFieldValue('date'),
    //         time: getFieldValue('time'),
    //         duration: getFieldValue('duration'),
    //         attendees: getFieldValue('attendees'),
    //     };

    //     // $.ajax({ type: 'POST', url: '/meeting/:'+meeting.mid, data: formData, success: onFormSubmitted });
    // }

    // Handle post response
    // function onFormSubmitted(response) {
    //     // Do something with response ...
    //     alert(`successfully submmited form `);
    // }
