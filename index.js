var fs = require('fs'),
    path = require('path'),
    watch = require('watch'),
    events = require('events'),
    util = require('util'),
    async = require('async');
 
var Compiler = function Compiler(options)  {
  events.EventEmitter.call(this);
  options = options || {};
  if (!options.src)
    throw "src option is required";
  this.srcDir = options.src;
  this.destFile = options.dest || path.join(this.srcDir, 'index.html');
  this.watching = false;
  this.compileReady = true;
};
 
util.inherits(Compiler, events.EventEmitter);

Compiler.prototype.watch = function() {
  if (this.watching) return;
  this.watching = true;
  var self = this;
  watch.watchTree(this.srcDir, function (f, curr, prev) {
    if (typeof f == "object" && prev === null && curr === null) {
      console.log(Object.keys(f));
      self.files = Object.keys(f);
      return;
    }
    self.markCompile();
  });   
};

Compiler.prototype.markCompile = function() {
  this.compileReady = true;
};

Compiler.prototype.compiler = function() {
  var self = this;
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var cb = args[args.length - 1];
    self.compileIfNecessary(cb);
  }
};

Compiler.prototype.compileIfNecessary = function(cb) {
  if (this.compileReady) {
    this.compile(cb);
  } else {
    cb();
  }
}

Compiler.prototype.compile = function(cb) {
  console.log("Compile:");
  console.log(this.files);
  var self = this;
  var writeStream = fs.createWriteStream(this.destFile);
  var numFiles = this.files.length;
  var fileCount = 0;
  var pipes = this.files.map(function(file) {
    return function(callback) {
      fs.lstat(file, function(err, stat) {
        if (err) {
          callback(err);
        } else if (!stat.isDirectory() && path.extname(file) === '.html') {
          var readStream = fs.createReadStream(file);
          readStream.on('open', function() {
            var id = path.basename(path.relative(self.srcDir, file).replace(/\//g, '-'), path.extname(file));
            writeStream.write('<script type="text/html" id="' + id +'">');
          });
          readStream.on('end', function() {
            writeStream.write('</script>\n');
            callback();
          });
          readStream.pipe(writeStream, { end: false });
        } else {
          callback();
        }
      });
    }
  });
  pipes << function(callback) {
    writeStream.close();
    callback();
  }
  // there's got to be a way to do this parallel...
  async.series(pipes, function(err) {
    self.compileReady = false;
    cb(err);
  });
};

module.exports = function(options) {
  return new Compiler(options);
};