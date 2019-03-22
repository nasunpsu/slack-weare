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

function reloadCalendar(){
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
    $('.ui.dropdown').dropdown({});
}

//Get value from an input field
function getFieldValue(fieldId) {
    // 'get field' is part of Semantics form behavior API
    return $('.ui.form').form('get field', fieldId).val();
}

let numDates = 100;
function addTime(){
    const av = window.available;
    const clone = av.cloneNode(true);
    clone.style.display = null;
    const available = $('.availability').last()[0];
    const parent = available.parentNode;
    $(clone).find('input, select').attr('name', function(){
        return $(this).attr('name').slice(0, -1) + numDates;
    });
    parent.insertBefore(clone, available.nextSibling);
    reloadCalendar();
    fields.push( { name: `start${numDates}`, identifier: `start${numDates}` },)
    fields.push( { name: `to${numDates}`, identifier: `to${numDates}` },)
    reloadForm();
    numDates += 1;
}

function removeTime(target){
    const inputs = [...$(target).find('.input')];
    inputs.forEach(input => {
        const name = $(input).attr('name');
        fields = fields.filter(field => field.name !== name);
    });
    $(target).closest('.availability').remove();
    reloadForm();
}

function reloadForm(){
    validationRules = fields.reduce((obj, fieldObj) => {
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
}

let validationRules = {};
$(document).ready(() => {
    reloadCalendar();
    window.available = $('#available')[0].cloneNode(true);
    reloadForm();
});

function submitForm(form, event){
    const array = form.serializeArray();
    let json = array.reduce((obj, current) => {
        obj[current.name] = current.value;
        return obj;
    }, {})
    json.availability = [];

    if('to0' in json){
        delete json.to0;
        delete json.start0;
        delete json.weekday0;
        delete json.available0;
    }
    for(const key in json){
        if(key.startsWith('start')){
            const num = key.slice(5);
            const toKey = `to${num}`;
            const availableKey = `available${num}`;
            const weekdayKey = `weekday${num}`;
            const newVal = {
                start: json[key],
                to: json[toKey],
                available: json[availableKey],
                weekday: json[weekdayKey]
            }
            json.availability.push(newVal);
            delete json[key];
            delete json[toKey];
            delete json[availableKey];
            delete json[weekdayKey];
        }
    }
    if(!json.availability){
        json.availability = [];
    }
    json.availability = JSON.stringify(json.availability);
    console.log(json);
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

let fields = [
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
   { name: 'reccourses', identifier: 'recommended courses' },
   { name: 'instructors', identifier: 'recommended instructor' },
   { name: 'profession', identifier: 'profession' },
   { name: 'military', identifier: 'military' },
   { name: 'fun', identifier: 'fun' },
   { name: 'unique', identifier: 'unique' },
   { name: 'goal', identifier: 'goal' },
   { name: 'pastCities', identifier: 'past cities' },
   { name: 'likeplaces', identifier: 'places' },
   { name: 'married', identifier: 'marital' },
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
   { name: 'start1', identifier: 'start1' },
   { name: 'to1', identifier: 'to1' },
];