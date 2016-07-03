var npa = require('npm-package-arg');
var guessVersion = require('./lib/guessVersion.js');
var Promise = require('bluebird');

module.exports = function (http, url) {
  url = url || 'http://registry.npmjs.org/';
  if (url[url.length - 1] !== '/') {
    throw new Error('registry url is supposed to end with /');
  }
  var progress;
  var cache = Object.create(null);

  return {
    createNpmDependenciesGraph: createNpmDependenciesGraph,
    notifyProgress: function (cb) {
      progress = cb;
    }
  };

  function createNpmDependenciesGraph(packageName, graph, version) {
    if (!packageName) throw new Error('Initial package name is required');
    if (!graph) throw new Error('Graph data structure is required');
    if (!version) version = 'latest';

    var queue = [];
    var processed = Object.create(null);

    queue.push({
      name: packageName,
      version: version,
      parent: null
    });

    return processQueue(graph);

    function processQueue(graph) {
      if (typeof progress === 'function') {
        progress(queue.length);
      }

      var work = queue.pop();

      // TODO: This will not work for non-npm names (e.g. git+https://, etc.)
      var escapedName = npa(work.name).escapedName;
      if (!escapedName) {
        // this will not work for non-npm packages. e.g. git+https:// , etc.
        throw new Error('TODO: Escaped name is missing for ' + work.name);
      }

      var cached = cache[work.name];
      if (cached) {
        return new Promise(function(resolve) {
          resolve(processRegistryResponse(cached));
        });
      }

      return http(url + escapedName).then(processRegistryResponse);

      function processRegistryResponse(res) {
        cache[work.name] = res;
        traverseDependencies(work, res.data);

        if (queue.length) {
          // continue building the graph
          return processQueue(graph);
        }

        return graph;
      }
    }

    function traverseDependencies(work, packageJson) {
      var version = guessVersion(work.version, packageJson);
      var pkg = packageJson.versions[version];

      var id = pkg._id;
      if (processed[id]) return;
      processed[id] = true;

      // TODO: here is a good place to address https://github.com/anvaka/npmgraph.an/issues/4
      var dependencies = pkg.dependencies;

      graph.beginUpdate();

        graph.addNode(id, pkg);
        if (work.parent && !graph.hasLink(work.parent, id)) {
          graph.addLink(work.parent, id);
        }

      graph.endUpdate();

      if (dependencies) {
        Object.keys(dependencies).forEach(addToQueue);
      }

      function addToQueue(name) {
          queue.push({
            name: name,
            version: dependencies[name],
            parent: id
          })
        }
    }
  }
};
