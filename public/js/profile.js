// let string_data = document.getElementById("data_string").getAttribute('data');
// let meeting = JSON.parse(string_data);
// console.log(meeting);

// if (meeting.attendees) $('.select-attendee.ui.fluid.dropdown')
//     .dropdown('set selected', meeting.attendees.map(m => m.uid));

// if (meeting.who == "all" | meeting.who == undefined) {
//     $('.select-attendee.ui.dropdown').addClass("disabled");
// };
// //   var topic = document.getElementById("hidden-topic").value;
// $('.select-topic.ui.fluid.dropdown')
//     .dropdown('set selected', meeting.topic);

// $('.select-scope.ui.fluid.dropdown')
//     .dropdown('set selected', meeting.who);

// $('#start, #end').calendar(); //instead of start and end; make it normal to choose a start date and time, and specify duration

const profileUrl = window.location.origin + '/editProfile';

let ls_wd = $('.week-day');
for(let i = 0 ; i < ls_wd.length; i+=1) {
    const element = ls_wd[i];
    $(element).calendar({
        type: 'time'
    });
}

$('.ui.checkbox')
  .checkbox()
;


var validationRules = {
    major: {
        rules: [
            {
                type: 'empty',
                prompt: 'Please enter your major.'
            },
            {
                type: 'maxLength[150]',
                prompt: 'Your major must be at most {ruleValue} characters.'
            }
        ]

    }

    // fields: {
    //     "purpose": {
    //         identifier: "purpose",
    //         rules: [
    //             {
    //                 type: 'empty',
    //                 prompt: 'Please enter your purpose.'
    //             },
    //             {
    //                 type: 'maxLength[150]',
    //                 prompt: 'Your purpose must be at most {ruleValue} characters.'
    //             }
    //         ]

    //     },
    //     "topic": {
    //         identifier: "topic",
    //         rules: [
    //             {
    //                 type: 'empty',
    //                 prompt: 'Please select a topic.'
    //             }
    //         ]
    //     },
    //     "date": {
    //         identifier: "date",
    //         rules: [
    //             {
    //                 type: 'empty',
    //                 prompt: 'Please enter the meeting date.'
    //             }
    //         ]
    //     },
    //     "time": {
    //         identifier: "time",
    //         rules: [
    //             {
    //                 type: 'empty',
    //                 prompt: 'Please enter the meeting time.'
    //             }
    //         ]
    //     },
    //     duration: {
    //         identifier: 'duration',
    //         rules: [
    //             {
    //                 type: 'integer[1..100]',
    //                 prompt: 'Please enter an integer value for duration in minutes'
    //             }
    //         ]
    //     },
    //     password: ['minLength[6]', 'empty'],
    //     skills: ['minCount[2]', 'empty'],
    //     terms: 'checked'
    // }
}
//Get value from an input field
function getFieldValue(fieldId) {
    // 'get field' is part of Semantics form behavior API
    return $('.ui.form').form('get field', fieldId).val();
}


$(document).ready(() => {
    const form = $('form');
    form.form({fields: validationRules, onSuccess: submitForm.bind(this, form), onFailure: failure});//, { onSuccess: submitForm });
    //     console.log(json);
    // })
});

function submitForm(form, event){
    const array = form.serializeArray();
    const json = array.reduce((obj, current) => {
        obj[current.name] = current.value;
        return obj;
    }, {})
    $.post(profileUrl, json)
        .done(data => console.log(data))
        .fail(data => {
            console.warn(data);
        });
    return false;
}

function failure(messages){
    console.log(messages);
    return false;
}