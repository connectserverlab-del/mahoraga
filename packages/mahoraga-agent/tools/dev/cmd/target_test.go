package cmd

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveDevTargetReadsDevelopmentEnvPorts(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env.development"), []byte(
		"MAHORAGA_CDP_PORT=9101\nMAHORAGA_SERVER_PORT=9201\nMAHORAGA_EXTENSION_PORT=9301\n",
	), 0o644); err != nil {
		t.Fatal(err)
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("MAHORAGA_DIR", "")

	target, err := resolveResetTarget(root, resetTargetOptions{Target: "dev"})
	if err != nil {
		t.Fatal(err)
	}

	if target.Ports == nil || target.Ports.CDP != 9101 || target.Ports.Server != 9201 || target.Ports.Extension != 9301 {
		t.Fatalf("unexpected ports: %#v", target.Ports)
	}
	if target.MahoragaDir != filepath.Join(home, ".mahoraga-dev") {
		t.Fatalf("unexpected mahoraga dir: %s", target.MahoragaDir)
	}
	if len(target.BrowserUserDataDirs) != 2 {
		t.Fatalf("unexpected browser user data dirs: %#v", target.BrowserUserDataDirs)
	}
}

func TestResolveDevTargetFallsBackToExampleEnvPorts(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env.development.example"), []byte(
		"MAHORAGA_CDP_PORT=9000\nMAHORAGA_SERVER_PORT=9100\nMAHORAGA_EXTENSION_PORT=9300\n",
	), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOME", t.TempDir())
	t.Setenv("MAHORAGA_DIR", "")

	target, err := resolveResetTarget(root, resetTargetOptions{Target: "dev"})
	if err != nil {
		t.Fatal(err)
	}

	if target.Ports == nil || target.Ports.CDP != 9000 || target.Ports.Server != 9100 || target.Ports.Extension != 9300 {
		t.Fatalf("unexpected ports: %#v", target.Ports)
	}
}

func TestReadPortsFromEnvFileStripsHashComments(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(
		"MAHORAGA_CDP_PORT=9005#comment\nMAHORAGA_SERVER_PORT=9105 # comment\nMAHORAGA_EXTENSION_PORT=9305\n",
	), 0o644); err != nil {
		t.Fatal(err)
	}

	ports, ok, err := readPortsFromEnvFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected ports to be found")
	}
	if ports.CDP != 9005 || ports.Server != 9105 || ports.Extension != 9305 {
		t.Fatalf("unexpected ports: %#v", ports)
	}
}

func TestResolveDogfoodTargetReadsDogfoodConfig(t *testing.T) {
	root := t.TempDir()
	xdgConfig := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)
	cfgDir := filepath.Join(xdgConfig, "mahoraga-dogfood")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfgDir, "config.yaml"), []byte(`
mahoraga_dir: /tmp/mahoraga-dogfood-state
dev_user_data_dir: /tmp/mahoraga-dogfood-profile
ports:
  cdp: 9015
  server: 9115
  extension: 9315
`), 0o644); err != nil {
		t.Fatal(err)
	}

	target, err := resolveResetTarget(root, resetTargetOptions{Target: "dogfood"})
	if err != nil {
		t.Fatal(err)
	}

	if target.MahoragaDir != "/tmp/mahoraga-dogfood-state" {
		t.Fatalf("unexpected mahoraga dir: %s", target.MahoragaDir)
	}
	if target.Ports == nil || target.Ports.CDP != 9015 || target.Ports.Server != 9115 || target.Ports.Extension != 9315 {
		t.Fatalf("unexpected ports: %#v", target.Ports)
	}
	if len(target.BrowserUserDataDirs) != 1 || target.BrowserUserDataDirs[0] != "/tmp/mahoraga-dogfood-profile" {
		t.Fatalf("unexpected browser user data dirs: %#v", target.BrowserUserDataDirs)
	}
	if target.Dogfood == nil || target.Dogfood.StatePath != filepath.Join(cfgDir, "state.json") {
		t.Fatalf("unexpected dogfood runtime paths: %#v", target.Dogfood)
	}
}

func TestResolveDogfoodTargetAppliesDogfoodDefaults(t *testing.T) {
	root := t.TempDir()
	home := t.TempDir()
	xdgConfig := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", xdgConfig)
	cfgDir := filepath.Join(xdgConfig, "mahoraga-dogfood")
	if err := os.MkdirAll(cfgDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfgDir, "config.yaml"), []byte("{}\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	target, err := resolveResetTarget(root, resetTargetOptions{Target: "dogfood"})
	if err != nil {
		t.Fatal(err)
	}

	if target.MahoragaDir != filepath.Join(home, ".mahoraga-dogfood") {
		t.Fatalf("unexpected mahoraga dir: %s", target.MahoragaDir)
	}
	if target.Ports == nil || target.Ports.CDP != 9015 || target.Ports.Server != 9115 || target.Ports.Extension != 9315 {
		t.Fatalf("unexpected ports: %#v", target.Ports)
	}
	if len(target.BrowserUserDataDirs) != 1 || target.BrowserUserDataDirs[0] != filepath.Join(cfgDir, "profile") {
		t.Fatalf("unexpected browser user data dirs: %#v", target.BrowserUserDataDirs)
	}
}

func TestResolveProdTargetUsesMahoragaStateRoot(t *testing.T) {
	root := t.TempDir()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("MAHORAGA_DIR", "")

	target, err := resolveResetTarget(root, resetTargetOptions{Target: "prod"})
	if err != nil {
		t.Fatal(err)
	}

	if target.MahoragaDir != filepath.Join(home, ".mahoraga") {
		t.Fatalf("unexpected mahoraga dir: %s", target.MahoragaDir)
	}
	if target.Ports != nil {
		t.Fatalf("prod target should not clear ports by default: %#v", target.Ports)
	}
}
