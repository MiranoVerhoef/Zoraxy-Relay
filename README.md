# Zoraxy Relay

Self-hosted reverse relay for Zoraxy with automated routing, redundant connectors, service health monitoring, activity history, and TLS controls.

> **v2 identity migration:** the canonical plugin ID is now `com.miranoverhoef.zoraxy-relay`, release binaries use `zoraxy-relay*`, the Docker image is `ghcr.io/miranoverhoef/zoraxy-relay-client`, and new Compose files use `ZORAXY_RELAY_*`. The v2 client still accepts the legacy `ZORAXY_TUNNEL_*` variables and releases temporarily mirror the old Docker image so existing v1 connectors can migrate without losing connectivity.

## Highlights

- Multiple connectors per logical tunnel with active/standby redundancy.
- Preferred connector selection with automatic failover and failback.
- Per-connector telemetry and service health checks.
- Persistent activity history.
- Zoraxy route automation and optional ACME certificate requests.
- Stable Docker client configuration using `ghcr.io/miranoverhoef/zoraxy-relay-client:latest`.
- Non-destructive connector enrollment: adding a connector does not rotate credentials already in use.
- Optional automatic Docker client updates via a dedicated What's Up Docker (WUD) updater sidecar.
- Authenticated dashboard **Update now** control for Automatic Docker connectors.
- Guided first-run setup with connection verification and optional redundant connector enrollment.

## Guided setup

Fresh plugin installs open a guided setup wizard that walks through the Control Node address, first tunnel creation, client installation and connection verification. Installation commands are collapsed by default instead of filling the screen with Compose text.

After a connector credential is created, the wizard checks the live connector telemetry every two seconds. **Continue** becomes available when the expected connector ID is actually online. You can choose **Setup later** at any point, rerun the wizard from Settings, and add another connector for redundancy before finishing.

The same connection-aware setup is used after normal **Create tunnel** and **Add connector** actions.

## Upgrading from v1.x

The community index contains a legacy migration entry for `com.miranoverhoef.zoraxy-tunnel`. Zoraxy can update an existing v1.x installation in place; the v2 binary then reports the new `com.miranoverhoef.zoraxy-relay` ID while keeping the same plugin working directory and data files. Existing certificates, tunnel credentials, services, setup state, and activity history therefore remain in place.

Existing Docker connectors using `ghcr.io/miranoverhoef/zoraxy-tunnel-client:latest` can receive v2 through the temporary legacy image mirror. Regenerate the connector Compose configuration when convenient to move to the canonical `ghcr.io/miranoverhoef/zoraxy-relay-client:latest` image and `ZORAXY_RELAY_*` variables.

## Connector enrollment

Create a tunnel once, then add as many connectors as you need. Each additional connector can have its own one-time credential, so existing connectors remain online when another host is added.

The dashboard offers two Docker setup modes both when creating the first tunnel and when adding another connector.

### Automatic updates

The generated Compose stack includes a WUD updater sidecar. WUD watches the tunnel client's mutable `:latest` image by digest and recreates that client when a new image is available.

WUD 9.x requires authentication. Zoraxy Relay therefore generates a random updater administrator password for each new Automatic setup and places the matching credentials in both services. The tunnel client reports those credentials only over the existing TLS-protected control connection so the dashboard can authenticate its **Update now** requests. The plugin keeps the credentials in memory only and does not expose them through telemetry or its API.

Only the updater sidecar receives the Docker socket:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

> Docker socket access is highly privileged and can effectively control the Docker host. Use this mode only on hosts where that access is acceptable.

Automatic connectors created before v1.12.0 should be redeployed once with the current generated Compose configuration so WUD receives the required administrator credentials and dashboard update control becomes available.

### Manual updates

No Docker socket is mounted. The connector continues to use `:latest`, but you decide when it is recreated:

```bash
docker compose pull
docker compose up -d
```

Tunnel credentials remain unchanged during normal client or plugin upgrades.

## Build

Requirements: Go 1.23+

```bash
go build -o zoraxy-relay .
go build -o zoraxy-relay-client ./client
```

## Zoraxy plugin installation

Zoraxy 3.2.0+ is recommended. Add this repository's plugin index as a community source:

```text
https://raw.githubusercontent.com/MiranoVerhoef/Zoraxy-Relay/refs/heads/main/directories/index2.json
```

The plugin store handles the correct binary for the Zoraxy host platform.

## Client

The dashboard generates the correct command after a tunnel or connector credential is created. A client uses:

```text
--server HOST[:9443]
--token TOKEN
--fingerprint SHA256_FINGERPRINT
--connector-id UNIQUE_CONNECTOR_ID
```

Use a different stable connector ID for each redundant host.

## Development workflow

CI runs on pull requests and on `main`. Intermediate commits on `release/**` branches do not run automatically, which prevents expected release-assembly states such as temporarily mismatched version metadata from creating misleading failed checks. Open a pull request when a release branch is ready; the full Go, JavaScript, build, and store-metadata validation runs there before release.

## License

This project remains licensed under the repository's existing MIT license and is based on the original `sniffingsugar/zoraxy-tunnel` project.
