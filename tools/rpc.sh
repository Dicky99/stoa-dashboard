#!/bin/bash
# usage: rpc.sh <method-json-params> ; reads RPC_URL env or defaults
RPC="${RPC:-https://rpc.mainnet.chain.robinhood.com}"
curl -s -m 30 -X POST "$RPC" \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' \
  -d "$1"
echo
