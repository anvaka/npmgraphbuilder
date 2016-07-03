/**
 * Adjusted from https://github.com/npm/npm-remote-ls
 *
 * Copyright (c) 2014, npm, Inc. and Contributors
 */
module.exports = guessVersion;

var semver = require('semver');

function guessVersion(versionString, packageJson) {
  if (versionString === 'latest') versionString = '*'

  var availableVersions = Object.keys(packageJson.versions)
  var version = semver.maxSatisfying(availableVersions, versionString, true)

  // check for prerelease-only versions
  if (!version && versionString === '*' && availableVersions.every(function (av) {
    return new semver.SemVer(av, true).prerelease.length
  })) {
    // just use latest then
    version = packageJson['dist-tags'] && packageJson['dist-tags'].latest
  }

  if (!version) throw Error('could not find a satisfactory version for string ' + versionString)
  else return version
}
