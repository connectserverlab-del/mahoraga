package cmd

import (
	"fmt"
	"path/filepath"

	"mahoraga-dogfood/config"

	"github.com/spf13/cobra"
)

var targetMahoraga bool
var targetClaw bool

var targetRequiredCommands = map[string]struct{}{
	"daemon":           {},
	"init":             {},
	"logs":             {},
	"pull":             {},
	"refresh-profile":  {},
	"restart":          {},
	"start":            {},
	"start-background": {},
	"status":           {},
	"stop":             {},
	"tail":             {},
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&targetMahoraga, "mahoraga", "b", false, "Target Mahoraga dogfood")
	rootCmd.PersistentFlags().BoolVarP(&targetClaw, "claw", "c", false, "Target BrowserClaw dogfood")
	rootCmd.PersistentPreRunE = requireTargetForLifecycleCommand
}

// requireTargetForLifecycleCommand enforces explicit target choice for runtime commands.
func requireTargetForLifecycleCommand(cmd *cobra.Command, args []string) error {
	if _, _, err := resolveTargetFlags(targetMahoraga, targetClaw); err != nil {
		return err
	}
	if !commandRequiresTarget(cmd) {
		return nil
	}
	_, ok, err := selectedTarget()
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("choose a dogfood target with --mahoraga or --claw")
	}
	return nil
}

func commandRequiresTarget(cmd *cobra.Command) bool {
	for current := cmd; current != nil; current = current.Parent() {
		if _, ok := targetRequiredCommands[current.Name()]; ok {
			return true
		}
	}
	return false
}

func selectedTarget() (config.Target, bool, error) {
	return resolveTargetFlags(targetMahoraga, targetClaw)
}

// selectedRequiredTarget returns the flag-selected target without reading config.
func selectedRequiredTarget() (config.Target, error) {
	target, ok, err := selectedTarget()
	if err != nil {
		return "", err
	}
	if !ok {
		return "", fmt.Errorf("choose a dogfood target with --mahoraga or --claw")
	}
	return target, nil
}

func resolveTargetFlags(mahoraga bool, claw bool) (config.Target, bool, error) {
	switch {
	case mahoraga && claw:
		return "", false, fmt.Errorf("--mahoraga and --claw are mutually exclusive")
	case mahoraga:
		return config.TargetMahoraga, true, nil
	case claw:
		return config.TargetClaw, true, nil
	default:
		return "", false, nil
	}
}

func selectedTargetFlag(target config.Target) (string, error) {
	switch target {
	case config.TargetMahoraga:
		return "--mahoraga", nil
	case config.TargetClaw:
		return "--claw", nil
	default:
		return "", fmt.Errorf("unknown dogfood target %q", target)
	}
}

func targetFlagOrDefault(target config.Target) string {
	flag, err := selectedTargetFlag(target)
	if err != nil {
		return "--mahoraga"
	}
	return flag
}

// loadTargetConfig loads config and projects it to the requested dogfood target.
func loadTargetConfig(target config.Target) (config.Config, error) {
	path, err := config.Path()
	if err != nil {
		return config.Config{}, err
	}
	cfg, err := config.Load(path)
	if err != nil {
		return config.Config{}, fmt.Errorf("missing config at %s; run mahoraga-dogfood --%s init: %w", path, target, err)
	}
	if err := cfg.ApplyTarget(target); err != nil {
		return config.Config{}, err
	}
	if err := cfg.Validate(); err != nil {
		return config.Config{}, err
	}
	return cfg, nil
}

func loadSelectedTargetConfig() (config.Target, config.Config, error) {
	target, err := selectedRequiredTarget()
	if err != nil {
		return "", config.Config{}, err
	}
	cfg, err := loadTargetConfig(target)
	return target, cfg, err
}

func loadTargetConfigWithoutValidation(target config.Target) (config.Config, error) {
	path, err := config.Path()
	if err != nil {
		return config.Config{}, err
	}
	cfg, err := config.Load(path)
	if err != nil {
		return config.Config{}, fmt.Errorf("missing config at %s; run mahoraga-dogfood --%s init: %w", path, target, err)
	}
	if err := cfg.ApplyTarget(target); err != nil {
		return config.Config{}, err
	}
	return cfg, nil
}

func loadSelectedTargetConfigWithoutValidation() (config.Target, config.Config, error) {
	target, err := selectedRequiredTarget()
	if err != nil {
		return "", config.Config{}, err
	}
	cfg, err := loadTargetConfigWithoutValidation(target)
	return target, cfg, err
}

func defaultTargetRunPaths(target config.Target) (runPaths, error) {
	path, err := config.Path()
	if err != nil {
		return runPaths{}, err
	}
	return newTargetRunPaths(path, target), nil
}

// newTargetRunPaths keeps daemon IPC and logs isolated per dogfood target.
func newTargetRunPaths(configPath string, target config.Target) runPaths {
	dir := filepath.Join(filepath.Dir(configPath), string(target))
	return runPaths{
		Dir:    dir,
		Lock:   filepath.Join(dir, "run.lock"),
		State:  filepath.Join(dir, "state.json"),
		Socket: filepath.Join(dir, "daemon.sock"),
		Log:    filepath.Join(dir, "daemon.jsonl"),
		RawLog: filepath.Join(dir, "daemon.log"),
	}
}
