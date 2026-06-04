#!/bin/sh

# Copy and process core configuration
envsubst "$(env | sed -e 's/=.*//' -e 's/^/\$/g' | tr '\n' ' ')" < /etc/nginx/templates/conf.d/01-core.conf.template > /etc/nginx/conf.d/01-core.conf

# Only copy and process frontend configuration if ENABLE_FRONTEND is true
if [ "${ENABLE_FRONTEND}" = "true" ]; then
    envsubst "$(env | sed -e 's/=.*//' -e 's/^/\$/g' | tr '\n' ' ')" < /etc/nginx/templates/conf.d/02-frontend.conf.template > /etc/nginx/conf.d/02-frontend.conf
fi

# Start nginx
exec nginx -g 'daemon off;'