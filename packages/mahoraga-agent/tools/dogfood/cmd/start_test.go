package cmd

import (
	"reflect"
	"strings"
	"testing"

	"mahoraga-dogfood/config"
)

func TestServerCommandDoesNotWatchFiles(t *testing.T) {
	got := serverCommand("/tmp/server-config.json")
	want := []string{"bun", "--env-file=../../.env.development", "src/index.ts", "--config", "/tmp/server-config.json"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("server command got %#v want %#v", got, want)
	}
}

func TestClawCommandsUseStandaloneWXTAndServer(t *testing.T) {
	app := clawAppCommand()
	wantApp := []string{"bun", "--env-file=../../.env.development", "wxt"}
	if !reflect.DeepEqual(app, wantApp) {
		t.Fatalf("claw app command got %#v want %#v", app, wantApp)
	}

	server := clawServerCommand("/tmp/claw-server.json")
	wantServer := []string{"bun", "--watch", "--env-file=../../.env.development", "src/main.ts", "--config", "/tmp/claw-server.json"}
	if !reflect.DeepEqual(server, wantServer) {
		t.Fatalf("claw server command got %#v want %#v", server, wantServer)
	}
}

func TestReportProgressInvokesConfiguredProgress(t *testing.T) {
	var got []string
	reportProgress(environmentOptions{
		Progress: func(message string) {
			got = append(got, message)
		},
	}, "checking repo")

	want := []string{"checking repo"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("progress got %#v want %#v", got, want)
	}
}

func TestClawRuntimeEnvWiresBrowserAndAPISettings(t *testing.T) {
	got := clawRuntimeEnv([]string{
		"PATH=/bin",
		"MAHORAGA_DIR=/wrong-mahoraga",
		"BROWSERCLAW_DIR=/wrong",
		"MAHORAGA_CLAW_CDP_PORT=1",
		"VITE_MAHORAGA_CLAW_API_URL=http://wrong",
	}, config.Config{
		MahoragaAppPath: config.DefaultBrowserClawAppPath,
		DevUserDataDir:   "/tmp/claw-profile",
		MahoragaDir:     "/tmp/claw-state",
		Ports:            config.Ports{CDP: 49337, Server: 9200},
	})

	assertEnvContains(t, got, "PATH=/bin")
	assertEnvContains(t, got, "NODE_ENV=development")
	assertEnvContains(t, got, "BROWSERCLAW_DIR=/tmp/claw-state")
	assertEnvMissingPrefix(t, got, "MAHORAGA_DIR=")
	assertEnvContains(t, got, "MAHORAGA_BINARY=/Applications/BrowserClaw.app/Contents/MacOS/BrowserClaw")
	assertEnvContains(t, got, "MAHORAGA_USER_DATA_DIR=/tmp/claw-profile")
	assertEnvContains(t, got, "MAHORAGA_CLAW_CDP_PORT=49337")
	assertEnvContains(t, got, "MAHORAGA_SERVER_PORT=9200")
	assertEnvContains(t, got, "VITE_MAHORAGA_CLAW_API_URL=http://127.0.0.1:9200")
	if strings.Contains(strings.Join(got, "\n"), "http://wrong") {
		t.Fatalf("inherited claw API URL was not overridden: %#v", got)
	}
}

func TestFormatPortsForClawOmitsExtensionPort(t *testing.T) {
	got := formatPortsForTarget(config.Config{
		Target: config.TargetClaw,
		Ports:  config.Ports{CDP: 49337, Server: 9200, Extension: 9315},
	})
	if got != "CDP=49337 API=9200" {
		t.Fatalf("got %q", got)
	}
}

func TestServerRuntimeEnvSetsMahoragaDir(t *testing.T) {
	got := serverRuntimeEnv([]string{"PATH=/bin"}, config.Config{
		MahoragaDir: "/tmp/mahoraga-dogfood",
		Ports:        config.Ports{CDP: 9015, Server: 9115, Extension: 9315},
	})

	assertEnvContains(t, got, "MAHORAGA_DIR=/tmp/mahoraga-dogfood")
	assertEnvMissingPrefix(t, got, "MAHORAGA_CDP_PORT=")
	assertEnvMissingPrefix(t, got, "MAHORAGA_SERVER_PORT=")
	assertEnvMissingPrefix(t, got, "MAHORAGA_EXTENSION_PORT=")
}

func TestServerRuntimeEnvOverridesInheritedMahoragaDir(t *testing.T) {
	got := serverRuntimeEnv([]string{
		"MAHORAGA_DIR=/tmp/wrong",
		"PATH=/bin",
	}, config.Config{
		MahoragaDir: "/tmp/mahoraga-dogfood",
		Ports:        config.Ports{CDP: 9015, Server: 9115, Extension: 9315},
	})

	if strings.Contains(strings.Join(got, "\n"), "MAHORAGA_DIR=/tmp/wrong") {
		t.Fatalf("inherited Mahoraga dir was not overridden: %#v", got)
	}
	assertEnvContains(t, got, "MAHORAGA_DIR=/tmp/mahoraga-dogfood")
}

func TestResolveConfiguredBrowserAppUsesClawDefaultAtStart(t *testing.T) {
	cfg := config.Config{
		Target:           config.TargetClaw,
		MahoragaAppPath: config.DefaultMahoragaAppPath,
	}

	resolution := resolveConfiguredBrowserApp(&cfg, func(path string) bool {
		return path == config.DefaultBrowserClawAppPath
	})

	if cfg.MahoragaAppPath != config.DefaultBrowserClawAppPath {
		t.Fatalf("resolved app path got %q", cfg.MahoragaAppPath)
	}
	if resolution.Fallback {
		t.Fatalf("did not expect fallback: %#v", resolution)
	}
}

func TestResolveConfiguredBrowserAppFallsBackWhenCustomPathIsMissing(t *testing.T) {
	cfg := config.Config{
		Target:           config.TargetClaw,
		MahoragaAppPath: "/missing/custom-browser",
	}

	resolution := resolveConfiguredBrowserApp(&cfg, func(path string) bool {
		return path == config.DefaultBrowserClawAppPath
	})

	if cfg.MahoragaAppPath != config.DefaultBrowserClawAppPath {
		t.Fatalf("resolved app path got %q", cfg.MahoragaAppPath)
	}
	if !resolution.Fallback || resolution.MissingPath != "/missing/custom-browser" {
		t.Fatalf("unexpected fallback resolution: %#v", resolution)
	}
}

func assertEnvContains(t *testing.T, env []string, want string) {
	t.Helper()
	for _, entry := range env {
		if entry == want {
			return
		}
	}
	t.Fatalf("env missing %q: %#v", want, env)
}

func assertEnvMissingPrefix(t *testing.T, env []string, prefix string) {
	t.Helper()
	for _, entry := range env {
		if strings.HasPrefix(entry, prefix) {
			t.Fatalf("env unexpectedly contains %q: %#v", prefix, env)
		}
	}
}
