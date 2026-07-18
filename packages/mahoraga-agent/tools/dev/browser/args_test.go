package browser

import (
	"strings"
	"testing"

	"mahoraga-dev/proc"
)

func TestBuildArgsUsesDevDockIcon(t *testing.T) {
	args := BuildArgs(ArgsConfig{
		Root:              "/repo/packages/mahoraga-agent",
		Ports:             proc.Ports{CDP: 9005, Server: 9105, Extension: 9305},
		UserDataDir:       "/tmp/mahoraga-dev",
		LoadDevExtensions: true,
	})
	joined := strings.Join(args, "\n")
	if !strings.Contains(joined, "--mahoraga-dock-icon=dev") {
		t.Fatalf("missing dev dock icon arg in\n%s", joined)
	}
}

func TestBuildArgsUsesProductFlag(t *testing.T) {
	args := buildArgs(ArgsConfig{
		Root:              "/repo/packages/mahoraga-agent",
		Ports:             proc.Ports{CDP: 9005, Server: 9105, Extension: 9305},
		UserDataDir:       "/tmp/mahoraga-dev",
		LoadDevExtensions: true,
		Product:           ProductBrowserClaw,
	}, func(product string) BinaryResolution {
		return BinaryResolution{Product: product, Path: BrowserClawBinaryPath, PreferredPath: BrowserClawBinaryPath}
	})
	joined := strings.Join(args, "\n")
	if args[0] != BrowserClawBinaryPath {
		t.Fatalf("got binary %q want %q", args[0], BrowserClawBinaryPath)
	}
	if !strings.Contains(joined, "--mahoraga-product=browserclaw") {
		t.Fatalf("missing BrowserClaw product arg in\n%s", joined)
	}
}

func TestResolveBinary(t *testing.T) {
	tests := []struct {
		name          string
		product       string
		existingPaths map[string]bool
		wantProduct   string
		wantPath      string
		wantPreferred string
		wantFallback  bool
	}{
		{
			name:          "default product uses Mahoraga",
			wantProduct:   ProductMahoraga,
			wantPath:      MahoragaBinaryPath,
			wantPreferred: MahoragaBinaryPath,
		},
		{
			name:          "Mahoraga product ignores BrowserClaw install",
			product:       ProductMahoraga,
			existingPaths: map[string]bool{BrowserClawBinaryPath: true},
			wantProduct:   ProductMahoraga,
			wantPath:      MahoragaBinaryPath,
			wantPreferred: MahoragaBinaryPath,
		},
		{
			name:          "BrowserClaw product uses BrowserClaw when installed",
			product:       ProductBrowserClaw,
			existingPaths: map[string]bool{BrowserClawBinaryPath: true},
			wantProduct:   ProductBrowserClaw,
			wantPath:      BrowserClawBinaryPath,
			wantPreferred: BrowserClawBinaryPath,
		},
		{
			name:          "BrowserClaw product falls back to Mahoraga when absent",
			product:       ProductBrowserClaw,
			wantProduct:   ProductBrowserClaw,
			wantPath:      MahoragaBinaryPath,
			wantPreferred: BrowserClawBinaryPath,
			wantFallback:  true,
		},
		{
			name:          "unknown product keeps product flag but uses Mahoraga",
			product:       "custom",
			wantProduct:   "custom",
			wantPath:      MahoragaBinaryPath,
			wantPreferred: MahoragaBinaryPath,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveBinary(tt.product, func(path string) bool {
				return tt.existingPaths[path]
			})
			if got.Product != tt.wantProduct || got.Path != tt.wantPath || got.PreferredPath != tt.wantPreferred || got.Fallback != tt.wantFallback {
				t.Fatalf("ResolveBinary got %#v", got)
			}
		})
	}
}
