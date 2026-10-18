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

Run [docker-adapter](https://github.com/filipton/docker-adapter) natively on
macOS so the containerized micro connector can use the Mac's Bluetooth and
advertise mDNS services. The default Compose configuration uses Linux D-Bus;
it does not provide access to the Mac's Bluetooth controller.

With a current Rust toolchain installed, run these commands in Terminal:

```bash
git clone https://github.com/filipton/docker-adapter.git
cd docker-adapter
cargo run --release --locked
```

Keep the adapter running. Allow Bluetooth access for the terminal application
in **System Settings → Privacy & Security → Bluetooth**. The adapter listens
on port `3127` by default. Check both HTTP connectivity and Bluetooth scanning
from another terminal:

```bash
curl --fail http://localhost:3127/
curl --fail http://localhost:3127/ble \
  -H 'Content-Type: application/json' \
  -d '{"scan_timeout_ms":5000}'
```

The first request should return `OK`; the second should return a JSON array
of nearby BLE devices. An empty array means no devices were discovered.
FKM devices ready for setup should advertise names starting with `FKM-`.

From the FKMTime checkout running your development stack, use the macOS
override (Docker Compose 2.24.4 or newer):

```bash
docker compose -f docker-compose.yml -f docker-compose.macos.yml pull micro_connector
docker compose -f docker-compose.yml -f docker-compose.macos.yml up -d micro_connector
```

The override publishes the connector on port `8080`, removes the Linux D-Bus
mount, and sets `ADAPTER_API=http://host.docker.internal:3127`. It also removes
the Linux `host-gateway` override and custom DNS servers so Docker Desktop or
Colima can resolve the Mac's host address.

Start the adapter **before** the connector. The connector chooses its Bluetooth
and mDNS implementation at startup; if it started without a reachable adapter,
restart it after starting the adapter:

```bash
docker compose -f docker-compose.yml -f docker-compose.macos.yml restart micro_connector
docker compose -f docker-compose.yml -f docker-compose.macos.yml logs --tail=100 micro_connector
```

In FKMTime's device settings, enter the devices' Wi-Fi credentials and configure
mDNS or a WebSocket URL reachable from their network, then open **Auto Setup
Devices**. A localhost URL is not reachable from the physical devices. Ensure
the Mac's firewall and container runtime allow incoming device connections on
port `8080`.
