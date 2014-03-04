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

    var sizes = [
        { w: 70, h: 102, name: "thumb" },                // THUMB
        { w: null, h: 1132, name: "zoom" },              // ZOOM
        { w: 390, h: 566, name: "detail" },              // DETAIL
        { w: 310, h: 450, name: "listing" },             // LISTING
        { w: 160, h: 232, name: "iphone-listing" },      // IPHONE PRODUCT LISTING
        { w: 215, h: 312, name: "iphone-detail" },       // IPHONE PRODUCT DETAIL
        { w: 390, h: 566, name: "iphone-zoom" },         // IPHONE PRODUCT ZOOM
        { w: 60, h: 88, name: "iphone-thumb" },          // IPHONE PRODUCT THUMB
        { w: 319, h: 463, name: "iphone-rt-listing" },   // IPHONE RETINA PRODUCT LISTING
        { w: 4360, h: 624, name: "iphone-rt-detail" },   // IPHONE RETINA PRODUCT DETAIL
        { w: 780, h: 1132, name: "iphone-rt-zoom" },     // IPHONE RETINA PRODUCT ZOOM
        { w: 120, h: 175, name: "iphone-rt-thumb" },     // IPHONE RETINA PRODUCT THUMB
        { w: 2000, h: 2000, name: "test-2k" },           // TEST 2k x 2k
        { w: 4000, h: 4000, name: "test-4k" },           // TEST 4k x 4k
    ];

    var resizeIterator = function (item, callback) {
        resize(item.original, item.size.w, item.size.h, {}, function(err, buf){
            if (err) {
                callback(err);
                return;
            }
            fs.writeFile(item.output, buf, callback);
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
                item.output = path.join(__dirname, 'output') + '/' + path.basename(filename) + '-' + size.name + '.png';
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
