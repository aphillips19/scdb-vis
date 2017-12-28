/*
    SCOTUS Data Project
    "At-A-Glance" pie chart on home page
    Andrew Phillips & Jake Rourke
*/

//Some code adapted from https://bl.ocks.org/mbostock/1346410 - Pie Chart Update II

var NS = {}; // create namespace

NS.datapath = "./data/SCDB_M_caseCentered.csv"
NS.nFormat = d3.format(",d");

NS.startYear = +1946;
NS.endYear = +2016;
NS.chart = {};
NS.chart.donut = {
  // possible values
  type: "decisionDirection",
  // pie chart radius
  radius: 100,
  // svg height, width, and apdding
  width: 400,
  height: 250,
  padding: 90
}
NS.chart.bar = {
  width: 800,
  height: 250
}

NS.keys = {
  decisionDirection: ["Conservative", "Liberal", "Unspecifiable"],
  issueArea: ["stuff", "will", "go", "here"]
}
///////////////////////////////////////////////////////////////////////////////

// nest the data using d3.nest, rolling up with sums of "type" in each year
// type is either "decisionDirection" or "issueArea"
function nestDataByYear(data, type) {
  // keys is an array of which things will be summed in rollup
  var keys = NS.keys[type]

  // x is the "offset" from array notation to the database; i.e. "conservative"
  // is 0 in the array, and 1 in the dataset
  var x = 1;

  var nestedData = d3.nest()
    .key(function(d) { return +d.term; }) // nest by year (term)
    .rollup(function(v) {

      // create an object to store relevant info (directions or issue areas)
      var temp = {};

      // fill the object with objects like {Conservative: 0}
      for(var i = 0; i < keys.length; i++) {
        temp[keys[i]] = 0;
      }

      // iterate through every case, incrementing each property to get the sums
      for(var i = 0; i < v.length; i++) {
        d = v[i];
        key = "";
        for(var j = 0; j < keys.length; j++) {
          if(+d[type] == j + x) direction = keys[j];
        }
        temp[direction]++;
      }
      return temp;
    })
    .object(data);

  return nestedData;
}

// return an array of objects with the aggregate conservative, liberal, and
// unspecifiable decisions in the given range of years (a to b).
// {direction: c, n: 26}
function aggregateByYear(data, range, type) {
  console.log(data);
  var temp = [];
  var keys = NS.keys[type];
  keys.forEach(function(key) {
    n = 0;
    range.forEach(function(year) {
      n += data[year][key];
    });
    temp.push( {key: key, n: n } );
  });
  return temp;
}


// create the SVG context and return it
function makePieSVG () {
  var My = NS.chart.donut; // make the namespace easier
  //Create SVG element
  My.svg = d3.select("#piechart-container")
        .append("svg")
        .attr("width", My.width)
        .attr("height", My.height);
}
function makeBarSVG () {
  var My = NS.chart.bar; // make the namespace easier
  //Create SVG element
  My.svg = d3.select("#barchart-container")
        .append("svg")
        .attr("width", My.width)
        .attr("height", My.height);
}

function makeLegend() {
  console.log("implement legend next");
  var My = NS.chart.donut; // make the namespace easier
  My.svg.append("g")
    .attr("class", "legendOrdinal")
    .attr("transform", "translate(20,20)");

  My.legendOrdinal = d3.legendColor()
    .scale(My.color);

  My.svg.select(".legendOrdinal")
    .call(My.legendOrdinal);

}

// create a drop down to select the start and end years
function makeMenu() {
  // select the two menus
  menus = d3.selectAll(".datePicker");

  // populate with dates
  for(var i = NS.startYear; i <= NS.endYear; i++) {
    menus.append("option").attr("value", i).text(i);
  }

  // set the initial menu value
  document.getElementById('startYear').value = NS.startYear;
  document.getElementById('endYear').value = NS.endYear;

  // update graph when something is chosen
  menus.on("change", function() {
    // ensure that the start year is smaller than the end year
    if(this.id == "startYear") { var a = this.value, b = NS.endYear; }
    else {var a = NS.startYear, b = this.value;}
    if(a <= b) {
      NS[this.id] = +this.value; // set the global value to the selected option
      updateChart(); // update the chart
    } else {
      // reset the selected option to what it used to be
      document.getElementById(this.id).value = NS[this.id];
      alert("Invalid date range");
    }
  });
}

function setupPieChart() {
  var My = NS.chart.donut; // make the namespace easier

  My.pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.n })

  My.piechart = My.svg.append("g")
    .attr("transform", "translate(" + (My.width - My.radius - My.padding) + "," + (My.height / 2 + 10) + ")")
    .attr("class", "piechart");

  My.color = d3.scaleOrdinal()
    .domain(NS.keys[My.type])
    .range(["#fa8072", "#6495ed", "#d3d3d3"])
  

  My.sliceArc = d3.arc()
      .outerRadius(My.radius)
      .innerRadius(My.radius - 20);

  My.labelArc = d3.arc()
      .outerRadius(My.radius + 20)
      .innerRadius(My.radius + 20);
}

function makePieChart () {
  var My = NS.chart.donut; // make the namespace easier

  // get the data for the pie chart by passing this function an array of all
  // the years in the specified range (inclusive)
  My.data = aggregateByYear(My.dataNested, d3.range(NS.startYear,(NS.endYear)), My.type);
  My.piedata = My.pie(My.data);

  // select all of the arcs (slices)
  My.arc = My.piechart.selectAll(".arc")
    .data(My.piedata)
    .enter().append("g")
      .attr("class", "arc");

  // append the path to each one
  My.arc.append("path")
      .attr("d", My.sliceArc)
      .attr("fill", function(d) { return My.color(d.data.key); })

  // append the label to each one
  My.arc.append("text")
      .attr("transform", function(d) { return "translate(" + My.labelArc.centroid(d) + ")"; })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function(d) { return d.data.n; });

  // add n to the middle
  My.numbers = My.piechart
    .append("g")
    .attr("class", "piechart-numbers");
  My.numbers.append("text")
    .attr("id", "piechart-totalcases")
    .text(function() {
      return NS.nFormat(d3.sum(My.data, function(d) {return d.n}));
    })
    .style("text-anchor", "middle")
    .attr("font-size", "40");
  My.numbers.append("text")
    .text("total decisions")
    .attr("text-anchor", "middle")
    .attr("y", 20);
}

function updateChart() {
  console.log("updating to " + NS.startYear + "-" + NS.endYear);

  var My = NS.chart.donut; // make the namespace easier

  // change the angles to the new data
  My.data = aggregateByYear(My.dataNested, d3.range(NS.startYear,(NS.endYear + 1)), My.type);
  My.piedata = My.pie(My.data);
  
  // bind the new data
  My.arc.data(My.piedata);

  // update the arcs
  My.arc.select("path")
    .attr("d", My.sliceArc);

  My.arc.select("text")
    .text(function(d) {
      return d.data.n;
    });

  // change n
  My.numbers.select("#piechart-totalcases")
    .transition().duration(500)
    // animate the text gradually increasing/decreasing
    // adapted from https://bl.ocks.org/mbostock/7004f92cac972edef365
    .tween("text", function() {
      var that = d3.select(this)
      // get the sum of all the decisions
      var n = d3.sum(My.data, function(d) {return d.n});
      // interpolate between. The replace() is necessary b/c of the commas
      // added by NS.nFormat.
      var i = d3.interpolateNumber(that.text().replace(/,/g, ""), n);
      return function(t) { that.text(NS.nFormat(i(t))); };
    })
}

function main (data) {
  console.log("main function");

  // aggregate data for decision direction breakdown
  var donut = NS.chart.donut;
  donut.dataNested = nestDataByYear(data, "decisionDirection");

  // make the SVG
  makePieSVG(); // stores in NS.chart.donut.svg

  // Set up pie chart and draw for the first time
  setupPieChart();
  makePieChart();

  // make the legend
  makeLegend();

  // make the SVG
  makeBarSVG();

  // make the menu
  makeMenu();
}

function initialize() {

  // Load census data and call main
  d3.csv(NS.datapath, function(data) {
    main(data);
  });
}

//////////////////////////////////////////////////////////////////////

initialize()
