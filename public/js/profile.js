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



//Get value from an input field
function getFieldValue(fieldId) {
    // 'get field' is part of Semantics form behavior API
    return $('.ui.form').form('get field', fieldId).val();
}

function addTime(){
    const av = window.available;
    const clone = av.cloneNode(true);
    const available = $('#available')[0]; 
    const parent = available.parentNode;
    parent.insertBefore(clone, available.nextSibling);
}

$(document).ready(() => {
    const validationRules = fields.reduce((obj, fieldObj) => {
        obj[fieldObj.name] = {
            rules: [
                {
                    type: 'empty',
                    prompt: `Please enter your ${fieldObj.identifier}.`
                },
                {
                    type: 'maxLength[150]',
                    prompt: `Your ${fieldObj.identifier} must be at most {ruleValue} characters.`
                },
            ]
        };
        if(!!fieldObj.rules) {
            obj[fieldObj.name].rules.unshift(...fieldObj.rules);
        }
        return obj;
    }, {});
    const form = $('form');
    form.form({fields: validationRules, onSuccess: submitForm.bind(this, form)});//, { onSuccess: submitForm });
    window.available = $('#available')[0].cloneNode(true);
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

const fields = [
   { name: 'fullname', identifier: 'full name' },
   { name: 'major', identifier: 'major' },
   { name: 'city', identifier: 'city' },
   {
      name: 'email',
      identifier: 'email',
      rules: [{
       type: 'email',
       prompt: 'Invalid Email'
      }]
   },
   { name: 'campus', identifier: 'campus' },
   { name: 'courses', identifier: 'courses' },
   { name: 'goals', identifier: 'goals' },
   { name: 'recommended-courses', identifier: 'recommended courses' },
   { name: 'recommended-instructor', identifier: 'recommended instructor' },
   { name: 'profession', identifier: 'profession' },
   { name: 'military', identifier: 'military' },
   { name: 'fun', identifier: 'fun' },
   { name: 'unique', identifier: 'unique' },
   { name: 'goal', identifier: 'goal' },
   { name: 'past-cities', identifier: 'past cities' },
   { name: 'places', identifier: 'places' },
   { name: 'marital', identifier: 'marital' },
   {
      name: 'kids',
      identifier: 'kids',
      rules: [{
         type: 'integer[0..30]',
         prompt: 'Kids must be a whole number'

      }]
   },
   { name: 'career', identifier: 'career' },
   { name: 'start', identifier: 'start' },
   { name: 'to', identifier: 'to' }
];