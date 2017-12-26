/*
    SCOTUS Data Project
    Scatterplot Visualization
    Andrew Phillips & Jake Rourke
*/

// Code adapted in part from my Lab 4 scatterplot and
// https://bl.ocks.org/mbostock/3183403

var NS = {}; // create namespace

  NS.datapath = "../../data/SCDB_M_caseCentered.csv"

NS.width = 1000;     // of SVG
NS.height = 600;     // of SVG
NS.padding = 70;

NS.selectedIssue = {type: "combos", index: 0};
NS.scaleType = "absolute";

// this variable used to make setting up the menus, as well as iterating
// through issue areas, easier, by keeping all possibilities in one place.
NS.issueAreas = {
  real: [                    // number in dataset
    { name: "Criminal Procedure",  index: 0   },
    { name: "Civil Rights",        index: 1   },
    { name: "First Amendment",     index: 2   },
    { name: "Due Process",         index: 3   },
    { name: "Privacy",             index: 4   },
    { name: "Attorneys",           index: 5   },
    { name: "Unions",              index: 6   },
    { name: "Economic Activity",   index: 7   },
    { name: "Judicial power",      index: 8   },
    { name: "Federalism",          index: 9   },
    { name: "Interstate Relations",index: 10  },
    { name: "Federal Taxation",    index: 11  },
    { name: "Miscellaneous",       index: 12  },
    { name: "Private Action",      index: 13  },
    { name: "other",               index: 14  }
    ],
  combos: [
    { name: "All",               indices:  d3.range(0, 15) },
    { name: "Civil Liberties",     indices: d3.range(0, 6)  },
    { name: "Non Civil Liberties", indices: d3.range(7, 15) }
  ]
}
//////////////////////////////////////////////////////////////////////
// functions

// get the year from a mm/dd/yyyy date

function aggregateData() {

  // Nest the data by year, and keep track of the number of
  // conservative, liberal, and total decisions.
  NS.dataByYear = d3.nest()
    .key(function(d) { return +d.term; })
    .rollup(function(v) {
      // v is an array of all cases in a given year
      
      var aggregates = {
        real: [],
        combos: []  
      };
      
      // set up aggregate information storage for both "real" issue areas and
      // "aggregates"
      for(var type in aggregates) {
        for(var issueArea = 0; issueArea < NS.issueAreas[type].length; issueArea++) {
          aggregates[type][issueArea] = {
            c: 0,   // conservative
            l: 0,   // liberal
            u: 0,   // unspecifiable
            n: 0
          }
        }
      }
      
      // fill in all the "real" issue area information for the current justice
      for(var i = 0; i < v.length; i++) {
        d = v[i]; // shorthand for the current data in the style of d3 functions
        var direction = ""; // will store c, l, or u, in order to determine which
                            // counters to increment
        // set issue area to the issue area in the dataset if the issue area is
        // valid; otherwise, set it to "14," which is the "other" category
        var issueArea = (d.issueArea != "" && d.issueArea != "NA") ? +d.issueArea : 14;
        
        // set the proper decision direction in the current case
        if(+d.decisionDirection == 1)       direction = "c";
        else if(+d.decisionDirection == 2)  direction = "l";
        else                                direction = "u";

        // increment "real" issue area. No need to search for index, because
        // the index in the array represents the proper index
        aggregates["real"][issueArea - 1][direction]++;
        aggregates["real"][issueArea - 1].n++;

        // increment "combo" issue areas. Searching necessary to decide which
        // are applicable
        for(c in NS.issueAreas.combos) {
          if(NS.issueAreas.combos[c].indices.includes(issueArea)) {
            aggregates["combos"][c][direction]++;
            aggregates["combos"][c].n++;
          }
        }
      }

      // return all this information at the end of the rollup function; each
      // justice will have it.
      return aggregates;
    })
    .entries(NS.dataset);
  
  // transform the data into a format that is easy to use in the scatterplot
  // for all issue areas (including the 14th element representing totals)
  NS.seriesNames = ["c", "l"]
  NS.series = NS.seriesNames.map(function(series) {
    return NS.dataByYear.map(function(d) {
      var res = {
        real: [],
        combos: []
      };

      for(var c in NS.issueAreas) {
        for(var i = 0; i < NS.issueAreas[c].length; i++) {
          var x = d.value[c];
          res[c][i] = {
            year: +d.key,
            val: x[i][series],
            percent: (x[i].n > 0) ? x[i][series]/x[i].n : 0 // don't divide by
                                                            // zero
          };
        }
      }
      return res;
    });
  });
}

function main () {
  console.log("main function");

  // aggregate data
  aggregateData();

  // make the SVG
  makeSVG(); // stores in NS.svg

  // make the menu
  makeMenu();

  // Define scales
  
  NS.xScale = d3.scaleLinear()
              .domain([1946, d3.max(NS.dataByYear, function (d) {
                return +d.key;
              }) ])
              .range([NS.padding, NS.width - NS.padding * 2]);

  NS.yScale = d3.scaleLinear()
              // max is the maximum decisions in either lib/cons/unsp in all
              // the years
              .domain([0, d3.max(NS.dataByYear, function(d) {
                return d.value[NS.selectedIssue.type][NS.selectedIssue.index].n;
              }) ])
             .range([NS.height - NS.padding, NS.padding]);

  NS.zScale = d3.scaleOrdinal(["red", "blue"]);

  //Define axes
  NS.xAxis = d3.axisBottom()
            .scale(NS.xScale)
            .tickFormat(d3.format("d"));

  NS.yAxis = d3.axisLeft()
            .scale(NS.yScale)
            .ticks(5)
            .tickFormat(d3.format("d"));

  // add HTML elements
  addHTML();

  // make scatterplot
  makeScatterplot();

  // make the legend
  makeLegend();
}


function initialize() {

  // add HTML elements
  //addHTML();

  // Load census data and call main
  d3.csv(NS.datapath, function(d) {
    NS.dataset = d;
    main();
  });
}


function addHTML() {
  //document.write("<p>redraw data!</p>");
}

function updateScatterplotToAbsolute() {
  NS.scaleType = "absolute";
  updateScatterplot();
}

function updateScatterplotToRelative() {
  NS.scaleType = "relative";
  updateScatterplot();
}

function updateScatterplot() {
  updateScalesAndAxes();
  updatePoints();
}

function updateScalesAndAxes(scale) {

  // change attributes based on the scale type
  if(NS.scaleType == "absolute") {
    var max = d3.max(NS.dataByYear, function(d) {return d.value[NS.selectedIssue.type][NS.selectedIssue.index].n; });
    var f = d3.format(".0f")
  } else { 
    var max = 1;
    var f = d3.format(".0%")
  }

  // update y scale's domain (either max n, or 100%)
  NS.yScale.domain([0, max]);

  // change y-axis tick format
  NS.yAxis.tickFormat(f);

  // re-draw y axis
  NS.svg.select(".axis--y")
    .call(NS.yAxis);

  // Adjust y axis label
  NS.svg.select(".ylabel")
    .text(function(d) {
      return (NS.scaleType == "absolute") ? "Number of Cases" : "Percent of Cases";
    });

}

function updatePoints() {
    if(NS.scaleType == "absolute")
      var val = "val";
    else
      var val = "percent";
    d3.selectAll("circle")
      .attr("class", "point")
      .transition().duration(500)
      .attr("r", 4.5)
      // hide if n = 0
      .attr("visibility", function(d) {
            })
      // set the x position
      .attr("cx", function(d) {
        var x = +d[NS.selectedIssue.type][NS.selectedIssue.index].year;
        return NS.xScale(x);
      })
      //set the y position
      .attr("cy", function(d) {
        var y = +d[NS.selectedIssue.type][NS.selectedIssue.index][val];
        return NS.yScale(y);
      });
}

function makeMenu() {
  console.log("making menu");

  // populate menu from the array of issue area possibilities
  // for both issue areas, and aggregates.
  for(var type in NS.issueAreas) {
    for(var i = 0; i < NS.issueAreas[type].length; i++) {
      var menu = (type == "real") ? d3.select("#realmenu") : d3.select("#combomenu");
      menu.append("option").attr("value", type + "," + i).text(NS.issueAreas[type][i].name);
    }
  }

  // set the initial menu value
  document.getElementById('issueSelect').value = NS.selectedIssue.type + "," + NS.selectedIssue.index;

  // update graph something is chosen
  d3.select("#issueSelect").on("change", function() {
    NS.selectedIssue.type = this.value.split(",")[0];
    NS.selectedIssue.index = this.value.split(",")[1];
    updateScatterplot(); // update scatterplot
  });
}

function makeScatterplot () {

  console.log("make scatterplot");


  // Add circles
  NS.svg.selectAll(".series")
      .data(NS.series)
    .enter().append("g")
      .attr("class", "series")
      .style("fill", function(d, i) { return NS.zScale(i); })
    .selectAll(".point")
      .data(function(d) { return d; })
    .enter().append("circle")
      .attr("class", "point")
      .attr("r", 4.5)
      .attr("stroke", "black")
      .attr("stroke-width", 1)
      .attr("cx", function(d) {
        var x = +d[NS.selectedIssue.type][NS.selectedIssue.index].year;
        return NS.xScale(x);
      })
      .attr("cy", function(d) {
        var y = +d[NS.selectedIssue.type][NS.selectedIssue.index].val;
        if(isNaN(NS.yScale(y))) return 0; // deal with NaN (occurs when n is 0)
        else return NS.yScale(y);
      });

  //Create X axis
  NS.svg.append("g")
    .attr("class", "axis--x")
    .attr("transform", "translate(0," + (NS.height - NS.padding) + ")")
    .call(NS.xAxis);
  
  //Create Y axis
  NS.svg.append("g")
    .attr("class", "axis--y")
    .attr("transform", "translate(" + NS.padding + ",0)")
    .call(NS.yAxis);

     // add axis labels
  NS.svg.append("text") // x label
    .attr("class", "xlabel")
    // center horizontally on the x axis
    .attr("text-anchor", "middle")
    .attr("transform", "translate(" + (NS.width - NS.padding) / 2 + "," +
           (NS.height - NS.padding/3 + ")"))
    // use xAttribute as the label
    .text("Year");
  NS.svg.append("text") // y label
    .attr("class", "ylabel")
    .attr("text-anchor", "middle")
    // center vertically on the y axis
    .attr("transform", "translate(" + NS.padding / 3 + ", " +
            (NS.height) / 2 + ") " + "rotate(-90)")
    // use yAttribute as the label
    .text(function(d) {
      return (NS.scaleType == "absolute") ? "Number of Cases" : "Percent of Cases";
    });
}

// create the SVG context and return it
function makeSVG () {
  
  //Create SVG element
  NS.svg = d3.select(".scatterplot")
        .append("svg")
        .attr("width", NS.width)
        .attr("height", NS.height);
}

function makeLegend() {
  NS.svg.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(20,20)");

  NS.legend = d3.legendColor()
    .labels(["Conservative", "Liberal"])
    .scale(NS.zScale);

  NS.svg.select(".legend")
    .call(NS.legend);

}

//////////////////////////////////////////////////////////////////////

initialize()
