package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	zp "github.com/MiranoVerhoef/Zoraxy-Relay/zoraxy_plugin"
)

//go:embed web/* icon.png
var webFS embed.FS

const (
	controlPort = 9443
	ingressPort = 9080
)

const (
	verMajor = 2
	verMinor = 0
	verPatch = 1
)

var pluginVersion = fmt.Sprintf("v%d.%d.%d-beta.1", verMajor, verMinor, verPatch)

var pluginSpec = &zp.IntroSpect{
	ID:            "com.miranoverhoef.zoraxy-relay",
	Name:          "Zoraxy Relay",
	Author:        "Mirano Verhoef",
	AuthorContact: "https://github.com/MiranoVerhoef",
	Description:   "Secure self-hosted relay for Zoraxy with automated routing, redundant connectors, service health monitoring, and TLS controls.",
	URL:           "https://github.com/MiranoVerhoef/Zoraxy-Relay",
	Type:          zp.PluginType_Utilities,
	VersionMajor:  verMajor,
	VersionMinor:  verMinor,
	VersionPatch:  verPatch,
	UIPath:        "/ui",
	PermittedAPIEndpoints: []zp.PermittedAPIEndpoint{
		{Method: "GET", Endpoint: "/api/proxy/list", Reason: "Check installed routes"},
		{Method: "POST", Endpoint: "/api/proxy/add", Reason: "Install a service route"},
		{Method: "POST", Endpoint: "/api/proxy/del", Reason: "Remove a service route"},
		{Method: "POST", Endpoint: "/api/proxy/setTags", Reason: "Assign tags to installed tunnel routes"},
		{Method: "GET", Endpoint: "/api/acme/autoRenew/email", Reason: "Read the ACME email configured in Zoraxy"},
		{Method: "GET", Endpoint: "/api/acme/autoRenew/ca", Reason: "Read the user's preferred ACME CA"},
		{Method: "GET", Endpoint: "/api/acme/obtainCert", Reason: "Issue an SSL certificate for an installed route"},
	},
}

func main() {
	config, err := zp.ServeAndRecvSpec(pluginSpec)
	if err != nil {
		log.Println("[relay] dev mode (no -configure flag)")
		config = &zp.ConfigureSpec{Port: 9699}
	}
	zPort := config.ZoraxyPort
	if zPort == 0 {
		zPort = 8000
	}
	uiPort := config.Port
	pluginDir := workingDir()
	log.Printf("[relay] data dir: %s", pluginDir)
	appEvents.setPath(filepath.Join(pluginDir, "events.json"))
	appSetup = newSetupStateStore(pluginDir)
	if err := appSetup.load(); err != nil {
		log.Printf("[relay] setup state load: %v", err)
	}

	if icon, err := webFS.ReadFile("icon.png"); err == nil {
		iconPath := filepath.Join(filepath.Dir(exePath()), "icon.png")
		if err := os.WriteFile(iconPath, icon, 0644); err != nil {
			log.Printf("[relay] icon write: %v", err)
		}
	}
	certs := newCertManager(pluginDir)
	if err := certs.LoadOrCreate(); err != nil {
		log.Fatalf("[relay] cert: %v", err)
	}
	log.Printf("[relay] cert fingerprint: %s", certs.Fingerprint())
	store := newStore(pluginDir)
	if err := store.Load(); err != nil {
		log.Printf("[relay] config load: %v", err)
	}
	registry := newSessionRegistry()
	appHealth = newHealthManager(store, registry)
	appHealth.start()

	api := &apiServer{store: store, registry: registry, certs: certs, zPort: zPort, apiKey: config.APIKey, ingressPort: ingressPort, controlPort: controlPort, uiPort: uiPort, version: pluginVersion}
	mux := http.NewServeMux()
	mux.HandleFunc("/ui/api/status", api.handleStatus)
	mux.HandleFunc("/ui/api/settings", api.handleSettings)
	mux.HandleFunc("/ui/api/setup-state", api.handleSetupState)
	mux.HandleFunc("/ui/api/tunnels", api.handleTunnels)
	mux.HandleFunc("/ui/api/tunnels/action", api.handleTunnelAction)
	mux.HandleFunc("/ui/api/services/action", api.handleServiceAction)
	mux.HandleFunc("/ui/api/client-stats", api.handleClientStats)
	mux.HandleFunc("/ui/api/connectors/preferred", api.handlePreferredConnector)
	mux.HandleFunc("/ui/api/connectors/add", api.handleAddConnector)
	mux.HandleFunc("/ui/api/connectors/update", api.handleConnectorUpdate)
	mux.HandleFunc("/ui/api/health", api.handleHealth)
	mux.HandleFunc("/ui/api/events", api.handleEvents)
	ui := zp.NewPluginEmbedUIRouter(pluginSpec.ID, &webFS, "web", "/ui")
	ui.AttachHandlerToMux(mux)
	ui.RegisterTerminateHandler(func() { log.Println("[relay] bye") }, mux)
	control := newControlServer(certs.TLSConfig(), store, registry)
	go func() {
		if err := control.listenAndServe(fmt.Sprintf("0.0.0.0:%d", controlPort)); err != nil {
			log.Printf("[relay] control: %v", err)
		}
	}()
	ingress := newIngressServer(store, registry)
	go func() {
		if err := ingress.listenAndServe(fmt.Sprintf("127.0.0.1:%d", ingressPort)); err != nil {
			log.Printf("[relay] ingress: %v", err)
		}
	}()
	appEvents.add("info", "plugin.start", "", "", "", "Zoraxy Relay "+pluginVersion+" started")
	log.Printf("[relay] ui :%d  ingress :%d  control :%d", uiPort, ingressPort, controlPort)
	log.Fatalf("[relay] %v", http.ListenAndServe(fmt.Sprintf("127.0.0.1:%d", uiPort), mux))
}

func exePath() string {
	if exe, err := os.Executable(); err == nil {
		if resolved, err := filepath.EvalSymlinks(exe); err == nil {
			return resolved
		}
		return exe
	}
	return "."
}

func workingDir() string {
	if wd, err := os.Getwd(); err == nil {
		return wd
	}
	return filepath.Dir(exePath())
}
