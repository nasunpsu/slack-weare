string_data = document.getElementById("chart").getAttribute('visdata');
graph = JSON.parse(string_data);
console.log(graph);

edges = [];

graph.links.forEach(function (link) {
    // Get the source and target nodes
    var sourceNode = graph.nodes.filter(function (n) { return n.uid === link.source; })[0],
        targetNode = graph.nodes.filter(function (n) { return n.uid === link.target; })[0];

    // Add the edge to the array
    var edge = { source: sourceNode, target: targetNode };
    edge.value = +link.value;
    edges.push(edge);

});
graph.links = edges;

//Constants for the SVG
var width = 800,
    height = 600;

//Set up the colour scale
var color = d3.scale.category20();

//set up the scale for the distance / similarity index
scale_s = d3.scale.linear()
  .domain(graph.disL)
  .range([120, 20]);

//Set up the force layout
var force = d3.layout.force()
    .charge(-300)//default is -30, original was 120
    // .center(width / 2, height / 2)
    // .link(d3.forceLink().distance(function(d) {
    //     return d.distance;
    //   }))
    .linkDistance(d => scale_s(d.value))
    .linkStrength(0.5)
    .size([width, height]);


d3.select("input[type=range]")
    .on("input", changeStrength);
//Append a SVG to the body of the html page. Assign this SVG as an object to svg
var svg = d3.select(".network").append("svg")
    .attr("width", width)
    .attr("height", height);

//Read the data from the mis element 
// var mis = document.getElementById('mis').innerHTML;
// graph = JSON.parse(mis);

//Creates the graph data structure out of the json data
force.nodes(graph.nodes)
    .links(graph.links)
    .start();

//Create all the line svgs but without locations yet
var link = svg.selectAll(".link")
    .data(graph.links);
    link.exit().remove();
    link.enter().append("line")
    .attr("class", "link")
    .style("stroke-width", function (d) {
        return Math.sqrt(d.value);
    });

//Do the same with the circles for the nodes - no 
// var node = svg.selectAll(".node")
//     .data(graph.nodes)
//     .enter().append("circle")
//     .attr("class", "node")
//     .attr("r", 8)
//     .style("fill", function (d) {
//         return color(d.group);
//     })
//     .call(force.drag);


var node = svg.selectAll(".node")
    .data(graph.nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(force.drag);

node.append("defs")
    .append("clipPath")
    .attr("id", "clip")
    .append("circle")
    .attr("cx", 15)
    .attr("cy", 15)
    .attr("r", 20);

node.append("circle")
    .attr("cx", 15)
    .attr('cy', 15)
    .attr("r", 20)
    .style({ "fill": "transparent", "border": "solid", "stroke": "gray", 'stroke-width': "1px" });

// Append images
var images = node.append("image")
    .attr("xlink:href", function (d) { return d.image_48; })
    .attr("x", function (d) { return -8; })
    .attr("y", function (d) { return -8; })
    .attr("height", 50)
    .attr("width", 50)
    .style('clip-path', 'url(#clip)');

// make the image grow a little on mouse over and add the text details on click
// var setEvents = images
//     // Append hero text
//     .on('click', function (d) {
//         d3.select("h1").html(d.hero);
//         d3.select("h2").html(d.name);
//         d3.select("h3").html("Take me to " + "<a href='" + d.link + "' >" + d.hero + " web page ⇢" + "</a>");
//     })

//     .on('mouseenter', function () {
//         // select element in current context
//         d3.select(this)
//             .transition()
//             .attr("x", function (d) { return -60; })
//             .attr("y", function (d) { return -60; })
//             .attr("height", 100)
//             .attr("width", 100);
//     })
//     // set back
//     .on('mouseleave', function () {
//         d3.select(this)
//             .transition()
//             .attr("x", function (d) { return -25; })
//             .attr("y", function (d) { return -25; })
//             .attr("height", 50)
//             .attr("width", 50);
//     });



node.append("text")
    .attr("class", "nodetext")
    .attr("dx", 30)//10
    .attr("dy", ".45em")//.35em
    .text(function (d) { return d.first_name })
    .style("stroke", "gray");

node.transition()
    .duration(750)
    .delay(function (d, i) { return i * 5; })
    .attrTween("r", function (d) {
        var i = d3.interpolate(0, d.radius);
        return function (t) { return d.radius = i(t); };
    });

//Now we are giving the SVGs co-ordinates - the force layout is generating the co-ordinates which this code is using to update the attributes of the SVG elements
force.on("tick", function () {
    link.attr("x1", function (d) {
        return d.source.x;
    })
        .attr("y1", function (d) {
            return d.source.y;
        })
        .attr("x2", function (d) {
            return d.target.x;
        })
        .attr("y2", function (d) {
            return d.target.y;
        });

    // d3.selectAll("circle").attr("cx", function (d) {
    //     return d.x;
    // })
    //     .attr("cy", function (d) {
    //         return d.y;
    //     });

    // d3.selectAll("image").attr("x", function (d) {
    //     return d.x;
    // })
    //     .attr("y", function (d) {
    //         return d.y;
    //     });

    // d3.selectAll("text").attr("x", function (d) {
    //     return d.x;
    // })
    //     .attr("y", function (d) {
    //         return d.y;
    //     });


    // svg.selectAll("g").attr("transform", (d) =>
    //     d.fixed == true ? "translate(" + width / 2 + "," + height / 2 + ")" : "translate(" + d.x + "," + d.y + ")");
    node.each(collide(0.5))
        .attr("transform", (d) => {
            if (isNaN(d.x)) {
                console.log(`there is a NaN for ${JSON.stringify(d)}`);
                return;
            }
            return "translate(" + d.x + "," + d.y + ")";
        });

    // d.fixed == true ? "translate(" + width / 2 + "," + height / 2 + ")" : "translate(" + d.x + "," + d.y + ")"); //Collision detection
});

var padding = 1, // separation between circles
    radius = 8;
function collide(alpha) {
    var quadtree = d3.geom.quadtree(graph.nodes);
    return function (d) {
        var rb = 2 * radius + padding,
            nx1 = d.x - rb,
            nx2 = d.x + rb,
            ny1 = d.y - rb,
            ny2 = d.y + rb;
        quadtree.visit(function (quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== d)) {
                var x = d.x - quad.point.x,
                    y = d.y - quad.point.y,
                    l = Math.sqrt(x * x + y * y);
                if (l < rb) {
                    l = (l - rb) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
    };
}

//adjust threshold
function threshold(thresh) {
    graph.links.splice(0, graph.links.length);
    for (var i = 0; i < graphRec.links.length; i++) {
        if (graphRec.links[i].value > thresh) { graph.links.push(graphRec.links[i]); }
    }
    restart();
}
//Restart the visualisation after any node and link changes
function restart() {
    link = link.data(graph.links);
    link.exit().remove();
    link.enter().insert("line", ".node").attr("class", "link");
    node = node.data(graph.nodes);
    node.enter().insert("circle", ".cursor").attr("class", "node").attr("r", 5).call(force.drag);
    force.start();
}

function changeStrength() {
    force.linkStrength(+this.value);
    force.alpha(1).resume();
}