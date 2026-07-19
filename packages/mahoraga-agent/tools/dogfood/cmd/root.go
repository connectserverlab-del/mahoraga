package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "mahoraga-dogfood",
	Short: "Mahoraga dogfooding CLI",
	Long:  "mahoraga-dogfood - Mahoraga dogfooding CLI",
	Example: `  mahoraga-dogfood --mahoraga init
  mahoraga-dogfood --claw init
  mahoraga-dogfood --mahoraga start
  mahoraga-dogfood --claw start
  mahoraga-dogfood --claw start-background
  mahoraga-dogfood --claw status
  mahoraga-dogfood --claw logs tail
  mahoraga-dogfood --claw restart --pull
  mahoraga-dogfood --claw stop`,
	CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
	SilenceUsage:      true,
	SilenceErrors:     true,
}

const usageTemplate = `{{helpHeader "Usage:"}}{{if .Runnable}}
  {{.UseLine}}{{end}}{{if .HasAvailableSubCommands}}
  {{.CommandPath}} [command]{{end}}{{if .HasExample}}

{{helpHeader "Examples:"}}
{{.Example}}{{end}}{{if .HasAvailableSubCommands}}
{{groupedHelp .}}{{end}}{{if .HasAvailableLocalFlags}}

{{helpHeader "Flags:"}}
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}{{end}}{{if .HasAvailableInheritedFlags}}

{{helpHeader "Global Flags:"}}
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}{{end}}{{if .HasAvailableSubCommands}}

{{helpHint (printf "Use \"%s [command] --help\" for more information." .CommandPath)}}{{end}}
`

func init() {
	cobra.AddTemplateFunc("helpHeader", helpHeader)
	cobra.AddTemplateFunc("helpHint", helpHint)
	cobra.AddTemplateFunc("groupedHelp", groupedHelp)

	rootCmd.AddGroup(
		&cobra.Group{ID: groupSetup, Title: "Setup:"},
		&cobra.Group{ID: groupRun, Title: "Run:"},
		&cobra.Group{ID: groupInspect, Title: "Inspect:"},
		&cobra.Group{ID: groupOther, Title: groupOtherTitle},
	)
	rootCmd.SetHelpCommandGroupID(groupOther)
	rootCmd.SetUsageTemplate(usageTemplate)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
