package cmd

import (
	"bufio"
	"bytes"
	"path/filepath"
	"strings"
	"testing"

	"mahoraga-dogfood/config"
	"mahoraga-dogfood/profile"
)

func TestPrintInitNextStepsShowsInlineAndBackgroundStart(t *testing.T) {
	var out bytes.Buffer
	printInitNextSteps(&out, "/tmp/config.yaml", config.TargetClaw)

	got := out.String()
	for _, want := range []string{
		"Config written: /tmp/config.yaml",
		"Start dogfood: BrowserClaw",
		"Inline:     mahoraga-dogfood --claw start",
		"Background: mahoraga-dogfood --claw start-background",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing %q in\n%s", want, got)
		}
	}
}

func TestLoadInitConfigPreservesExistingOtherTarget(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(t.TempDir(), "config.yaml")
	cfg := config.Defaults(home)
	if err := cfg.ApplyTarget(config.TargetMahoraga); err != nil {
		t.Fatal(err)
	}
	cfg.DevUserDataDir = "/custom-mahoraga-profile"
	cfg.MahoragaDir = "/custom-mahoraga-state"
	if err := config.Save(path, cfg); err != nil {
		t.Fatal(err)
	}

	got, err := loadInitConfig(home, path, config.TargetClaw)
	if err != nil {
		t.Fatal(err)
	}

	if got.Target != config.TargetClaw {
		t.Fatalf("target got %q want claw", got.Target)
	}
	mahoraga := got.Targets[string(config.TargetMahoraga)]
	if mahoraga.DevUserDataDir != "/custom-mahoraga-profile" || mahoraga.MahoragaDir != "/custom-mahoraga-state" {
		t.Fatalf("mahoraga target was not preserved: %+v", mahoraga)
	}
	if got.DevUserDataDir != filepath.Join(home, ".config/mahoraga-dogfood/claw/profile") {
		t.Fatalf("active target profile got %q", got.DevUserDataDir)
	}
}

func TestPrintRepoPathHelpExplainsOnlyRepoPath(t *testing.T) {
	var out bytes.Buffer
	printRepoPathHelp(&out)

	got := stripANSI(out.String())
	for _, want := range []string{
		"Repo path is the root Mahoraga repo clone for alpha dogfood.",
		"Use a separate clone from your everyday dev checkout if you can.",
		"Example: /Users/you/code/mahoraga-alpha",
		"not packages/mahoraga-agent",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing %q in\n%s", want, got)
		}
	}
	if strings.Contains(got, "Mahoraga binary") {
		t.Fatalf("repo path help should not explain Mahoraga binary:\n%s", got)
	}
}

func TestPrintSourceProfileHelpExplainsProfileChoice(t *testing.T) {
	var out bytes.Buffer
	printSourceProfileHelp(&out)

	got := stripANSI(out.String())
	for _, want := range []string{
		"Choose the installed Mahoraga profile you normally use.",
		"Dogfood copies it into a separate dev profile.",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing %q in\n%s", want, got)
		}
	}
}

func TestPromptWritesPromptToOutputWriter(t *testing.T) {
	var out bytes.Buffer
	reader := bufio.NewReader(strings.NewReader("\n"))

	got := prompt(&out, reader, "Repo path", "/tmp/mahoraga-alpha")

	if got != "/tmp/mahoraga-alpha" {
		t.Fatalf("prompt returned %q", got)
	}
	if want := "Repo path [/tmp/mahoraga-alpha]: "; !strings.Contains(stripANSI(out.String()), want) {
		t.Fatalf("missing prompt %q in\n%s", want, out.String())
	}
}

func TestChooseProfileWritesChoicesToOutputWriter(t *testing.T) {
	var out bytes.Buffer
	reader := bufio.NewReader(strings.NewReader("\n"))

	got := chooseProfile(&out, reader, []profile.BrowserProfile{{
		Name:  "Main",
		Dir:   "Default",
		Email: "you@example.com",
	}})

	if got != "Default" {
		t.Fatalf("chooseProfile returned %q", got)
	}
	for _, want := range []string{
		"Found 1 Mahoraga profiles:",
		"1. Main (Default) you@example.com",
		"Select source profile [1]: ",
	} {
		if !strings.Contains(stripANSI(out.String()), want) {
			t.Fatalf("missing %q in\n%s", want, out.String())
		}
	}
}
