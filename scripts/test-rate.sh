#!/bin/bash
xargs -I % -P 8 curl -X 'POST' 'http://localhost:3334/authentications/guestLogin' -H 'accept: application/json' -H 'Accept-Version: 1.0' -H 'Accept-Language: th' -H 'api-metadata: ip=49.49.49.1,src=iOS,dest=castcle-authentications' -H 'Platform: th' -H 'Device: sompop' -H 'Content-Type: application/json' -d '{"deviceUUID": "sompop12345"}' \
< <(printf '%s\n' {1..400})