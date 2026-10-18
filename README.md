# FKMTime

## What is FKMTime?

FKMTime is a system for running speedcubing competitions without scorecards! 

Documentation is available [here](https://fkmtime.github.io/docs).

## Important information

**FKMTime is currently in the testing phase. For now, in accordance with WCA regulations, scorecards are still used in parallel with the system.**

## Running bundled (with nginx reverse proxy etc - like prod) version
This version can be accessed remotely if `TOKEN` env var is passed to docker-compose (modify docker-compose-bundled.yml file to set your own token)
To get token use `https://panel.fkmtime.com`

```bash
docker compose -f ./docker-compose-bundled.yml pull && docker compose -f ./docker-compose-bundled.yml up
```

## Bluetooth auto setup on macOS (development)

The micro connector uses Linux D-Bus for Bluetooth, which containers on macOS
cannot reach. Run [docker-adapter](https://github.com/filipton/docker-adapter)
natively instead; the connector finds it at `host.docker.internal:3127`.

```bash
./scripts/docker-adapter.sh
```

The script downloads the adapter on first run. Keep it running, and allow
Bluetooth for your terminal in **System Settings → Privacy & Security →
Bluetooth**.

Start the adapter **before** `docker compose up`: the connector looks for it
only at startup. If the stack is already running, restart the connector with
`docker compose restart micro_connector`.
