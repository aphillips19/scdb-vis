/*
    SCOTUS Data Project
    Line Chart Visualization
    Andrew Phillips & Jake Rourke
*/

var NS = {}; // create namespace; grab links to data
  NS.datapath = "../../data/SCDB_M_justiceCentered.csv"
  NS.datapathCJ = "../../data/chiefjustices.csv"


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                       Initialization/Main functions
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
// Load the data, call main()
function initialize() {
  NS.svg = d3.select("svg"); // select the SVG (will be often used later on)
  
  // add text to the SVG to reflect loading data
  NS.svg.append("text").text("Loading data...")
    .attr("x", 400)
    .attr("y", 200);
  console.log("Loading data...")

  // Load SCDB data, store in NS.dataset
  d3.csv(NS.datapath, function(data) {
    NS.dataset = data;
    
    // Load chief justice timeline data, store in NS.chiefJustices
    d3.csv(NS.datapathCJ, function(data2) {
      NS.chiefJustices = data2;

      // Call main
      main();
    });
  });
}

// Call all the functions that set things up, in order.
function main() {
  aggregateData();
  createGraph();
  setupSwingVotes();
  justiceMenu();
  eventListeners();
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                Data transformation/aggregation functions
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

// transform the justice-centered dataset into one nested by justice, then by
// year. At each data point, store the mean decision direction, the total
// number of votes in that year, whether or not a justice was the swing vote
// in that year, and the number of important swing votes in that year.
function aggregateData() {
  console.log("Performing data aggregation...")
  NS.maxSwingVotes = 0; // keep track of this; will be incremented in the
                        // rollup function thru countSwingVotes()
  NS.dataNested = d3.nest()
    // nest by justice
    .key(function(d) {return d.justiceName})
    // nest by term
    .key(function(d) {return d.term; } )

    // roll up mean votes, n, and swing vote status
    .rollup(function(v) {
      return {
        mean: d3.mean(v, function(d) {
                      // ignore cases with no direction
                      if(d.direction >= 1) {
                        return d.direction - 1; // change range from 1-2 to 0-1
                      }
              }),
        n: v.length,
        swing: v[0].median,

        // number of cases in that year that were 5-4 where he/she was in
        // the majority - in other words, when the swing vote mattered.
        swingCount: countSwingVotes(v)
      };
    })
    .entries(NS.dataset);

  // Make the list of which justices will be shown; by default, show none.
  NS.justiceList = {};
  NS.dataNested.forEach(function(justice) {
    NS.justiceList[justice.key] = false;

  // remove the "loading data" SVG text
  NS.svg.select("text").remove();
  })
}
// This function counts the number of swing votes that are important: meaning,
// instances where a justice is the median justice, the split of the vote was
// 5-4, and they were in the majority (in other words, they were (probably) the
// deciding vote)
function countSwingVotes(v) {
  var sum = 0; // keep of the sum as we go
  // iterate through each line of data
  for(var i = 0; i < v.length; i++) {
    if( v[i].median == 1
        && v[i].majVotes == 5
        && v[i].majority == 2      )
      // increment the sum when there is a swing vote
      sum++;
  }
  // keep track of the highest swing vote; will be used in the domain for
  // swing vote circle radius.
  if(sum > NS.maxSwingVotes) NS.maxSwingVotes = sum;

  return sum;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                  Domain-setting and Helper Functions
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function setupDomains() {
  // Set domains. x & y are for the context graph, x2 & y2 are for the focus
  // graph, and z is for both graphs (and the justice selector)
  NS.x.domain(d3.extent(NS.dataset, function(d) {
    return +(d.term);
  }));
  
  NS.y.domain([0, 1])

  NS.x2.domain(NS.x.domain())
  NS.y2.domain(NS.y.domain())

  NS.z.domain(NS.dataNested.map(function(c) { return c.key; }));
}


// This function is used when setting the colors, returning a light grey
// (actually black with a very low opacity) instead of the proper color from
// the color scale, when the justice is not chosen
function fade (j) {
    if(NS.justiceList[j]) {
      // return color
      return NS.z(j)
    } else {
      // return faded grey
      return "rgba(0, 0, 0, .025)";
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
   Functions to set up the line graph (context and focus), lines & points
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* Define the following global variables (NS. ...)
    width, height, x, y, z, xAxis, line, focus */
function setupFocus() {
  // Set the width and height of the focus view
  NS.width = +NS.svg.attr("width") - NS.margin.left - NS.margin.right;
  NS.height = +NS.svg.attr("height") - NS.margin.top - NS.margin.bottom;

  // define scales for the focus view
  NS.x = d3.scaleLinear().range([0, NS.width])
  NS.y = d3.scaleLinear().range([NS.height, 0])
  NS.z = d3.scaleOrdinal(d3.schemeCategory20)

  // create x axis
  NS.xAxis = d3.axisBottom(NS.x)
             .tickFormat(d3.format(".0f"));


  // create the line; each justice will have one
  NS.line = d3.line()
    .x(function(d) {
      return NS.x(d.key);
    })
    .y(function(d) {
      return NS.y(d.value.mean)
    });

  // Store the focused area (the line graph) in a global variable
  NS.focus = NS.svg.append("g")
    .attr("class", "focus")
    .attr("transform", "translate(" + NS.margin.left + "," + NS.margin.top + ")");

}

/* Define the following global variables (NS. ...)
    height2, x2, y2, xAxis2, brush, context */
function setupContext() {
  // Set the height of the context view
  NS.height2 = +NS.svg.attr("height") - NS.margin2.top - NS.margin2.bottom;

  // define scales for the context view
  NS.x2 = d3.scaleLinear().range([0, NS.width])
  NS.y2 = d3.scaleLinear().range([NS.height2, 0])

  // create x axis
  NS.xAxis2 = d3.axisBottom(NS.x2)
             .tickFormat(d3.format(".0f"));

  // Add the brush
  NS.brush = d3.brushX()
    .extent([[0,0], [NS.width, NS.height2]])
    .on("brush end", brushed)
  

  // Store the context (the timeline) in a global variable
  NS.context = NS.svg.append("g")
    .attr("class", "context")
    .attr("transform", "translate(" + NS.margin2.left + "," + NS.margin2.top + ")");
}

function appendElementsToFocus() {
  /* Add stuff to focused graph */
  NS.focus.append("g")
    // make the x axis
    .attr("class", "axis axis--x")
    .attr("transform", "translate(0," + NS.height + ")")
    .call(NS.xAxis);

  NS.focus.append("g")
    // make the y axis
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(NS.y))
    // label the y axis
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("fill", "#000")
      .text("Liberal");

  
  // Create an element for each justice (the array of all of them is stored in NS.justice)
  NS.justice = NS.focus.selectAll(".justice")
    .data(NS.dataNested)
    .enter().append("g")
      .attr("class", "justice")
      .attr("id", function(d) { return d.key; });

  // Add lines for each justice
  NS.justice.append("path")
    .attr("class", "justice--line")
    .attr("d", function(d) { return NS.line(d.values); })
    .style("stroke", function(d) {
      return fade(d.key);
    })
    .style("stroke-width", 2)
    .attr("clip-path", "url(#clip)");

  // Add labels for each justice
  NS.justice.append("text")
      // get the last piece of data in the timeline
      .datum(function(d) { return {justice: d.key, value: d.values[d.values.length - 1]}; })
      .attr("transform", function(d) { 
        return "translate(" + NS.x(d.value.key) + "," + NS.y(d.value.value.mean) + ")";
      })
      .attr("class", "justice--label-text")
      .attr("x", 3)
      .attr("dy", "0.35em")
      .style("font", "10px sans-serif")
      .style("fill", function(d) {
        return fade(d.justice);
      })
      .text(function(d) { return d.justice; });

}

function appendElementsToContext() {

  /* Add stuff to context */
  NS.context.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", "translate(0," + NS.height2 + ")")
    .call(NS.xAxis2);

  // Select the elements which will make up the brush-and-zoomable timeline
  NS.timeline = NS.context.selectAll(".timeline-entry")
    .data(NS.chiefJustices)
    .enter().append("g")
    .attr("class", "timeline-entry")

  // add rects to the timeline
  NS.timeline.append("rect")
    .attr("class", "timeline-entry-rect")
    //set x to the start of their tenure
    .attr("x", function(d) {
      return NS.x2(+d.start);
    })
    // set the width to the length of their tenure
    .attr("width", function(d) {
      return NS.x2(+d.end) - NS.x2(+d.start);
    })
    // set the color consistant with the line graph
    .attr("fill", function(d) {
      return NS.z(d.alt);
    })
    .attr("y", 0)
    .attr("height", NS.height2);
  
  // add labels to the timeline
  NS.timeline.append("text")
    .attr("class", "timeline-entry-label")
    .style("fill", "#FFF")
    .style("font", "10px sans-serif")
    .attr("text-anchor", "middle")
    .attr("x", function(d) {
      // center text in the timeline
      return NS.x2(+d.start) + (NS.x2(+d.end) - NS.x2(+d.start)) / 2;
    })
    .attr("y", NS.height2/2 + 5)
    .text(function(d) {return d.chief; })

  // add a label to the axis
    NS.context.append("text")
    .attr("class", "timeline-axis-label")
    .style("fill", "#000")
    .style("font", "10px sans-serif")
    .attr("text-anchor", "middle")
    .attr("x", NS.width/2)
    .attr("y", NS.height2 + NS.margin2.bottom)
    .text("Chief Justices (year)")

  // add the brush to the SVG
  NS.context.append("g")
    .attr("class", "brush")
    .call(NS.brush)
    .call(NS.brush.move, NS.x.range())
  // round the edges of the brush in order to afford moving them around
  NS.context.select(".selection")
    .attr("rx", 7)
    .attr("ry", 7)
}

// Create the entire graph; both the setup and context views
function createGraph() {
  console.log("Creating the graph...")


  // Set the margins for the focus and context views
  NS.margin = {top: 20,   right: 80, bottom: 110, left: 40},
  NS.margin2 = {top: 440, right: 80, bottom: 25,  left: 40};

  setupFocus();

  setupContext();

  setupDomains(); 

  appendElementsToFocus();

  appendElementsToContext();

  // Create a box to clip paths so that visual elements don't go out of bounds
  NS.svg.append("defs").append("clipPath")
      .attr("id", "clip")
    .append("rect")
      .attr("width", NS.width)
      .attr("height", NS.height);

}

// Mark years where a justice was the swing vote with dots on graph
function setupSwingVotes() {
  // scale for the radius
  NS.r = d3.scaleLinear().domain([0, NS.maxSwingVotes]).range([2, 7])
  
  // add a group to contain the swing votes for each justice
  NS.justice.append("g")
    .attr("class", "justice--swing")
    .attr("id", function(d) {
      return this.parentNode.key;
    })

  // add the circles
  NS.justice.select(".justice--swing")
    .selectAll(".justice--swing-circle")
    // grab the data for each justice
    .data(function(d, i) {
      return NS.dataNested[i].values;
    })
    .enter()
    // Filter data to remove cases where the justice was not the swing vote
    .filter(function(d) { return d.value.swing == 1; })
    // add the circles
    .append("circle")
    .attr("class", "justice--swing-circle")
    .attr("clip-path", "url(#clip)") // so they don't go out of bounds
    // radius size is based on the number of swing votes
    .attr("r", function(d) {return NS.r(d.value.swingCount); })
    .attr("fill", "white")
    .attr("stroke-width", "2")
    // use the same color as th eline
    .attr("stroke", function(d) {
      var id = this.parentNode.parentNode.id;
      return fade(id);
    })
    // align properly with the point on the line graph
    .attr("cx", function(d, i) {
      return NS.x(d.key)
    })
    .attr("cy", function(d) {
      return NS.y(d.value.mean)
    })
    // Hide by default
    .attr("visibility", "hidden")

    // add data to each point so it can be retrieved by other functions
    // (makes it easier to manage than somehow getting the data for the
    // whole group of circles, then determining which goes with which
    // year)
    .datum(function(d) {return d; });

    NS.showSwingVotes = false;
}

// toggle the visiblility of swing votes
function toggleSwingVotes() {

  updateSwingVoteColor();

  // show if hidden; hide if shown.
  if(NS.showSwingVotes) { 
    NS.showSwingVotes = false;
    var circles = NS.justice.selectAll(".justice--swing-circle")
      .attr("visibility", "hidden")
  } else {
    NS.showSwingVotes = true;
    // only actually show if the justices have been chosen
    for(justice in NS.justiceList) {
      if(NS.justiceList[justice]) {
        setJusticeSwingVotes(justice, "visible");
      }
    }
  }
}

// helper function to toggle one justice's swing vote
function setJusticeSwingVotes(name, value) {
  var circles = NS.focus.select("#" + name)
    .selectAll(".justice--swing-circle").attr("visibility", value);
}

// Set up the tooltip with event listeners
function eventListeners() {
  console.log("Listening...");
  d3.selectAll(".justice--swing-circle")
    .on("mouseover", function () {
      pointMouseOver(this);
    })
    .on("mouseout", function() {
      pointMouseOut(this);
    })
}

// hide the div tooltip
function hideTooltip() {
  d3.select(".tooltip")
    .style("display", "none")
}

// show the div tooltip
function showTooltip() {
  d3.select(".tooltip")
    .style("display", "block")
}

// function to handle the mouse leaving the tooltip
function pointMouseOut(point) {
  // this does not necessarily need to be its own function, but it makes the
  // eventListeners code just a little more standardized, because of
  // pointMouseOver().
  hideTooltip();
}

// function to handle mouse hovering over the tooltip
function pointMouseOver(point) {
  showTooltip();
  updateTooltips(point)
}


// Change the position and text of the tooltip to reflect that of the point
// which is currently being hovered over
function updateTooltips(point) {
  // select the point
  var pointSel = d3.select(point);

  // change the position of the tooltip to be just above the point; the
  // "magic numbers" ensure it is more or less centered and above the point.
  var x = d3.event.pageX - 80;
  var y = d3.event.pageY - 60;
  
  d3.select(".tooltip")
    .style("display", "block")
    .style("left", x + "px")   
    .style("top", y + "px")


  // grab information about the point (which justice it corresponds to)
  // and change information inside the tooltip
  var d = pointSel.datum();
  // format the percentage data nicely; add it to d, for consistancy's sake
  d.percent = d3.format(".0%")(d.value.swingCount / d.value.n);
  
  // set the content that will be added to the div
  var content = (d.value.swingCount + " (" + d.percent +
      ") of " + d.value.n + " votes were in 5-4 decisions.");
  // add the content to the div
  document.getElementById("tooltip-text")
    .innerHTML = content;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
  Brush & Zoom functions, and functions to update the line graph accordingly
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

// Function to deal with brushing
function brushed() {
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
  var s = d3.event.selection || NS.x2.range();
  NS.x.domain(s.map(NS.x2.invert, NS.x2));
  updateJusticePosition();
}

// Change the position of each justice (lines, labels, points); called when the
// brush/zoom is moved
function updateJusticePosition() {
  // update axis
  NS.focus.select(".axis--x").call(NS.xAxis);

  // update paths
  NS.justice.select(".justice--line").attr("d", function(d) {
    return NS.line(d.values);
  })

  // update labels
  updateLabelPosition();

  // update swing votes
  updateSwingVotePosition();
}
function updateLabelPosition() {
  NS.justice.select(".justice--label-text")
    // Add data to determine whether or not to hide the justice from the graph,
    // or keep it visible even when the initial position would be off the graph
    .datum(function(d) {
      // grab the maximum and minimum year currently on the domain
      var end = Math.floor(NS.x.domain()[1])
      var start = Math.ceil(NS.x.domain()[0])
      return {
        // name of the justice
        justice: d.key,
        // the end values for the justice
        value: d.values[d.values.length - 1],
        // true if the line is visible on the graph
        ongraph: d.values.some(function(v) {
          return (v.key <= end && v.key >= start);
        })
      };
    })
    // Ensure justice is visible unless the line is no longer on the graph
    .attr("transform", function(d) { 
      var x = NS.x(d.value.key);
      if(d.ongraph) {
        if(x > NS.width) {
          x = NS.width;
        }
      } else {
        x = -200;
      }
      return "translate(" + x + "," + NS.y(d.value.value.mean) + ")";
    });
}

function updateSwingVotePosition() {
  NS.justice.selectAll("circle")
    .attr("cx", function(d, i) {
      return NS.x(d.key)
    })
    .attr("cy", function(d) {
      return NS.y(d.value.mean)
    });
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                           Justice Menu functions
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
// create the menu to choose justices, using an SVG
function justiceMenu() {
  // Set general information about the menu
  NS.menuSettings = {
    height: 680, // height
    width: function() { //width
      var w = div.style("width");// get the width of the div from the CSS styling
      return +w.substring(0, w.length - 2) // remove the "px"
    },
    padding: {top: 4, bottom: 4, left: 5}, // padding
    fontSize: 10, // font size
    squareSize: 10, // legend square size
    xSpacing: 14, // space between left margin text (square between them)
  };
  // set the space between each justice
  NS.menuSettings.yOffset = NS.menuSettings.padding.top + NS.menuSettings.padding.bottom
    + NS.menuSettings.fontSize;
  // there may be other ways to position the label, square, and spaces between
  // them and the margin, but I found this to be the easiest given how certain
  // variables are re-used.

  // select the div for the justice menu
  var div = d3.select("#justice-menu");
  
  // add an SVG
  var justiceMenu = div.append("svg")
    .attr("height", NS.menuSettings.height)
    .attr("width", NS.menuSettings.width);

  // create a justice menu option (JMO) for each justice
  var jmo = justiceMenu.selectAll(".justice-menu-option")
    .data(NS.dataNested)
    .enter().append("g")
    // set the class and ID to easily find it later
    .attr("class", "justice-menu-option")
    .attr("id", function(d) {return "jmo-" + d.key}); //i.e. #jmo-BRWhite

  // background for each entry
  jmo.append("rect")
    .attr("class", "jmo-background")
    .attr("width", NS.menuSettings.width)
    .attr("height", NS.menuSettings.yOffset)
    .attr("y", function(d, i) { return (i) * NS.menuSettings.yOffset})
    // white by default
    .attr("fill", "white");

  jmo.append("rect") // legend square
    .attr("class", "jmo-square")
    .attr("width", NS.menuSettings.squareSize)
    .attr("height", NS.menuSettings.squareSize)
    // light grey (very transparent white) by default
    .attr("fill", "rgba(0, 0, 0, .025")
    .attr("stroke", "black")
    .attr("stroke-width", "1px")
    .attr("y", function(d, i) { return i * NS.menuSettings.yOffset + NS.menuSettings.padding.top})
    .attr("x", NS.menuSettings.padding.left);


  // add the text to each label: the justice's name, plus the years of their service
  jmo.append("text")
    .attr("class", "jmo-text")
    .text(function(d) {
      var start = d.values[0].key;
      var end = d.values[d.values.length - 1].key;
      return d.key + " [" + start + " - " + end + "]";
    })
    .attr("x", NS.menuSettings.padding.left + NS.menuSettings.xSpacing)
    .style("font", "10px sans-serif")
    .attr("y", function(d, i) { return i * NS.menuSettings.yOffset + NS.menuSettings.fontSize + NS.menuSettings.padding.top - 1})


  // update colors at default values
  updateJusticeColor();

  // listen for changes
  jmo.on("click", function(d) {
    var j = d3.select(this);
    updateMenu(j, d.key, "toggle");
  });

}

// this function is used to update a justice's visibility, updating both their
// presence in that list, and also their selected/unselected status in the menu
// it will handle either toggles, selections, or deselections.
function updateMenu(j, name, type) {
  // store the properties for selected and unselected justices in unsel and sel
  var unsel = {
    selected: false,
    bg: "white",
    // ".color" is a function in order to keep it consistent with the sel object
    color: function(d) {return "rgba(0, 0, 0, 0.025)"; }
  };
  var sel = {
    selected: true,
    bg: "lightgrey",
    color: function(d) {
      return NS.z(d.key);
    }
  };

  // holder for either sel or unsel, depending on how this function is called
  var x = {};
  // if toggled, it will be sel if the justice is unselected or unsel if the
  // justice is selected. Otherwise, it is straightforward, sel if selected and
  // unsel if deselected
  if(type == "toggle") {
    if(NS.justiceList[name]) {
      x = unsel;
    } else {
      x = sel;
    }
  } else if(type == "select") {
    x = sel;
  } else {
    x = unsel;
  }

  // Make the necessary changes using the properties set above
  NS.justiceList[name] = x.selected;
  j.select(".jmo-background").attr("fill", x.bg);
  j.select(".jmo-square").attr("fill", function(d) {return x.color(d)});

  // move the justice object to the front of the SVG
  NS.focus.select("#" + name).moveToFront();

  // update colors of justices
  updateJusticeColor();

  // ensure swing votes are visible if necessary
  if(NS.showSwingVotes && x.selected) {
    updateSwingVoteColor()
    setJusticeSwingVotes(name, "visible");
  } else {  
    setJusticeSwingVotes(name, "hidden");
  }
}


// change the color of justice lines and labels; calls fade to ensure that it
// greyed out when deselected and properly colored when selected.
function updateJusticeColor() {
  NS.justice.select(".justice--line")
    .style("stroke", function(d) {
      return fade(d.key);
  });
  NS.justice.select(".justice--label-text")
    .style("fill", function(d) {
      return fade(d.key);
  });
}
// update the swing vote color in the same way as justice lines and labels.
function updateSwingVoteColor() {
  var circles = NS.justice.selectAll("circle");
  circles.attr("fill", "white")
  .attr("stroke", function(d) {
      var id = this.parentNode.parentNode.id;
      return fade(id);
    })
}

// function for the "clear all justices" button. Removes all the justices
// from the list of selected justices and menu.
function clearAllJustices() {
  for (name in NS.justiceList) {
    if(NS.justiceList[name]) {
      var j = d3.select("#jmo-" + name);
      updateMenu(j, name, "deselect");
    }
  }
}

// function for the "clear all justices" button. Adds all the justices
// to the list of selected justices and menu.
function showAllJustices() {
  for (name in NS.justiceList) {
    var j = d3.select("#jmo-" + name);
    updateMenu(j, name, "select");
  }
}

// d3...moveToFront() taken from https://github.com/wbkd/d3-extended
// used to ensure SVG elements are drawn in the foreground
d3.selection.prototype.moveToFront = function() { 
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
                            Run the Code :)
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
initialize();

