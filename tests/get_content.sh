#!/bin/sh

if [ $# -ne 1 ]; then
    echo "Port number not specified, using port 3001..." 
    HTTP_PORT=3001
else
    HTTP_PORT=$1
fi

curl -X GET http://localhost:$HTTP_PORT/content
echo ""
