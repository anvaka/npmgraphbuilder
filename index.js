var npa = require('npm-package-arg');
var guessVersion = require('./lib/guessVersion.js');
var Promise = require('bluebird');

module.exports = buildGraph;
module.exports.isRemote = isRemote;

function buildGraph(http, url) {
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

      var cached = cache[getCacheKey(work)];
      if (cached) {
        return new Promise(function(resolve) {
          resolve(processRegistryResponse(cached));
        });
      }

      if (isRemote(work.version)) {
        // TODO: This will not download remote dependnecies (e.g. git-based)
        return new Promise(function(resolve) {
          resolve(processRegistryResponse({data: {}}));
        });
      }

      var escapedName = npa(work.name).escapedName;
      if (!escapedName) {
        throw new Error('TODO: Escaped name is missing for ' + work.name);
      }

      return http(url + escapedName).then(processRegistryResponse);

      function processRegistryResponse(res) {
        cache[getCacheKey(work)] = res;
        traverseDependencies(work, res.data);

        if (queue.length) {
          // continue building the graph
          return processQueue(graph);
        }

        return graph;
      }
    }

    function getCacheKey(work) {
      var packageIsRemote = isRemote(work.version);
      var cacheKey = work.name;
      return packageIsRemote ? cacheKey + work.version : cacheKey
    }

    function traverseDependencies(work, packageJson) {
      var version, pkg, id;
      if (isRemote(work.version)) {
        version = '';
        pkg = packageJson;
        id = work.version;
      } else {
        version = guessVersion(work.version, packageJson);
        pkg = packageJson.versions[version];
        id = pkg._id;
      }

      // TODO: here is a good place to address https://github.com/anvaka/npmgraph.an/issues/4
      var dependencies = pkg.dependencies;

      graph.beginUpdate();

      graph.addNode(id, pkg);

      if (work.parent && !graph.hasLink(work.parent, id)) {
        graph.addLink(work.parent, id);
      }

      graph.endUpdate();

      if (processed[id]) {
        // no need to enqueue this package again - we already downladed it before
        return;
      }
      processed[id] = true;

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
}

function isRemote(version) {
  return typeof version === 'string' && (
    (version.indexOf('git') === 0) ||
    (version.indexOf('http') === 0) ||
    (version.indexOf('file') === 0)
  );
}
