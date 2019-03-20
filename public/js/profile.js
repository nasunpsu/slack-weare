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


const fields = ['fullname', 'major', 'city', 'email', 'campus', 'courses', 'goals', 'recommended-courses', 'recommended-instructor', 'profession', 'military', 'fun', 'unique', 'goal', 'past-cities', 'places', 'marital', 'kids', 'career', 'start', 'to'];

const validationRules = fields.reduce((obj, field) => {
    obj[field] = {
        rules: [
            {
                type: 'empty',
                prompt: 'Please enter your {name}.'
            },
            {
                type: 'maxLength[150]',
                prompt: 'Your major must be at most {ruleValue} characters.'
            }
        ]
    }
    return obj;
}, {});
validationRules.email.rules.push({
    type: 'email',
    prompt: 'Invalid Email'
});
validationRules.kids.rules.push({
    type: 'integer[0..30]',
    prompt: 'Kids must be a whole number'

});
//Get value from an input field
function getFieldValue(fieldId) {
    // 'get field' is part of Semantics form behavior API
    return $('.ui.form').form('get field', fieldId).val();
}


$(document).ready(() => {
    const form = $('form');
    form.form({fields: validationRules, onSuccess: submitForm.bind(this, form)});//, { onSuccess: submitForm });
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