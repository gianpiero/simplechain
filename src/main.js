#!/usr/bin/env node
/*
 * (c) 2005-2018  Copyright, Real-Time Innovations, Inc. All rights reserved.
 * Subject to Eclipse Public License v1.0; see LICENSE.md for details.
 */

"use strict";

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
const DEFAULT_XML_FILE          = "SimpleChain.xml";
const DEFAULT_PARTICIPANT_NAME  = "MyParticipantLibrary::Simplechain";
const DEFAULT_DATA_READER_NAME  = "MySubscriber::SimplechainReader";
const DEFAULT_DATA_WRITER_NAME  = "MyPublisher::SimplechainWriter";




// ***************************************************************************
// Local Functions
// ***************************************************************************
function usage() {
    console.log("Usage: %s [arguments]", process.argv[1]);
    console.log("Where arguments are:");
    console.log("  -h, --help          Show this page");
    console.log("  -v, --verbose       Increase log verbosity");
    console.log("  -p, --port <port>   Listen port for HTTP Server [%d]", DEFAULT_HTTP_PORT);
    console.log("  --xml <file>        XML ConnextDDS AppCreation file to use [%s]", DEFAULT_XML_FILE);
    console.log("  --part <name>       ConnextDDS Participant to use [%s]", DEFAULT_PARTICIPANT_NAME);
    console.log("  --datareader <name> ConnextDDS Data Reader to use [%s]", DEFAULT_DATA_READER_NAME);
    console.log("  --datawriter <name> ConnextDDS Data Writer to use [%s]", DEFAULT_DATA_WRITER_NAME);
}


// ***************************************************************************
// Main starts here
// ***************************************************************************
var httpPort = DEFAULT_HTTP_PORT;
var verbose  = false;
var xmlFile = DEFAULT_XML_FILE;
var partName = DEFAULT_PARTICIPANT_NAME;
var drName = DEFAULT_DATA_READER_NAME;
var dwName = DEFAULT_DATA_WRITER_NAME;

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
    if ((process.argv[i] == "--xml")) {
        if (i+1 >= process.argv.length) {
            console.log("Error: missing argv for '--xml' argument");
            process.exit(1);
        }
        xmlFile = process.argv[++i];
        continue;
    }
    if ((process.argv[i] == "--part")) {
        if (i+1 >= process.argv.length) {
            console.log("Error: missing argv for '--part' argument");
            process.exit(1);
        }
        partName = process.argv[++i];
        continue;
    }
    if ((process.argv[i] == "--datareader")) {
        if (i+1 >= process.argv.length) {
            console.log("Error: missing argv for '--datareader' argument");
            process.exit(1);
        }
        drName = process.argv[++i];
        continue;
    }
    if ((process.argv[i] == "--datawriter")) {
        if (i+1 >= process.argv.length) {
            console.log("Error: missing argv for '--datawriter' argument");
            process.exit(1);
        }
        dwName = process.argv[++i];
        continue;
    }
    console.log("Error: unknown argument '%s'", process.argv[i]);
    process.exit(1);
}

var blockchain = new Blockchain();
var p2p = new P2P(blockchain, verbose, xmlFile, partName, drName, dwName);

// Initialize express
var app = mod_express();
app.use(mod_bodyParser.json());
app.get('/blocks', function (req, res) {
    if (verbose) {
        console.log("[main]: Processing request: GET /blocks");
    }
    res.send(blockchain.toString());
});
app.get('/content', function (req, res) {
    if (verbose) {
        console.log("[main]: Processing request: GET /content");
    }
    res.send(blockchain.toContentString());
});
app.post('/mineBlock', function (req, res) {
    if (verbose) {
        console.log("[main]: Processing request: POST /mineBlock");
    }
    var newBlock = blockchain.generateNextBlock(req.body.data);
    p2p.broadcastLatest();
    res.send(newBlock);
});
app.listen(httpPort, function () {
    if (verbose) console.log('[main]: Server started, listening http on port: ' + httpPort);
});

