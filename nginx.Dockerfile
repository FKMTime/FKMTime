## BUILD FRONTEND ##
# the build output is static files, the same for every platform, so it runs once on the
# builder's own platform instead of under emulation for each target
FROM --platform=$BUILDPLATFORM node:lts AS frontend-app-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
COPY .git .git

# Add commit hash to the build
RUN git rev-parse --short HEAD > .commit

RUN VITE_DOCKERBUILD=true VITE_GIT_COMMIT=$(cat .commit) npm run build
## END BUILD ##

## NGINX ##
FROM ghcr.io/fkmtime/fkmtime-proxied-nginx:master

COPY --from=frontend-app-builder /app/dist /frontend
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx/env.sh /env.sh

ENTRYPOINT ["/env.sh"]
