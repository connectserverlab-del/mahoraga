package cmd

import (
	"fmt"
	"os"

	"mahoraga-dev/proc"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "mahoraga-dev",
	Short: "Mahoraga development & testing CLI",
	Long: proc.BoldColor.Sprint("mahoraga-dev") + proc.DimColor.Sprint(" — development & testing CLI for Mahoraga") + `

Manages browser, server, and extension processes for local development and testing.`,
	CompletionOptions: cobra.CompletionOptions{DisableDefaultCmd: true},
	SilenceUsage:      true,
	SilenceErrors:     true,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
