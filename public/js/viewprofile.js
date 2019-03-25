let user = document.getElementById('data').getAttribute('data-attribute');
user = JSON.parse(user);

$('.military.ui.dropdown')
    .dropdown('set selected', user.military);

$('.profession.ui.dropdown')
    .dropdown('set selected', user.profession);