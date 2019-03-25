// $('.menu .ui.dropdown').dropdown({
//   on: 'hover'
// });
// $('.menu a.item').on('click', function() {   
//   $(this)
//     .addClass('active')
//     .siblings()
//     .removeClass('active'); 
// })
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

var connect = document.getElementById('connectList');

var text_to_change = connect.childNodes[0];

switch (window.location.pathname) {
  case '/tablelist':
    text_to_change.nodeValue = 'Connected in Table View';
    break;
  case '/network':
    text_to_change.nodeValue = 'Connected in Network';
    break;
  case '/temporal':
    text_to_change.nodeValue = 'Connected in Timezone Offset';
    break;
  default:
    break;
}
// window.addEventListener("DOMContentLoaded", function () {
//   let connect_options = $('.connect.ui.dropdown').find('a');
//   var updateConnect = function (e) {
//     console.log('connect clicked');
//     // e.preventDefault();

//     // $(e.target)
//     // .closest('.ui.dropdown.connect.item').addClass('active');
//     // let content=$(e.target).text();
//     // $(e.target)
//     // .closest('.ui.dropdown.connect.item').addClass(content);

//   };
//   Array.from(connect_options).forEach(function (element) {
//     element.addEventListener('click', updateConnect);
//   });
// });
