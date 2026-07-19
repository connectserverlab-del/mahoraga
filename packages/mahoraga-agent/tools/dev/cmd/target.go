package cmd

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"mahoraga-dev/proc"

	"gopkg.in/yaml.v3"
)

const (
	targetDev     = "dev"
	targetDogfood = "dogfood"
	targetProd    = "prod"

	devDirName  = ".mahoraga-dev"
	prodDirName = ".mahoraga"
)

type resetTargetOptions struct {
	Target             string
	MahoragaDir       string
	Ports              string
	BrowserUserDataDir string
}

type resetTarget struct {
	Name                string
	Title               string
	MahoragaDir        string
	LimaHome            string
	Ports               *proc.Ports
	BrowserUserDataDirs []string
	TempPrefixes        []string
	WatchRunStateDir    string
	DeleteRootLabel     string
	DeleteRootBody      string
	Dogfood             *dogfoodRuntimeTarget
}

type dogfoodRuntimeTarget struct {
	ConfigDir  string
	LockPath   string
	StatePath  string
	SocketPath string
}

type dogfoodConfigFile struct {
	MahoragaDir   string `yaml:"mahoraga_dir"`
	DevUserDataDir string `yaml:"dev_user_data_dir"`
	Ports          struct {
		CDP       int `yaml:"cdp"`
		Server    int `yaml:"server"`
		Extension int `yaml:"extension"`
	} `yaml:"ports"`
}

func resolveResetTarget(root string, opts resetTargetOptions) (resetTarget, error) {
	target := strings.TrimSpace(opts.Target)
	if target == "" {
		target = targetDev
	}
	switch target {
	case targetDev:
		return resolveDevTarget(root, opts)
	case targetDogfood:
		return resolveDogfoodTarget(opts)
	case targetProd:
		return resolveProdTarget(opts)
	default:
		return resetTarget{}, fmt.Errorf("unsupported reset target %q", target)
	}
}

func resolveDevTarget(root string, opts resetTargetOptions) (resetTarget, error) {
	mahoragaDir, err := resolveMahoragaDir(opts.MahoragaDir, devDirName)
	if err != nil {
		return resetTarget{}, err
	}
	ports, err := resolveTargetPorts(root, opts.Ports)
	if err != nil {
		return resetTarget{}, err
	}
	devProfile, err := proc.DefaultDevUserDataDir(root)
	if err != nil {
		return resetTarget{}, err
	}
	return resetTarget{
		Name:                targetDev,
		Title:               "Mahoraga dev reset",
		MahoragaDir:        mahoragaDir,
		LimaHome:            filepath.Join(mahoragaDir, "lima"),
		Ports:               &ports,
		BrowserUserDataDirs: []string{"/tmp/mahoraga-dev", devProfile},
		TempPrefixes:        []string{"mahoraga-test-", "mahoraga-dev-"},
		WatchRunStateDir:    filepath.Join(mahoragaDir, "runs"),
		DeleteRootLabel:     "Delete dev profile?",
		DeleteRootBody:      "It removes Mahoraga dev data plus VM state.",
	}, nil
}

func resolveDogfoodTarget(opts resetTargetOptions) (resetTarget, error) {
	cfgDir, err := dogfoodConfigDir()
	if err != nil {
		return resetTarget{}, err
	}
	cfg, err := loadDogfoodConfig(filepath.Join(cfgDir, "config.yaml"))
	if err != nil {
		return resetTarget{}, err
	}
	applyDogfoodDefaults(&cfg, cfgDir)
	mahoragaDir := firstNonEmpty(opts.MahoragaDir, cfg.MahoragaDir)
	if mahoragaDir == "" {
		return resetTarget{}, fmt.Errorf("dogfood mahoraga_dir is empty")
	}
	mahoragaDir, err = filepath.Abs(expandTilde(mahoragaDir))
	if err != nil {
		return resetTarget{}, err
	}
	ports, err := parsePorts(firstNonEmpty(opts.Ports, formatPorts(proc.Ports{
		CDP:       cfg.Ports.CDP,
		Server:    cfg.Ports.Server,
		Extension: cfg.Ports.Extension,
	})))
	if err != nil {
		return resetTarget{}, err
	}
	browserUserDataDir := firstNonEmpty(opts.BrowserUserDataDir, cfg.DevUserDataDir)
	if browserUserDataDir == "" {
		return resetTarget{}, fmt.Errorf("dogfood dev_user_data_dir is empty")
	}
	browserUserDataDir, err = filepath.Abs(expandTilde(browserUserDataDir))
	if err != nil {
		return resetTarget{}, err
	}
	return resetTarget{
		Name:                targetDogfood,
		Title:               "Mahoraga dogfood reset",
		MahoragaDir:        mahoragaDir,
		LimaHome:            filepath.Join(mahoragaDir, "lima"),
		Ports:               &ports,
		BrowserUserDataDirs: []string{browserUserDataDir},
		DeleteRootLabel:     "Delete dogfood Mahoraga state?",
		DeleteRootBody:      "It removes dogfood-local Mahoraga server data plus VM state. It does not touch your source Mahoraga browser profile.",
		Dogfood: &dogfoodRuntimeTarget{
			ConfigDir:  cfgDir,
			LockPath:   filepath.Join(cfgDir, "run.lock"),
			StatePath:  filepath.Join(cfgDir, "state.json"),
			SocketPath: filepath.Join(cfgDir, "daemon.sock"),
		},
	}, nil
}

func applyDogfoodDefaults(cfg *dogfoodConfigFile, cfgDir string) {
	if cfg.MahoragaDir == "" {
		if home, err := os.UserHomeDir(); err == nil {
			cfg.MahoragaDir = filepath.Join(home, ".mahoraga-dogfood")
		}
	}
	if cfg.DevUserDataDir == "" {
		cfg.DevUserDataDir = filepath.Join(cfgDir, "profile")
	}
	if cfg.Ports.CDP == 0 {
		cfg.Ports.CDP = 9015
	}
	if cfg.Ports.Server == 0 {
		cfg.Ports.Server = 9115
	}
	if cfg.Ports.Extension == 0 {
		cfg.Ports.Extension = 9315
	}
}

func resolveProdTarget(opts resetTargetOptions) (resetTarget, error) {
	mahoragaDir, err := resolveMahoragaDir(opts.MahoragaDir, prodDirName)
	if err != nil {
		return resetTarget{}, err
	}
	return resetTarget{
		Name:            targetProd,
		Title:           "Mahoraga prod reset",
		MahoragaDir:    mahoragaDir,
		LimaHome:        filepath.Join(mahoragaDir, "lima"),
		DeleteRootLabel: "Delete prod Mahoraga state?",
		DeleteRootBody:  "It removes ~/.mahoraga server data plus VM state. It does not delete your Mahoraga browser profile.",
	}, nil
}

func resolveMahoragaDir(override string, dirName string) (string, error) {
	if strings.TrimSpace(override) != "" {
		return filepath.Abs(expandTilde(strings.TrimSpace(override)))
	}
	if dirName == devDirName {
		if env := strings.TrimSpace(os.Getenv("MAHORAGA_DIR")); env != "" {
			return filepath.Abs(expandTilde(env))
		}
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, dirName), nil
}

func resolveTargetPorts(root string, explicit string) (proc.Ports, error) {
	if strings.TrimSpace(explicit) != "" {
		return parsePorts(explicit)
	}
	for _, path := range []string{
		filepath.Join(root, ".env.development"),
		filepath.Join(root, ".env.development.example"),
	} {
		ports, ok, err := readPortsFromEnvFile(path)
		if err != nil {
			return proc.Ports{}, err
		}
		if ok {
			return ports, nil
		}
	}
	return proc.DefaultLocalPorts(), nil
}

func readPortsFromEnvFile(path string) (proc.Ports, bool, error) {
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return proc.Ports{}, false, nil
	}
	if err != nil {
		return proc.Ports{}, false, err
	}
	defer file.Close()

	values := map[string]int{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, ok := parseEnvLine(scanner.Text())
		if !ok {
			continue
		}
		switch key {
		case "MAHORAGA_CDP_PORT", "MAHORAGA_SERVER_PORT", "MAHORAGA_EXTENSION_PORT":
			port, err := strconv.Atoi(value)
			if err != nil {
				return proc.Ports{}, false, fmt.Errorf("parse %s in %s: %w", key, path, err)
			}
			values[key] = port
		}
	}
	if err := scanner.Err(); err != nil {
		return proc.Ports{}, false, err
	}
	if len(values) != 3 {
		return proc.Ports{}, false, nil
	}
	return proc.Ports{
		CDP:       values["MAHORAGA_CDP_PORT"],
		Server:    values["MAHORAGA_SERVER_PORT"],
		Extension: values["MAHORAGA_EXTENSION_PORT"],
	}, true, nil
}

func parseEnvLine(line string) (string, string, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}
	key, value, ok := strings.Cut(line, "=")
	if !ok {
		return "", "", false
	}
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(stripInlineComment(value))
	value = strings.Trim(value, `"'`)
	return key, value, key != "" && value != ""
}

func stripInlineComment(value string) string {
	quote := byte(0)
	for index := 0; index < len(value); index++ {
		switch value[index] {
		case '\'', '"':
			if quote == 0 {
				quote = value[index]
			} else if quote == value[index] {
				quote = 0
			}
		case '#':
			if quote == 0 {
				return value[:index]
			}
		}
	}
	return value
}

func parsePorts(value string) (proc.Ports, error) {
	parts := strings.Split(value, ",")
	if len(parts) != 3 {
		return proc.Ports{}, fmt.Errorf("ports must be cdp,server,extension")
	}
	parsed := [3]int{}
	for i, part := range parts {
		port, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil {
			return proc.Ports{}, fmt.Errorf("parse port %q: %w", part, err)
		}
		if port <= 0 || port > 65535 {
			return proc.Ports{}, fmt.Errorf("port %d out of range", port)
		}
		parsed[i] = port
	}
	return proc.Ports{CDP: parsed[0], Server: parsed[1], Extension: parsed[2]}, nil
}

func formatPorts(ports proc.Ports) string {
	return fmt.Sprintf("%d,%d,%d", ports.CDP, ports.Server, ports.Extension)
}

func dogfoodConfigDir() (string, error) {
	if xdg := strings.TrimSpace(os.Getenv("XDG_CONFIG_HOME")); xdg != "" {
		return filepath.Join(expandTilde(xdg), "mahoraga-dogfood"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "mahoraga-dogfood"), nil
}

func loadDogfoodConfig(path string) (dogfoodConfigFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return dogfoodConfigFile{}, fmt.Errorf("read dogfood config at %s: %w", path, err)
	}
	var cfg dogfoodConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return dogfoodConfigFile{}, fmt.Errorf("parse dogfood config: %w", err)
	}
	return cfg, nil
}

func expandTilde(path string) string {
	if path == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			return home
		}
	}
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, path[2:])
		}
	}
	return path
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
