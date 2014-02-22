module.exports = function (http) {
  var url = 'http://isaacs.iriscouch.com/registry/_design/scratch/_view/byField';
  var packagesPerRequest = 20;
  var resolvedNodes = [], queue = [];

  return {
    createNpmDependenciesGraph: function (packageName, graph) {
      if (!packageName) throw new Error('Initial package name is required');
      if (!graph) throw new Error('Graph data structure is required');

      graph.addNode(packageName);
      queue.push(packageName);
      return processQueue(graph);
    }
  };

  function processQueue(graph) {
    var packages = queue.slice(0, packagesPerRequest);
    queue = queue.slice(packagesPerRequest);
    return http(url, {keys: JSON.stringify(packages)}).then(
      function processRegistryResponse(res) {
        if (!res || !res.data || !res.data.rows) {
          throw new Error('Could not fetch package information from the registry');
        }

        addToGraph(res.data.rows, graph);

        if (queue.length) {
          // continue building the graph
          return processQueue(graph);
        }
      }
    );
  }


  function addToGraph(packages, graph) {
    graph.beginUpdate();

    packages.forEach(addNode);
    resolvedNodes.forEach(updateEdges);

    graph.endUpdate();

    function addNode(pkg) {
      graph.addNode(pkg.id, pkg.value);
      resolvedNodes.push(pkg.value);
    }

    function updateEdges(pkg) {
      var dependencies = pkg.dependencies;
      if (!dependencies) return;
      if (!pkg._id) return; // sometimes this may happen. See https://github.com/npm/npm/issues/4665

      var nodeId = pkg._id.split('@')[0];

      Object.keys(dependencies).forEach(function (otherNode) {
        if (graph.hasLink(nodeId, otherNode)) return;

        if (!graph.getNode(otherNode)) {
          // this node is not yet fetched, schedule it and add place holder
          // into a graph:
          queue.push(otherNode);
          graph.addNode(otherNode, {});
        }
        graph.addLink(nodeId, otherNode);
      });
    }
  }
};
