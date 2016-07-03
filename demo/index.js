var graph = require('ngraph.graph')();
var graphBuilder = require('../')(httpClient);

var pkgName = process.argv[2] || 'browserify';
console.log('building dependencies graph for', pkgName);

graphBuilder.createNpmDependenciesGraph(pkgName, graph).
  then(function (graph) {
    console.log('Done.');
    console.log('Nodes count: ', graph.getNodesCount());
    console.log('Edges count: ', graph.getLinksCount());
    console.log('Graph:');
    var serializer = require('ngraph.serialization/json');
    console.log(serializer.save(graph));
  })
  .fail(function (err) {
    console.error('Failed to build graph: ', err);
  });

function httpClient(url, data) {
  console.log('Calling: ', url);
  var q = require('q');
  var http = require('http');
  var querystring = require('querystring');

  var defer = q.defer();
  http.get(url + '?' + querystring.stringify(data), function (res) {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      body += chunk;
    }).on('end', function () {
      defer.resolve({ data: JSON.parse(body) });
    });
  });

  return defer.promise;
}
