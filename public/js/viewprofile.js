let user = document.getElementById('data').getAttribute('data-attribute');
user = JSON.parse(user);



$('.gender.ui.dropdown')
    .dropdown({
        clearable: true,
        placeholder: 'Select gender'
    });

$('.military.ui.dropdown')
    .dropdown({
        clearable: true,
        placeholder: 'Select military status'
    });

$('.profession.ui.dropdown')
    .dropdown({
        clearable: true,
        placeholder: 'Select profession'
    });

$('.military.ui.dropdown')
    .dropdown('set selected', user.military);

$('.profession.ui.dropdown')
    .dropdown('set selected', user.profession);

window.addEventListener("DOMContentLoaded", function () {
    document.getElementById("edit-profile").addEventListener("click", function (e) {
        location.href = "/editProfile";
    });
});