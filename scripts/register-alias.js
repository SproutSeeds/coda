const Module = require('module');
const path = require('path');
const baseDir = path.resolve(__dirname, '..');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(baseDir, request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
