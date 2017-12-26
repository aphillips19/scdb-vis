/*
    SCOTUS Data Project
    "At-A-Glance" pie chart on home page
    Andrew Phillips & Jake Rourke
*/

//Some code adapted from https://bl.ocks.org/mbostock/1346410 - Pie Chart Update II

var NS = {}; // create namespace

NS.datapath = "../Data/SCDB_M_caseCentered.csv"

NS.width = 400;      // of SVG
NS.height = 300;     // of SVG
NS.radius = 100;
NS.padding = 40;

NS.startYear = +1946;
NS.endYear = +2016;

NS.nFormat = d3.format(",d");

NS.directions = ["Conservative", "Liberal", "Unspecifiable"];

///////////////////////////////////////////////////////////////////////////////

function nestData() {

  // Nest the data by year, counting the number of cases in every issue area
  // in each year
  
  NS.dataByYear = d3.nest()
    .key(function(d) { return +d.term; })
    .rollup(function(v) {
      var temp = {
        Conservative: 0,
        Liberal: 0,
        Unspecifiable: 0
      };
      // iterate through every case, incrementing the proper decision direction
      for(var i = 0; i < v.length; i++) {
        d = v[i];
        direction = "";
        if(+d.decisionDirection == 1)       direction = "Conservative";
        else if(+d.decisionDirection == 2)  direction = "Liberal";
        else                                direction = "Unspecifiable";
        
        temp[direction]++;
      }
      return temp;
    })
    .object(NS.dataset);
}

// return an array of objects with the aggregate conservative, liberal, and
// unspecifiable decisions in the given range of years (a to b).
// {direction: c, n: 26}
function aggregateByYear(range) {
  var temp = [];
  NS.directions.forEach(function(dir) {
    count = 0;
    range.forEach(function(year) {
      count += NS.dataByYear[year][dir];
    });
    temp.push( {direction: dir, n: count } );
  });
  return temp;
}


// create the SVG context and return it
function makeSVG () {
  
  //Create SVG element
  NS.svg = d3.select("#piechart-container")
        .append("svg")
        .attr("width", NS.width)
        .attr("height", NS.height);
}

function makeLegend() {
  NS.svg.append("g")
    .attr("class", "legendOrdinal")
    .attr("transform", "translate(20,20)");

  NS.legendOrdinal = d3.legendColor()
    .scale(NS.color);

  NS.svg.select(".legendOrdinal")
    .call(NS.legendOrdinal);

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
  NS.pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.n })

  NS.piechart = NS.svg.append("g")
    .attr("transform", "translate(" + (NS.width - NS.radius - NS.padding) + "," + NS.height / 2 + ")")
    .attr("class", "piechart");

  NS.color = d3.scaleOrdinal()
    .domain(NS.directions)
    .range(["#fa8072", "#6495ed", "#d3d3d3"])
  

  NS.d3arc = d3.arc()
      .outerRadius(NS.radius)
      .innerRadius(NS.radius - 20);

  NS.label = d3.arc()
      .outerRadius(NS.radius + 20)
      .innerRadius(NS.radius + 20);
}

function makePieChart () {
  // get the data for the pie chart by passing this function an array of all
  // the years in the specified range (inclusive)
  NS.data = aggregateByYear(d3.range(NS.startYear,(NS.endYear)));
  NS.piedata = NS.pie(NS.data);

  // select all of the arcs (slices)
  NS.arc = NS.piechart.selectAll(".arc")
    .data(NS.piedata)
    .enter().append("g")
      .attr("class", "arc");

  // append the path to each one
  NS.arc.append("path")
      .attr("d", NS.d3arc)
      .attr("fill", function(d) { return NS.color(d.data.direction); })

  // append the label to each one
  NS.arc.append("text")
      .attr("transform", function(d) { return "translate(" + NS.label.centroid(d) + ")"; })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function(d) { return d.data.n; });

  // add n to the middle
  NS.numbers = NS.piechart
    .append("g")
    .attr("class", "piechart-numbers");
  NS.numbers.append("text")
    .attr("id", "piechart-totalcases")
    .text(function() {
      return NS.nFormat(d3.sum(NS.data, function(d) {return d.n}));
    })
    .style("text-anchor", "middle")
    .attr("font-size", "40");
  NS.numbers.append("text")
    .text("total decisions")
    .attr("text-anchor", "middle")
    .attr("y", 20);
}

function updateChart() {
  console.log("updating to " + NS.startYear + "-" + NS.endYear);

  // change the angles to the new data
  NS.data = aggregateByYear(d3.range(NS.startYear,(NS.endYear + 1)));
  NS.piedata = NS.pie(NS.data);
  
  // bind the new data
  NS.arc.data(NS.piedata);

  // update the arcs
  NS.arc.select("path")
    .attr("d", NS.d3arc)

  NS.arc.select("text")
    .text(function(d) {
      return d.data.n;
    });

  // change n
  NS.numbers.select("#piechart-totalcases")
    .transition().duration(500)
    // animate the text gradually increasing/decreasing
    // adapted from https://bl.ocks.org/mbostock/7004f92cac972edef365
    .tween("text", function() {
      var that = d3.select(this)
      // get the sum of all the decisions
      var n = d3.sum(NS.data, function(d) {return d.n});
      // interpolate between. The replace() is necessary b/c of the commas
      // added by NS.nFormat.
      var i = d3.interpolateNumber(that.text().replace(/,/g, ""), n);
      return function(t) { that.text(NS.nFormat(i(t))); };
    })
}

function main () {
  console.log("main function");

  // aggregate data
  nestData();

  // make the SVG
  makeSVG(); // stores in NS.svg

  // Set up pie chart and draw for the first time
  setupPieChart();
  makePieChart();

  // make the legend
  makeLegend();

  // make the menu
  makeMenu();
}

function initialize() {

  // Load census data and call main
  d3.csv(NS.datapath, function(d) {
    NS.dataset = d;
    main();
  });
}

//////////////////////////////////////////////////////////////////////

initialize()
