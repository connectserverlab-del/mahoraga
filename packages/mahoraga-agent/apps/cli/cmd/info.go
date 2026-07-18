package cmd

import (
	"sort"
	"strings"

	"mahoraga-cli/output"

	"github.com/spf13/cobra"
)

const mahoragaInfoOverview = `# Mahoraga

Mahoraga is an open-source AI browser built on Chromium. It exposes local browser automation through an MCP server and lets agents drive tabs, pages, screenshots, files, and connected apps.

Docs: https://docs.mahoraga.com/`

var mahoragaInfoTopics = map[string]string{
	"overview":           mahoragaInfoOverview,
	"mcp-server":         "Mahoraga exposes a local MCP server for browser automation. Use the CLI against the server URL from Mahoraga Settings > Mahoraga MCP.",
	"filesystem-access":  "Mahoraga agents can use scoped filesystem tools when a workspace is selected.",
	"connect-apps":       "Mahoraga can connect external apps through managed MCP integrations.",
	"bring-your-own-llm": "Connect Mahoraga to your preferred LLM provider or local model from Mahoraga settings.",
	"scheduled-tasks":    "Scheduled Tasks run Mahoraga automations on a recurring schedule while Mahoraga is open.",
	"chat-hub":           "Chat and LLM Hub provide side-panel AI chat and model comparison across webpages.",
	"ad-blocking":        "Mahoraga includes built-in ad blocking powered by uBlock Origin.",
}

func init() {
	cmd := &cobra.Command{
		Use:         "info [topic]",
		Annotations: map[string]string{"group": "Setup:"},
		Short:       "Get information about Mahoraga features",
		Args:        cobra.MaximumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			topic := "overview"
			if len(args) > 0 {
				topic = args[0]
			}
			content, ok := mahoragaInfoTopics[topic]
			if !ok {
				valid := make([]string, 0, len(mahoragaInfoTopics))
				for key := range mahoragaInfoTopics {
					valid = append(valid, key)
				}
				sort.Strings(valid)
				output.Errorf(3, "unknown topic %q; valid topics: %s", topic, strings.Join(valid, ", "))
			}
			result := textResult(content, map[string]any{
				"topic":   topic,
				"content": content,
			})
			if jsonOut {
				output.JSON(result)
			} else {
				output.Text(result)
			}
		},
	}

	rootCmd.AddCommand(cmd)
}
