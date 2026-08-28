#!/bin/sh

# Copy and process core configuration
envsubst "$(env | sed -e 's/=.*//' -e 's/^/\$/g' | tr '\n' ' ')" < /etc/nginx/templates/conf.d/01-core.conf.template > /etc/nginx/conf.d/01-core.conf

# Copy and process frontend configuration (Next.js dev proxy)
envsubst "$(env | sed -e 's/=.*//' -e 's/^/\$/g' | tr '\n' ' ')" < /etc/nginx/templates/conf.d/02-frontend.conf.template > /etc/nginx/conf.d/02-frontend.conf

# Start nginx
exec nginx -g 'daemon off;'