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
