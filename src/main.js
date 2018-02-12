#!/usr/bin/env node
/*
 * (c) 2005-2018  Copyright, Real-Time Innovations, Inc. All rights reserved.
 * Subject to Eclipse Public License v1.0; see LICENSE.md for details.
 */

// ***************************************************************************
// External Modules
// ***************************************************************************
var mod_simplechain = require('./simplechain');
var mod_p2p = require('./p2p');
var mod_bodyParser = require('body-parser');
var mod_express = require('express');

// ***************************************************************************
// Globals & Constants
// ***************************************************************************
var Block = mod_simplechain.Block;
var Blockchain = mod_simplechain.Blockchain;
var P2P = mod_p2p.P2P;

const DEFAULT_HTTP_PORT = 3001;




// ***************************************************************************
// Local Functions
// ***************************************************************************
function usage() {
    console.log("Usage: %s [arguments]", process.argv[1]);
    console.log("Where arguments are:");
    console.log("  -h, --help          Show this page");
    console.log("  -v, --verbose       Increase log verbosity");
    console.log("  -p, --port <port>   Listen port for HTTP Server [%d]", DEFAULT_HTTP_PORT);
}


// ***************************************************************************
// Main starts here
// ***************************************************************************
var httpPort = DEFAULT_HTTP_PORT;
var verbose  = false;

for (let i = 2; i < process.argv.length; ++i) {
    if ((process.argv[i] == "-h") || (process.argv[i] == "--help")) {
        usage();
        process.exit(1);
    }
    if ((process.argv[i] == "-v") || (process.argv[i] == "--verbose")) {
        verbose = true;
        continue;
    }
    if ((process.argv[i] == "-p") || (process.argv[i] == "--port")) {
        if (i+1 >= process.argv.length) {
            console.log("Error: missing argv for '--port' argument");
            process.exit(1);
        }
        httpPort = Number.parseInt(process.argv[++i]);
        continue;
    }
    console.log("Error: unknown argument '%s'", process.argv[i]);
    process.exit(1);
}

var blockchain = new Blockchain();
var p2p = new P2P(blockchain);

// Initialize express
var app = mod_express();
app.use(mod_bodyParser.json());
app.get('/blocks', function (req, res) {
    res.send(blockchain.getBlockchain());
});
app.post('/mineBlock', function (req, res) {
    var newBlock = blockchain.generateNextBlock(req.body.data);
    res.send(newBlock);
});
app.listen(httpPort, function () {
    if (verbose) console.log('Server started, listening http on port: ' + httpPort);
});

