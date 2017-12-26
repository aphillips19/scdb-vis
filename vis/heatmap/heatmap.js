/* Heatmap
 * Andrew Phillips & Jake Rourke
 * Nov 13, 2017 */


var NS = {}; // create namespace

NS.datapath = "../../data/SCDB_2017_01_justiceCentered_LegalProvision.csv"
//NS.datapath = "../../Data/SCDB_M_justiceCentered.csv"

//NS.datapath = "../../Data/SCDB_small.csv"


//margins
NS.margin = { top: 50, right: 0, bottom: 100, left: 100 },

//width and height
NS.width = 960 - NS.margin.left - NS.margin.right,
NS.height = 2000 - NS.margin.top - NS.margin.bottom,


//heatmap tile dimensions
NS.gridSize = Math.floor(NS.width / 20),
NS.gridHeight = Math.floor(NS.width / 40),


//size for civil liberties view
NS.civilgridSize = Math.floor(NS.width / 3),

//size of legend
NS.legendElementWidth = NS.gridSize*2,


//color scale 
NS.buckets = 9,
NS.colors = ['#fa8072','#f49689','#ecaba1','#e2bfba','#d3d3d3','#bcc3da','#a3b3e1','#87a4e7','#6495ed']
// https://gka.github.io/palettes/#colors=salmon,LightGrey,CornflowerBlue|steps=9|bez=0|coL=0


//lists for labels
NS.civil_list = ["Civil Liberty", "Other"]

NS.issueAreas = [
  "Criminal",    // 1
  "Civil Rights",          // 2
  "First Amend.",       // 3
  "Due Process",           // 4
  "Privacy",               // 5
  "Attorneys",             // 6
  "Unions",                // 7
  "Economic",     // 8
  "Judicial power",        // 9
  "Federalism",            // 10
  "Interstate",  // 11
  "Federal Tax",      // 12
  "Misc.",         // 13
  "Private Action"         // 14
]


//////////////////////////////////////////////////////////////////////
// functions


//This function does the hard work of formatting the data so that the different
//graphs and views can properly process the data


function aggregateData() {
  // Nest the data by justice, and aggregate the relevant information.
  NS.dataByJustice = d3.nest()
    .key(function(d) {return d.justiceName})
    .rollup( function(v) {
      // originally, we had hoped to use such functions as d3.mean and d3.sum
      // for each issue area, but these functions turned out to be incredibly
      // inefficient when used so many times on a very large dataset. Instead,
      // we are aggregating the data by iterating through the data ourselves.

      // v is an array of all of the cases of a given justice

      // initialize and populate an array to store aggregate information,
      // indexed by issue area.
      aggregates = [];
      for(var issueArea = 0; issueArea < 14; issueArea++) {
        aggregates[issueArea] =
          {
            direction: 0,
            opinion: {
              majority: 0,
              minority: 0,
              other: 0
            },
            n: 0
          }
      }
      // iterate through each case in the array, incrementing counters by issue area
      for(var i = 0; i < v.length; i++) {
        var d = v[i]; // shorthand to make the syntax more similar to d3 methods

        // ignore all cases where the direction is NOT between 1 and 2 (either
        // 3, meaning unspecifiable, which is not significant in this field,
        // or data is simply missing). Similarly, ignore if the issue area is
        // not specified.
        if(d.direction >= 1 && d.direction <= 2 && d.issueArea != "") {
          // increment the decision direction, and keep track of n to take the mean later on
          aggregates[+d.issueArea - 1].direction += +d.direction;
          aggregates[+d.issueArea - 1].n++;

          // increment the opinion counts (minority/majority/other)
          if(d.majority == 2)       aggregates[+d.issueArea - 1].opinion.majority++;
          else if(d.majority == 1)  aggregates[+d.issueArea - 1].opinion.minority++;
          else                      aggregates[+d.issueArea - 1].opinion.other++;
        }
      }

      // in each issue area, divide aggregate direciton by n in order to get the mean
      // unless the direction is 0 (meaning it has never been recorded)
      for(var issueArea = 0; issueArea < 14; issueArea++) {
          // set to undefined if there were no cases in which the justice had a
          // specifiable direction; these will be ignored in the heatmap
        if(aggregates[issueArea].direction > 0) 
          aggregates[issueArea].direction /= aggregates[issueArea].n;
        else
          aggregates[issueArea] = undefined;
      }
      return aggregates;
    })
    .entries(NS.dataset);


  // make a list of the justices
  NS.justices = [];

  // make a new dataset in the form:
  //  justiceName, issueArea, direction
  NS.dataGood = [];
  NS.dataByJustice.forEach(function (d, i) {
    // add justice to the list of justices
    NS.justices[i] = d.key;
    // do stuff
    NS.issueAreas.forEach(function (v, j) {
      if(typeof d.value[j] == "undefined") return undefined;
      else {
        line = {
          justiceName: i,
          issueArea: j,
          direction: d.value[j].direction,
          majority:  d.value[j].opinion.majority,
          minority:  d.value[j].opinion.minority,
          n: d.value[j].n
        }
     }
      NS.dataGood.push(line);
    })
  })



  // add an object to data that the pie chart can handle
  NS.dataGood.forEach(function (d) {
    d["pieChartData"] = [{"label":"majority", "value":d.majority}, 
                         {"label":"minority", "value":d.minority}];



  });


//This will be the data that the civil liberties view uses
  NS.civilDataGood = [];

  // for civil liberties view pie chart data 
  NS.majorityT = 0;
  NS.minorityT = 0;

  var justiceCount = 0;

  //change the data to 37x2 data points for civil liberties view
  NS.dataByJustice.forEach(function (d) {

    var count = 0;
    var civil = [];
    var other = [];
    var majCountC = 0;
    var minCountC = 0;
    var majCountO = 0;
    var minCountO = 0;

    //get values into seperate lists
    d.value.forEach(function (v) {

      // we don't want missing data
      if(typeof v == 'undefined') {
        count++;
        return;
      }

      //if it is a civil liberty
      if (count <= 5) {
        
        civil.push(v.direction);
        majCountC += v.opinion.majority;
        minCountC += v.opinion.minority;
      }


      // if it is not a civil liberty
      else {
        other.push(v.direction);
        majCountO += v.opinion.majority;
        minCountO += v.opinion.minority;
      }

      count++;




    });



    //counts for missing data
    var civilMissing = 0;
    var otherMissing = 0;


    //get averages for each
    var civilTotal = 0;
    civil.forEach(function (z) {

      civilTotal += z;

    });

    var otherTotal = 0;
    other.forEach(function (g) {

      otherTotal += g;

    });

    //finish computing averages for civil liberty tiles
    var civilVal = civilTotal / (civil.length);
    var otherVal = otherTotal / (other.length);

    //add this data to civil liberty data set 
    NS.civilDataGood.push({ direction: civilVal, justiceName: justiceCount, typeNum: 0, pieList: [{"label":"majority", "value":majCountC}, {"label":"minority", "value":minCountC}]});
    NS.civilDataGood.push({ direction: otherVal, justiceName: justiceCount, typeNum: 1, pieList: [{"label":"majority", "value":majCountO}, {"label":"minority", "value":minCountO}]});

    //for civil liberty pie charts
    NS.minorityT += minCountO;
    NS.minorityT += minCountC;
    NS.majorityT += majCountO;
    NS.majorityT += majCountC;


    justiceCount++;




  });


//data to initialize pie chart with totals 
NS.pieInitdata = [{"label":"majority", "value":NS.majorityT}, 
                  {"label":"minority", "value":NS.minorityT}];


};


function main () {
  //console.log("main function");

  // aggregate data
  aggregateData();

  // make SVG
  svg = d3.select("body").append("svg")
          .attr("width", NS.width + NS.margin.left + NS.margin.right)
          .attr("height", 900)
          .attr("id", "heatmap")
          .append("g")
          .attr("transform", "translate(" + NS.margin.left + "," + NS.margin.top + ")");

  
  //initialize with regular heat map ciew
  heatmap(svg);

  //initialize pie chart with totals 
  pieChart(NS.pieInitdata);
}

function heatmap(svg) {

  //define color scale
  colorScale = d3.scaleQuantile()
    .domain([1, 2])
    .range(NS.colors);

  //define tiles with data
  cards = svg.selectAll(".issueArea")
      .data(NS.dataGood)

  //create justice labels
  justiceLabels = svg.selectAll(".justiceLabel")
    .data(NS.justices)
    .enter().append("text")
      .text(function (d) { return d; })
      .attr("x", 0)
      .attr("y", (d, i) => i * NS.gridHeight)
      .style("text-anchor", "end")
      .attr("transform", "translate(-6," + NS.gridHeight / 1.5 + ")")
      .attr("class", (d, i) => ((i >= 0 && i <= 4) ? "dayLabel mono axis axis-workweek" : "dayLabel mono axis"));

  //create issue area labels
  issueLabels = svg.selectAll(".issueLabel")
    .data(NS.issueAreas)
    .enter().append("text")
      .text(function (d) { return d; })
      .attr("x", 0)
      .attr("y", 0)
      .attr("id", "issuelabs")
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .attr("transform", function(d, i) {
        return "translate(" + (i * NS.gridSize) + ",0)" + "translate(" + NS.gridSize / 2 + ", -25), rotate(-65)";
      })
      .attr("class", (d, i) => ((i >= 7 && i <= 16) ? "timeLabel mono axis axis-worktime" : "timeLabel mono axis"));





  cards.append("title");

  //
  function filterColors(dir) {
    if(dir > 0)
      return colorScale(dir);
    else
      return "#FFFFFF";
  }


  //create tiles
  cards.enter().append("rect")
      .attr("x", function(d) {
        return d.issueArea * NS.gridSize;
      })
      .attr("y", function(d) {
        return d.justiceName * NS.gridHeight;
      })
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("class", "issueArea bordered")
      .attr("width", NS.gridSize)
      .attr("height", NS.gridHeight)
      .style("fill", function(d) {
        return filterColors(d.direction);
      })
      .on('mouseover', function (d) {update1(d.pieChartData)}); // on mouse over -> new pie chart



      //create legend 
      legend = svg.selectAll(".legend")
          .data([0].concat(colorScale.quantiles()), (d) => d);

      legend_g = legend.enter().append("g")
          .attr("class", "legend");

      legend_g.append("rect")
        .attr("x", (d, i) => NS.legendElementWidth * i)
        .attr("y", 800)
        .attr("width", NS.legendElementWidth)
        .attr("height", NS.gridHeight / 2)
        .style("fill", (d, i) => NS.colors[i]);

      legend_g.append("text")
        .attr("class", "mono")
        .text((d) => "≥ " + Math.round(d))
        .attr("x", (d, i) => NS.legendElementWidth * i)
        .attr("y", NS.height + NS.gridHeight);

} // end heatmap

function heatmap_2(svg) {

  //color scale
  colorScale = d3.scaleQuantile()
    .domain([1, 2])
    .range(NS.colors);

  //define tiles with data
  cards = svg.selectAll(".typeNum")
      .data(NS.civilDataGood)

  // create justice labels
  justiceLabels = svg.selectAll(".justiceLabel")
    .data(NS.justices)
    .enter().append("text")
      .text(function (d) { return d; })
      .attr("x", 0)
      .attr("y", (d, i) => i * NS.gridHeight)
      .style("text-anchor", "end")
      .attr("transform", "translate(-6," + NS.gridHeight / 1.5 + ")")
      .attr("class", (d, i) => ((i >= 0 && i <= 4) ? "dayLabel mono axis axis-workweek" : "dayLabel mono axis"));

  //create civil liberty/other labels 
  issueLabels = svg.selectAll(".issueLabel")
    .data(NS.civil_list)
    .enter().append("text")
      .text(function (d) { return d; })
      .attr("x", (d, i) => i * NS.civilgridSize)
      .attr("y", 0)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .attr("transform", "translate(" + NS.civilgridSize / 2 + ", -6)")
      .attr("class", (d, i) => ((i >= 7 && i <= 16) ? "timeLabel mono axis axis-worktime" : "timeLabel mono axis"));


  cards.append("title");

  function filterColors(dir) {
    if(dir > 0)
      return colorScale(dir);
    else
      return "#FFFFFF";
  }


  //create tiles
  cards.enter().append("rect")
      .attr("x", function(d) {
      
        return d.typeNum * NS.civilgridSize;
      })
      .attr("y", function(d) {
        return d.justiceName * NS.gridHeight;
      })
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("class", "issueArea bordered")
      .attr("width", NS.civilgridSize)
      .attr("height", NS.gridHeight)
      .style("fill", function(d) {
        return filterColors(d.direction);
      })
      .on('mouseover', function (d) {update1(d.pieList)}); // pie chart on mouse over


      
  //create legend 
  legend = svg.selectAll(".legend")
      .data([0].concat(colorScale.quantiles()), (d) => d)

  legend_g = legend.enter().append("g")
      .attr("class", "legend")

  legend_g.append("rect")
    .attr("x", (d, i) => NS.legendElementWidth * i)
    .attr("y", 800)
    .attr("width", NS.legendElementWidth)
    .attr("height", NS.gridHeight / 2)
    .style("fill", (d, i) => NS.colors[i])

  legend_g.append("text")
    .attr("class", "mono")
    .text((d) => "≥ " + Math.round(d))
    .attr("x", (d, i) => NS.legendElementWidth * i)
    .attr("y", NS.height + NS.gridHeight);

      

} // end heatmap


//Remove SVG before creating new heatmap
function removeHSVG() {
  d3.select("#heatmap").remove();

} // end removeSVG


// change view to civil liberties 
function civilButton() {
  removeHSVG();
  // make SVG
  svg = d3.select("body").append("svg")
          .attr("width", NS.width + NS.margin.left + NS.margin.right)
          .attr("height", 900)
          .attr("id", "heatmap")
          .append("g")
          .attr("transform", "translate(" + NS.margin.left + "," + NS.margin.top + ")");

  heatmap_2(svg);

}

//change view to original issue area view
function regularButton() {

  //remove old svg
  removeHSVG();

  //create new one
  svg = d3.select("body").append("svg")
          .attr("width", NS.width + NS.margin.left + NS.margin.right)
          .attr("height", 900)          
          .attr("id", "heatmap")
          .append("g")
          .attr("transform", "translate(" + NS.margin.left + "," + NS.margin.top + ")");
  
  // create new heatmap
  heatmap(svg);

}







function pieChart(data) {

  var w = 300,                        //width
  h = 300,                            //height
  r = 150,                            //radius
  color = d3.scaleOrdinal(["#98abc5", "#ff8c00"]);    //builtin range of colo 
  

  
  var vis = d3.select("#piechart-container")
      .append("svg:svg")              //create the SVG element inside the <body>
      .data([data])                   //associate our data with the document
          .attr("id", "pieChart")
          .attr("width", w)           //set the width and height of our visualization (these will be attributes of the <svg> tag
          .attr("height", h)
      .append("svg:g")                //make a group to hold our pie chart
          .attr("transform", "translate(" + r + "," + r + ")")    //move the center of the pie chart from 0, 0 to radius, radi  
  
  var arc = d3.arc()              //this will create <path> elements for us using arc data
              .innerRadius(0)
              .outerRadius(r)
  
  var pie = d3.pie()           //this will create arc data for us given a list of values
      .value(function(d) { return d.value; });    //we must tell it out to access the value of each element in our data arr 
  
  var arcs = vis.selectAll("g.slice")     //this selects all <g> elements with class slice (there aren't any yet)
      .data(pie)                          //associate the generated pie data (an array of arcs, each having startAngle, endAngle and value properties) 
      .enter()                            //this will create <g> elements for every "extra" data element that should be associated with a selection. The result is creating a <g> for every object in the data array
          .append("svg:g")                //create a group to hold each slice (we will have a <path> and a <text> element associated with each slice)
              .attr("class", "slice");    //allow us to style things in the slices (like tex  
      arcs.append("svg:path")
              .attr("fill", function(d, i) { return color(i); } ) //set the color for each slice to be chosen from the color function defined above
              .attr("d", arc);                                    //this creates the actual SVG path using the associated data (pie) with the arc drawing functi  
      arcs.append("svg:text")                                     //add a label to each slice
              .attr("transform", function(d) {                    //set the label's origin to the center of the arc
              //we have to make sure to set these before calling arc.centroid
              d.innerRadius = 0;
              d.outerRadius = r;
              return "translate(" + arc.centroid(d) + ")";        //this gives us a pair of coordinates like [50, 50]
          })
          .attr("text-anchor", "middle")                          //center the text on it's origin
          .text(function(d, i) { return data[i].label; });        //get the label from our original data array
        




}

function update1(data) {

  d3.select("#pieChart").remove();

  var totalNum = data[0].value + data[1].value;



  var w = 300,                        //width
  h = 300,                            //height
  r = 150,                            //radius
  color = d3.scaleOrdinal(["#98abc5", "#ff8c00"]);    //builtin range of colo 
  

  
  var vis = d3.select("#piechart-container")
      .append("svg:svg")              //create the SVG element inside the <body>
      .data([data])                   //associate our data with the document
          .attr("id", "pieChart")
          .attr("width", w)           //set the width and height of our visualization (these will be attributes of the <svg> tag
          .attr("height", h)
      .append("svg:g")                //make a group to hold our pie chart
          .attr("transform", "translate(" + r + "," + r + ")")    //move the center of the pie chart from 0, 0 to radius, radi  
  
  var arc = d3.arc()              //this will create <path> elements for us using arc data
              .innerRadius(0)
              .outerRadius(r)
  
  var pie = d3.pie()           //this will create arc data for us given a list of values
      .value(function(d) { return d.value; });    //we must tell it out to access the value of each element in our data arr 
  
  var arcs = vis.selectAll("g.slice")     //this selects all <g> elements with class slice (there aren't any yet)
      .data(pie)                          //associate the generated pie data (an array of arcs, each having startAngle, endAngle and value properties) 
      .enter()                            //this will create <g> elements for every "extra" data element that should be associated with a selection. The result is creating a <g> for every object in the data array
          .append("svg:g")                //create a group to hold each slice (we will have a <path> and a <text> element associated with each slice)
              .attr("class", "slice");    //allow us to style things in the slices (like tex  
      arcs.append("svg:path")
              .attr("fill", function(d, i) { return color(i); } ) //set the color for each slice to be chosen from the color function defined above
              .attr("d", arc);                                    //this creates the actual SVG path using the associated data (pie) with the arc drawing functi  
      arcs.append("svg:text")                                     //add a label to each slice
              .attr("transform", function(d) {                    //set the label's origin to the center of the arc//we have to make sure to set these before calling arc.centroid
              d.innerRadius = 0;
              d.outerRadius = r;
              return "translate(" + arc.centroid(d) + ")";        //this gives us a pair of coordinates like [50, 50]
          })
          .attr("text-anchor", "middle")                          //center the text on it's origin
          .text(function(d, i) { return data[i].label; })      //get the label from our original data array
      arcs.append("svg:text")
              .attr("text-anchor", "middle")
              .text("Total: " + totalNum);


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



