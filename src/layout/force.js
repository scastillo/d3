// A rudimentary force layout using Gauss-Seidel.
d3.layout.force = function() {
  var force = {},
      event = d3.dispatch("tick"),
      size = [1, 1],
      alpha,
      drag = .9,
      distance = 20,
      charge = -30,
      gravity = .1,
      theta = .8,
      interval,
      nodes,
      links,
      distances;

  function accumulate(quad) {
    var cx = 0,
        cy = 0;
    quad.count = 0;
    if (!quad.leaf) {
      quad.nodes.forEach(function(c) {
        accumulate(c);
        quad.count += c.count;
        cx += c.count * c.cx;
        cy += c.count * c.cy;
      });
    }
    if (quad.point) {
      quad.count++;
      cx += quad.point.x;
      cy += quad.point.y;
    }
    quad.cx = cx / quad.count;
    quad.cy = cy / quad.count;
  }

  function repulse(node, kc) {
    return function(quad, x1, y1, x2, y2) {
      if (quad.point != node) {
        var dx = (quad.cx - node.x) || Math.random(),
            dy = (quad.cy - node.y) || Math.random(),
            dn = 1 / Math.sqrt(dx * dx + dy * dy);

        /* Barnes-Hut criterion. */
        if ((x2 - x1) * dn < theta) {
          var k = kc * quad.count * dn * dn;
          node.fx += dx * k;
          node.fy += dy * k;
          return true;
        }

        if (quad.point) {
          var k = kc * dn * dn;
          node.fx += dx * k;
          node.fy += dy * k;
        }
      }
    };
  }

  function tick() {
    var n = nodes.length,
        m = links.length,
        q = d3.geom.quadtree(nodes),
        i, // current index
        o, // current object
        s, // current source
        t, // current target
        l, // current distance
        x, // x-distance
        y; // y-distance

    // reset forces
    i = -1; while (++i < n) {
      (o = nodes[i]).fx = o.fy = 0;
    }

    // gauss-seidel relaxation for links
    for (i = 0; i < m; ++i) {
      o = links[i];
      s = o.source;
      t = o.target;
      x = t.x - s.x;
      y = t.y - s.y;
      if (l = Math.sqrt(x * x + y * y)) {
        l = alpha * (l - distance) / l;
        x *= l;
        y *= l;
        t.x -= x;
        t.y -= y;
        s.x += x;
        s.y += y;
      }
    }

    // compute quadtree center of mass
    accumulate(q);

    // apply gravity forces
    var kg = alpha * gravity;
    x = size[0] / 2;
    y = size[1] / 2;
    i = -1; while (++i < n) {
      o = nodes[i];
      s = x - o.x;
      t = y - o.y;
      l = kg * Math.pow(s * s + t * t, .01);
      s *= l;
      t *= l;
      o.fx += s;
      o.fy += t;
    }

    // apply charge forces
    var kc = alpha * charge;
    i = -1; while (++i < n) {
      q.visit(repulse(nodes[i], kc));
    }

    // position verlet integration
    i = -1; while (++i < n) {
      o = nodes[i];
      if (o.fixed) {
        o.x = o.px;
        o.y = o.py;
      } else {
        x = o.px - (o.px = o.x);
        y = o.py - (o.py = o.y);
        o.x += o.fx - x * drag;
        o.y += o.fy - y * drag;
      }
    }

    event.tick.dispatch({type: "tick"});

    // simulated annealing, basically
    return (alpha *= .99) < .005;
  }

  force.on = function(type, listener) {
    event[type].add(listener);
    return force;
  };

  force.nodes = function(x) {
    if (!arguments.length) return nodes;
    nodes = x;
    return force;
  };

  force.links = function(x) {
    if (!arguments.length) return links;
    links = x;
    return force;
  };

  force.size = function(x) {
    if (!arguments.length) return size;
    size = x;
    return force;
  };

  force.distance = function(x) {
    if (!arguments.length) return distance;
    distance = x;
    return force;
  };

  force.drag = function(x) {
    if (!arguments.length) return drag;
    drag = x;
    return force;
  };

  force.charge = function(x) {
    if (!arguments.length) return charge;
    charge = x;
    return force;
  };

  force.gravity = function(x) {
    if (!arguments.length) return gravity;
    gravity = x;
    return force;
  };

  force.theta = function(x) {
    if (!arguments.length) return theta;
    theta = x;
    return force;
  };

  force.start = function() {
    var i,
        j,
        n = nodes.length,
        m = links.length,
        w = size[0],
        h = size[1],
        neighbors,
        o;

    for (i = 0; i < n; ++i) {
      (o = nodes[i]).index = i;
    }

    for (i = 0; i < m; ++i) {
      o = links[i];
      if (typeof o.source == "number") o.source = nodes[o.source];
      if (typeof o.target == "number") o.target = nodes[o.target];
    }

    for (i = 0; i < n; ++i) {
      o = nodes[i];
      if (isNaN(o.x)) o.x = position("x", w);
      if (isNaN(o.y)) o.y = position("y", h);
      if (isNaN(o.px)) o.px = o.x;
      if (isNaN(o.py)) o.py = o.y;
    }

    // initialize node position based on first neighbor
    function position(dimension, size) {
      var neighbors = neighbor(i),
          j = -1,
          m = neighbors.length,
          x;
      while (++j < m) if (!isNaN(x = neighbors[j][dimension])) return x;
      return Math.random() * size;
    }

    // initialize neighbors lazily
    function neighbor() {
      if (!neighbors) {
        neighbors = [];
        for (j = 0; j < n; ++j) {
          neighbors[j] = [];
        }
        for (j = 0; j < m; ++j) {
          var o = links[j];
          neighbors[o.source.index].push(o.target);
          neighbors[o.target.index].push(o.source);
        }
      }
      return neighbors[i];
    }

    return force.resume();
  };

  force.resume = function() {
    alpha = .1;
    d3.timer(tick);
    return force;
  };

  force.stop = function() {
    alpha = 0;
    return force;
  };

  // use `node.call(force.drag)` to make nodes draggable
  force.drag = function() {

    this
      .on("mouseover.force", d3_layout_forceDragOver)
      .on("mouseout.force", d3_layout_forceDragOut)
      .on("mousedown.force", d3_layout_forceDragDown);

    d3.select(window)
      .on("mousemove.force", dragmove)
      .on("mouseup.force", dragup, true);

    return force;
  };

  function dragmove() {
    if (!d3_layout_forceDragNode) return;

    // O NOES! The drag element was removed from the DOM.
    if (!d3_layout_forceDragElement.parentNode) {
      d3_layout_forceDragNode.fixed = false;
      d3_layout_forceDragNode = d3_layout_forceDragElement = null;
      return;
    }

    var m = d3.svg.mouse(d3_layout_forceDragElement);
    d3_layout_forceDragMoved = true;
    d3_layout_forceDragNode.px = m[0];
    d3_layout_forceDragNode.py = m[1];
    force.resume(); // restart annealing
  }

  function dragup() {
    if (!d3_layout_forceDragNode) return;

    // If the node was moved, prevent the mouseup from propagating.
    if (d3_layout_forceDragMoved) {
      d3.event.stopPropagation();
      d3.event.preventDefault();
    }

    dragmove();
    d3_layout_forceDragNode.fixed = false;
    d3_layout_forceDragNode = d3_layout_forceDragElement = null;
  }

  return force;
};

var d3_layout_forceDragNode,
    d3_layout_forceDragMoved,
    d3_layout_forceDragElement;

function d3_layout_forceDragOver(d) {
  d.fixed = true;
}

function d3_layout_forceDragOut(d) {
  if (d !== d3_layout_forceDragNode) {
    d.fixed = false;
  }
}

function d3_layout_forceDragDown(d, i) {
  (d3_layout_forceDragNode = d).fixed = true;
  d3_layout_forceDragMoved = false;
  d3_layout_forceDragElement = this;
  d3.event.stopPropagation();
  d3.event.preventDefault();
}
