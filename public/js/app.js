$('.search-by-dropdown.ui.dropdown')
  .dropdown({
    clearable: true,
    placeholder: 'Search By'
  });

$('.sort-dropdown.ui.dropdown')
  .dropdown({
    clearable: true,
    placeholder: 'Sort By'
  });

$('.ui.dropdown')
  .dropdown({
  });

var attendees = document.getElementById("attendees").value.split(';').map(function (item) {
  return item.trim();
});
attendees.splice(-1, 1);
console.log(`attendees are ${attendees}`);
$('.select-attendee.ui.fluid.dropdown')
  .dropdown('set selected', attendees);

$('#example1').calendar();