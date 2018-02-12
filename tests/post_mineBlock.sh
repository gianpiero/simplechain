#!/bin/sh

[ $# -ne 2 ] && echo "Usage: $0 <httpPort> <payload>" && exit 1


curl -X POST -H "Content-type: application/json" --data "{\"data\":\"$2\"}" http://localhost:$1/mineBlock
echo ""
