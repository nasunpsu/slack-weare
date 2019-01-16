var width = 960,     // svg width
    height = 600,     // svg height
    dr = 4,      // default point radius
    off = 15,    // cluster hull offset
    collapse = {}, // collapsed clusters
    data, net, force, hullg, hull, linkg, link, nodeg, node;

var curve = d3.svg.line()
    .interpolate("cardinal-closed")
    .tension(.85);

var fill = d3.scale.category20();
var fillg = d3.scale.category10();

function noop() { return false; }

function nodeid(n) {
    return n.size ? "_g_" + n.group : n.name;
}

function linkid(l) {
    var u = nodeid(l.source),
        v = nodeid(l.target);
    return u < v ? u + "|" + v : v + "|" + u;
}

function getGroup(n) {
    console.log(n);
    if (n == undefined) {
        console.log(n);
    }
    return n.group;
}

// constructs the network to visualize
function network(data, prev, index, collapse) {
    collapse = collapse || {};
    var gm = {},    // group map
        nm = {},    // node map
        lm = {},    // link map
        gn = {},    // previous group nodes
        gc = {},    // previous group centroids
        nodes = [], // output nodes
        links = []; // output links

    // process previous nodes for reuse or centroid calculation
    if (prev) {
        prev.nodes.forEach(function (n) {
            console.log(`prev nodes n are ${n}`)
            var i = index(n), o;
            if (n.size > 0) {
                gn[i] = n;
                n.size = 0;
            } else {
                o = gc[i] || (gc[i] = { x: 0, y: 0, count: 0 });
                o.x += n.x;
                o.y += n.y;
                o.count += 1;
            }
        });
    }

    // determine nodes
    for (var k = 0; k < data.nodes.length; ++k) {
        console.log(`nodes k is ${k}`);
        var n = data.nodes[k],
            i = index(n),
            l = gm[i] || (gm[i] = gn[i]) || (gm[i] = { group: i, size: 0, nodes: [] });

        if (collapse[i] !== true) {
            // the node should be directly visible
            nm[n.name] = nodes.length;
            nodes.push(n);
            if (gn[i]) {
                // place new nodes at cluster location (plus jitter)
                n.x = gn[i].x + Math.random();
                n.y = gn[i].y + Math.random();
            }
        } else {
            // the node is part of a collapsed cluster
            if (l.size == 0) {
                // if new cluster, add to set and position at centroid of leaf nodes
                nm[i] = nodes.length;
                nodes.push(l);
                if (gc[i]) {
                    l.x = gc[i].x / gc[i].count;
                    l.y = gc[i].y / gc[i].count;
                }
            }
            l.nodes.push(n);
        }
        // always count group size as we also use it to tweak the force graph strengths/distances
        l.size += 1;
        n.group_data = l;
    }

    for (i in gm) { gm[i].link_count = 0; }

    // determine links
    console.log(`links are`)
    console.dir(data.links);
    for (k = 0; k < data.links.length; ++k) {
        console.log(`k is ${k}`);
        console.log(`e is `);
        console.dir(data.links[k])
        var e = data.links[k],
            u = index(e.source),
            v = index(e.target);
        console.log(`e element is`);
        console.dir(e);
        console.log(`gm includes`)
        console.dir(gm);
        console.log(u);
        console.log(v);
        if (u != v) {
            gm[u].link_count++;
            gm[v].link_count++;
        }
        u = !collapse[u] ? nm[e.source.name] : nm[u];
        v = !collapse[v] ? nm[e.target.name] : nm[v];
        var i = (u < v ? u + "|" + v : v + "|" + u),
            l = lm[i] || (lm[i] = { source: u, target: v, size: 0 });
        l.size += 1;
    }
    for (i in lm) { links.push(lm[i]); }

    return { nodes: nodes, links: links };
}

function convexHulls(nodes, index, offset) {
    var hulls = {};

    // create point sets
    for (var k = 0; k < nodes.length; ++k) {
        var n = nodes[k];
        if (n.size) continue;
        var i = index(n),
            l = hulls[i] || (hulls[i] = []);
        l.push([n.x - offset, n.y - offset]);
        l.push([n.x - offset, n.y + offset]);
        l.push([n.x + offset, n.y - offset]);
        l.push([n.x + offset, n.y + offset]);
    }

    // create convex hulls
    var hullset = [];
    for (i in hulls) {
        hullset.push({ group: i, path: d3.geom.hull(hulls[i]) });
    }

    return hullset;
}

function drawCluster(d) {
    return curve(d.path); // 0.8
}

// --------------------------------------------------------

var body = d3.select(".network");

var vis = body.append("svg")
    .attr("width", width)
    .attr("height", height);

string_data = document.getElementById("chart").getAttribute('visdata');
data = JSON.parse(string_data);
console.log(data);
// for (var i = 0; i < data.links.length; ++i) {
//     o = data.links[i];
//     o.source = data.nodes[o.source];
//     o.target = data.nodes[o.target];
// }
edges = [];

data.links.forEach(function (link) {
    // Get the source and target nodes
    var sourceNode = data.nodes.filter(function (n) { return n.id === link.source; })[0],
        targetNode = data.nodes.filter(function (n) { return n.id === link.target; })[0];

    // Add the edge to the array
    var edge = { source: sourceNode, target: targetNode };
    edge.value = +link.value;
    edges.push(edge);

});
data.links = edges;

// Find blank links, which give the error
// "Uncaught TypeError: Cannot read property 'weight' of undefined"
// data.links.forEach(function (link, index, list) {
//     if (typeof data.nodes[link.source] === 'undefined') {
//         console.log('undefined source', link);
//     }
//     if (typeof data.nodes[link.target] === 'undefined') {
//         console.log('undefined target', link);
//     }
// });

hullg = vis.append("g");
linkg = vis.append("g");
nodeg = vis.append("g");

init();

vis.attr("opacity", 1e-6)
    .transition()
    .duration(1000)
    .attr("opacity", 1);

function init() {
    if (force) force.stop();

    net = network(data, net, getGroup, collapse);

    force = d3.layout.force()
        .nodes(net.nodes)
        .links(net.links)
        .size([width, height])
        .linkDistance(function (l, i) {
            var n1 = l.source, n2 = l.target;
            // larger distance for bigger groups:
            // both between single nodes and _other_ groups (where size of own node group still counts),
            // and between two group nodes.
            //
            // reduce distance for groups with very few outer links,
            // again both in expanded and grouped form, i.e. between individual nodes of a group and
            // nodes of another group or other group node or between two group nodes.
            //
            // The latter was done to keep the single-link groups ('blue', rose, ...) close.
            return 30 +
                Math.min(20 * Math.min((n1.size || (n1.group != n2.group ? n1.group_data.size : 0)),
                    (n2.size || (n1.group != n2.group ? n2.group_data.size : 0))),
                    -30 +
                    30 * Math.min((n1.link_count || (n1.group != n2.group ? n1.group_data.link_count : 0)),
                        (n2.link_count || (n1.group != n2.group ? n2.group_data.link_count : 0))),
                    100);
            //return 150;
        })
        .linkStrength(function (l, i) {
            return 1;
        })
        .gravity(0.05)   // gravity+charge tweaked to ensure good 'grouped' view (e.g. green group not smack between blue&orange, ...
        .charge(-600)    // ... charge is important to turn single-linked groups to the outside
        .friction(0.5)   // friction adjusted to get dampened display: less bouncy bouncy ball [Swedish Chef, anyone?]
        .start();

    hullg.selectAll("path.hull").remove();
    hull = hullg.selectAll("path.hull")
        .data(convexHulls(net.nodes, getGroup, off))
        .enter().append("path")
        .attr("class", "hull")
        .attr("d", drawCluster)
        .style("fill", function (d) { return fillg(d.group); })
        .on("click", function (d) {
            console.log("hull click", d, arguments, this, collapse[d.group]);
            collapse[d.group] = true; init();
        });

    link = linkg.selectAll("line.link").data(net.links, linkid);
    link.exit().remove();
    link.enter().append("line")
        .attr("class", "link")
        .attr("x1", function (d) { return d.source.x; })
        .attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; })
        .attr("y2", function (d) { return d.target.y; })
        .style("stroke-width", function (d) { return d.size || 1; });

    node = nodeg.selectAll("circle.node").data(net.nodes, nodeid);
    node.exit().remove();
    node.enter().append("circle")
        // if (d.size) -- d.size > 0 when d is a group node.
        .attr("class", function (d) { return "node" + (d.size ? "" : " leaf"); })
        .attr("r", function (d) { return d.size ? d.size + dr : dr + 1; })
        .attr("cx", function (d) { return d.x; })
        .attr("cy", function (d) { return d.y; })
        .style("fill", function (d) { return fill(d.group); })
        .on("click", function (d) {
            console.log("node click", d, arguments, this, collapse[d.group]);
            collapse[d.group] = !collapse[d.group];
            init();
        });

    node.call(force.drag);

    force.on("tick", function () {
        if (!hull.empty()) {
            hull.data(convexHulls(net.nodes, getGroup, off))
                .attr("d", drawCluster);
        }

        link.attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });

        node.attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; });
    });
}
