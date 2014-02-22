var test = require('tap').test,
    q = require('q'),
    createGraph = require('ngraph.graph'),
    createGraphBuilder = require('../');

test('Passes default data', function (t) {
  t.plan(3);

  var builder = createGraphBuilder(function (url, data) {
    t.ok(url, 'Has default registry url');
    t.ok(data.keys.indexOf('browserify') >= 0, 'Has package');
    return q.all([]);
  });

  var graph = createGraph();
  builder.createNpmDependenciesGraph('browserify', graph).fail(function (err) {
    t.ok(err, 'Fired error, since we did not provide valid response');
  });
});

test('Checks dependencies', function (t) {
  t.plan(2);
  var builder = createGraphBuilder(function (url, data) {
    return q.fcall(createFakeResponse);
  });

  var graph = createGraph();
  builder.createNpmDependenciesGraph('browserify', graph)
    .then(function () {
      t.equals(graph.getNodesCount(), 2, 'Graph has two links');
      t.ok(graph.hasLink('browserify', 'util'), 'Graph has two links');
    });
});

function createFakeResponse() {
  return {
    data: {
      rows: [{
          id: 'browserify',
          value: {
            _id: 'browserify@3.30.2',
            dependencies: {
              "util": "~0.10.1"
            }
          }
        }
      ]
    }
  };
}
