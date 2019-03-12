var classname = document.getElementsByClassName("classname");

var myFunction = function () {
    var attribute = this.getAttribute("data-myattribute");
    alert(attribute);
};

for (var i = 0; i < classname.length; i++) {
    classname[i].addEventListener('click', myFunction, false);
}

Array.from(classname).forEach(function (element) {
    element.addEventListener('click', myFunction);
});

window.addEventListener("DOMContentLoaded", function () {

    document.getElementById("new").addEventListener("click", function (e) {
        console.log('save clicked');
        // e.preventDefault();
        location.href = "/meeting/new";
    });
}, false);