#!/bin/sh
chown -R node:node /app/cache /app/config
exec su-exec node node server.js
