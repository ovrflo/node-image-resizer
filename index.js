var async = require('async');
var resize = require('resize');
var http = require('http');
var cluster = require('cluster');
var winston = require('winston');
var express = require('express');
var path = require('path');
var numCPUs = require('os').cpus().length;
var program = require('commander');
var fs = require('fs');
var _ = require('underscore');

program
    .version('0.0.1')
    .option('-c, --children <count>', 'How many workers to start. Defaults to 1 per CPU.', parseInt)
    .option('-p, --port <port>', 'What port to use ?', parseInt)
    .parse(process.argv);

if (!program.port || program.port < 20 || program.port > 65535) {
    program.port = process.env.PORT || 3000;
}

if (cluster.isMaster) {
    // Fork workers.
    if (!program.children) {
        program.children = numCPUs;
    } else if (program.children < 1) {
        program.children = 1;
    }

    console.log("Starting %d children.", program.children);

    for (var i = 0; i < program.children; i++) {
        cluster.fork();
    }

    cluster.on('exit', function(worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died. Respawning...');
        cluster.fork();
    });
} else {
    var app = express();

    // all environments
    app.set('port', program.port);
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(app.router);

    // development only
    if ('development' == app.get('env')) {
        app.use(express.errorHandler());
    }

    var sizes = [
        { w: 10, h: 10 },
        { w: 100, h: 100 },
        { w: 500, h: 500 },
        { w: 1000, h: 1000 },
        { w: 2000, h: 2000 },
        { w: 3000, h: 3000 },
        { w: 5000, h: 5000 },
    ];

    var resizeIterator = function (item, callback) {
        resize(item.original, item.size.w, item.size.h, {}, function(err, buf){
            if (err) {
                callback(err);
                return;
            }
            //fs.writeFile(item.output, buf, callback);
            callback(err);
        });
    }

    app.get('/', function (req, res, next) {
        var filename = '/home/catalin/Pictures/ghost-recon-future-soldier-middle-finger-1920x1080.jpg';
        var pic = fs.readFile(filename, function (err, data) {
            if (err) {
                next(err);
                return;
            }

            var collection = [];
            var response = [];
            _(sizes).each(function (size) {
                var item = { "size": size };
                item.original = data;
                item.output = path.join(__dirname, 'output') + '/' + path.basename(filename) + '-' + size.w + 'x' + size.h + '.png';
                collection.push(item);
                response.push({ "size": size, "output": item.output });
            });

            async.each(collection, resizeIterator, function (err) {
                if (err) {
                    next(err);
                    return;
                }

                res.end(JSON.stringify(response));
            });
        });
    });

    http.createServer(app).listen(app.get('port'), function() {
        console.log('pizokel-resizer PID %d listening on port %d.', process.pid, app.get('port'));
    });
}
