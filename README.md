# Zoraxy Relay

Self-hosted reverse relay for Zoraxy with automated routing, redundant connectors, service health monitoring, activity history, and TLS controls.

The plugin ID is `com.miranoverhoef.zoraxy-relay`, release binaries use `zoraxy-relay_*` and `zoraxy-relay-client_*`, and the connector image is `ghcr.io/miranoverhoef/zoraxy-relay-client`. Connector updater settings use `ZORAXY_RELAY_UPDATE_MODE`, `ZORAXY_RELAY_UPDATER_USER`, and `ZORAXY_RELAY_UPDATER_PASSWORD`.

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

## Installation data

Install Zoraxy Relay as a fresh plugin and use the dashboard's generated connector configuration. The earlier v1 versions were private test installations; v2 does not import their data or support their old identifiers. Zoraxy starts the plugin in its installation directory, which holds `config.json`, `cert.pem`, `key.pem`, `setup-state.json`, and `events.json`. Back up these files to preserve Relay configuration, connector credentials, and TLS identity.

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

Zoraxy 3.3.3+ is required. This is the first stable release with `/api/proxy/setTags`; its plugin API permissions, proxy list/add/delete, and ACME endpoints also support Relay's calls. See [Zoraxy v3.3.3 API registration](https://github.com/tobychui/zoraxy/blob/v3.3.3/src/api.go) and [plugin startup configuration](https://github.com/tobychui/zoraxy/blob/v3.3.3/src/mod/plugins/lifecycle.go). Add this repository's plugin index as a community source:

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

### Beta testing

Beta builds live on the `beta` branch. Changing its `.introspect` version starts **Beta release**, which runs the full tests and all-platform validation before publishing. Intermediate UI commits do not publish another release. Add this separate community source to a test Zoraxy host:

```text
https://raw.githubusercontent.com/MiranoVerhoef/Zoraxy-Relay/refs/heads/beta/directories/index-beta.json
```

The beta index pins downloads to a prerelease tag, never `releases/latest`. Beta connectors use `ghcr.io/miranoverhoef/zoraxy-relay-client:beta`. Publishing a beta does not update the stable index, stable GitHub release, or Docker `:latest` tag.

The beta uses the same plugin ID as stable, so it updates the existing installation in place and keeps configuration and TLS identity. It is an alternate channel for one installation. Back up the plugin's persistent files before testing. Remove the beta source when returning to stable.

Zoraxy compares only numeric major/minor/patch fields. Each published beta therefore advances the numeric version and uses a tag such as `v2.0.1-beta.1`; the next beta might be `v2.0.2-beta.1`. The eventual stable version must be higher than the tested numeric version for store updates to work. To return to an older stable release, stop the plugin and manually replace only its executable with the stable binary, preserving its persistent files.

For promotion after test approval: prepare a release branch/PR to main with a higher numeric version, remove `.release-channel`, remove the beta suffix from plugin/client versions, restore `.releaseurl` to `releases/latest/download`, set `CLIENT_IMAGE_TAG` to `latest`, and update the stable `directories/index2.json`. Keep the beta index pinned to its last successful beta. Stable publishing remains gated by PR CI and merge.

CI runs on pull requests and on `main`. Intermediate commits on `release/**` branches do not run automatically, which prevents expected release-assembly states such as temporarily mismatched version metadata from creating misleading failed checks. Open a pull request when a release branch is ready; the full Go, JavaScript, build, and store-metadata validation runs there before release.

## License

This project remains licensed under the repository's existing MIT license and is based on the original `sniffingsugar/zoraxy-tunnel` project.
