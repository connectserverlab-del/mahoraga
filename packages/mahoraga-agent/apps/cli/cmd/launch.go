package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"mahoraga-cli/output"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

// macOS bundle identifier — verified from Mahoraga.app/Contents/Info.plist
const mahoragaBundleID = "com.mahoraga.Mahoraga"

func init() {
	cmd := &cobra.Command{
		Use:   "launch",
		Short: "Launch the Mahoraga application",
		Long: `Find and launch the Mahoraga application.

Uses platform-native detection to find Mahoraga, launches it,
and waits for the server to become ready.

If Mahoraga is already running, reports the server URL.`,
		Annotations: map[string]string{"group": "Setup:"},
		Args:        cobra.NoArgs,
		Run: func(cmd *cobra.Command, args []string) {
			green := color.New(color.FgGreen)
			dim := color.New(color.Faint)
			waitSecs, _ := cmd.Flags().GetInt("wait")

			if url := probeRunningServer(); url != "" {
				green.Printf("Mahoraga is already running at %s\n", url)
				dim.Printf("Next: mahoraga-cli init %s\n", mcpEndpointURL(url))
				return
			}

			if !isMahoragaInstalled() {
				output.Error("Mahoraga is not installed.\n\n"+
					"  Download it from https://mahoraga.com", 1)
			}

			fmt.Println("Launching Mahoraga...")
			if err := startMahoraga(); err != nil {
				output.Errorf(1, "failed to launch: %v", err)
			}

			fmt.Print("Waiting for server")
			url, ok := waitForServer(time.Duration(waitSecs) * time.Second)
			fmt.Println()

			if !ok {
				output.Error("Mahoraga launched but server didn't respond within "+
					fmt.Sprintf("%d seconds.\n", waitSecs)+
					"  Check if Mahoraga is fully loaded, then retry.", 1)
			}

			green.Printf("Mahoraga is ready at %s\n", url)
			fmt.Println()
			dim.Printf("Next: mahoraga-cli init %s\n", mcpEndpointURL(url))
		},
	}

	cmd.Flags().Int("wait", 30, "Seconds to wait for server to start")
	rootCmd.AddCommand(cmd)
}

// ---------------------------------------------------------------------------
// Server probing
// ---------------------------------------------------------------------------

var commonMahoragaPorts = []int{9100, 9200, 9300}

// probeRunningServer checks launch discovery, explicit config, and common ports for a running server.
func probeRunningServer() string {
	client := &http.Client{Timeout: 2 * time.Second}

	if url := loadMahoragaServerURL(); url != "" && checkServerHealth(client, url) {
		return url
	}

	if url := defaultServerURL(); url != "" && checkServerHealth(client, url) {
		return url
	}

	return probeCommonServerPorts(client)
}

func checkServerHealth(client *http.Client, baseURL string) bool {
	status, ok := getHealthStatus(client, baseURL+"/system/health")
	if ok && status == http.StatusOK {
		return true
	}
	if ok && status != http.StatusNotFound {
		return false
	}

	status, ok = getHealthStatus(client, baseURL+"/health")
	return ok && status == http.StatusOK
}

func getHealthStatus(client *http.Client, url string) (int, bool) {
	resp, err := client.Get(url)
	if err != nil {
		return 0, false
	}
	resp.Body.Close()
	return resp.StatusCode, true
}

func probeCommonServerPorts(client *http.Client) string {
	for _, port := range commonMahoragaPorts {
		url := fmt.Sprintf("http://127.0.0.1:%d", port)
		if checkServerHealth(client, url) {
			return url
		}
	}
	return ""
}

type serverDiscoveryConfig struct {
	ServerPort       int    `json:"server_port"`
	URL              string `json:"url"`
	ServerVersion    string `json:"server_version"`
	MahoragaVersion string `json:"mahoraga_version,omitempty"`
	ChromiumVersion  string `json:"chromium_version,omitempty"`
}

// loadMahoragaServerURL reads Mahoraga's runtime discovery file for launch readiness only.
//
// Normal command resolution must not call this because it can override a URL the
// user explicitly saved with `mahoraga-cli init <Server URL>`.
func loadMahoragaServerURL() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	data, err := os.ReadFile(filepath.Join(home, ".mahoraga", "server.json"))
	if err != nil {
		return ""
	}

	var sc serverDiscoveryConfig
	if err := json.Unmarshal(data, &sc); err != nil {
		return ""
	}

	return normalizeServerURL(sc.URL)
}

func mcpEndpointURL(baseURL string) string {
	return strings.TrimSuffix(baseURL, "/") + "/mcp"
}

// ---------------------------------------------------------------------------
// Platform-native installation detection
// ---------------------------------------------------------------------------

// isMahoragaInstalled checks if Mahoraga is installed using platform-native methods.
//
// macOS:   `open -Ra "Mahoraga"` — queries Launch Services (finds apps anywhere)
// Linux:   checks /usr/bin/mahoraga (.deb), mahoraga.desktop, or AppImage files
// Windows: checks executable at %LOCALAPPDATA%\Mahoraga\Application\Mahoraga.exe
//
//	and registry uninstall key (per-user Chromium install pattern)
func isMahoragaInstalled() bool {
	switch runtime.GOOS {
	case "darwin":
		// open -Ra checks if Launch Services knows about the app without launching it.
		// Works regardless of where the app is installed.
		return exec.Command("open", "-Ra", "Mahoraga").Run() == nil

	case "linux":
		// .deb install puts `mahoraga` in /usr/bin/
		if _, err := exec.LookPath("mahoraga"); err == nil {
			return true
		}
		// .deb also creates mahoraga.desktop
		for _, dir := range []string{
			"/usr/share/applications",
			filepath.Join(userHomeDir(), ".local/share/applications"),
		} {
			if _, err := os.Stat(filepath.Join(dir, "mahoraga.desktop")); err == nil {
				return true
			}
		}
		// AppImage — user may have it in ~/Downloads, ~/Applications, etc.
		return findLinuxAppImage() != ""

	case "windows":
		// Chromium per-user install: %LOCALAPPDATA%\Mahoraga\Application\Mahoraga.exe
		if exePath := windowsMahoragaExe(); exePath != "" {
			if _, err := os.Stat(exePath); err == nil {
				return true
			}
		}
		// Fallback: check uninstall registry (per-user install uses HKCU)
		for _, root := range []string{"HKCU", "HKLM"} {
			key := root + `\Software\Microsoft\Windows\CurrentVersion\Uninstall\Mahoraga`
			if exec.Command("reg", "query", key, "/v", "DisplayName").Run() == nil {
				return true
			}
		}
		return false
	}

	return false
}

// ---------------------------------------------------------------------------
// Platform-native launch
// ---------------------------------------------------------------------------

// startMahoraga launches Mahoraga using platform-native methods.
//
// macOS:   `open -b com.mahoraga.Mahoraga` — launches by bundle ID
// Linux:   runs `mahoraga` binary or AppImage directly
// Windows: runs Mahoraga.exe from the known install path
func startMahoraga() error {
	switch runtime.GOOS {
	case "darwin":
		// Launch by bundle ID via Launch Services — no hardcoded paths needed.
		return exec.Command("open", "-b", mahoragaBundleID).Run()

	case "linux":
		// .deb install: mahoraga is in PATH
		if p, err := exec.LookPath("mahoraga"); err == nil {
			return startDetached(p)
		}
		// AppImage: run it directly
		if appImage := findLinuxAppImage(); appImage != "" {
			return startDetached(appImage)
		}
		// .desktop file: use gtk-launch (not xdg-open, which opens by MIME type)
		if _, err := exec.LookPath("gtk-launch"); err == nil {
			return exec.Command("gtk-launch", "mahoraga").Run()
		}
		return fmt.Errorf("Mahoraga found but could not determine how to launch it")

	case "windows":
		if exePath := windowsMahoragaExe(); exePath != "" {
			if _, err := os.Stat(exePath); err == nil {
				return startDetached(exePath)
			}
		}
		return fmt.Errorf("Mahoraga.exe not found at expected location")

	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// startDetached starts a process in the background without inheriting stdio.
func startDetached(path string, args ...string) error {
	cmd := exec.Command(path, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil
	return cmd.Start()
}

// windowsMahoragaExe returns the expected Mahoraga.exe path on Windows.
// Chromium per-user installs go to %LOCALAPPDATA%\<base_app_name>\Application\<binary>.
// base_app_name = "Mahoraga" (from chromium_install_modes.h)
func windowsMahoragaExe() string {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return ""
	}
	return filepath.Join(localAppData, "Mahoraga", "Application", "Mahoraga.exe")
}

// findLinuxAppImage searches common locations for a Mahoraga AppImage.
func findLinuxAppImage() string {
	home := userHomeDir()
	if home == "" {
		return ""
	}
	for _, dir := range []string{
		home,
		filepath.Join(home, "Applications"),
		filepath.Join(home, "Downloads"),
		"/opt",
	} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			name := e.Name()
			if strings.HasPrefix(name, "Mahoraga") && strings.HasSuffix(name, ".AppImage") {
				return filepath.Join(dir, name)
			}
		}
	}
	return ""
}

// userHomeDir returns the home directory or empty string.
func userHomeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return home
}

// waitForServer polls until a Mahoraga server responds or timeout.
func waitForServer(maxWait time.Duration) (string, bool) {
	client := &http.Client{Timeout: 2 * time.Second}
	deadline := time.Now().Add(maxWait)

	for time.Now().Before(deadline) {
		// server.json is written by Mahoraga on startup with the actual port
		if url := loadMahoragaServerURL(); url != "" && checkServerHealth(client, url) {
			return url, true
		}
		if url := probeCommonServerPorts(client); url != "" {
			return url, true
		}
		fmt.Print(".")
		time.Sleep(1 * time.Second)
	}
	return "", false
}
