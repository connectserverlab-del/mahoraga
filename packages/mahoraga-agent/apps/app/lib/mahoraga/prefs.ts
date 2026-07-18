/** @public */
export const MAHORAGA_PREFS = {
  MCP_PORT: 'mahoraga.server.mcp_port',
  PROVIDERS: 'mahoraga.providers',
  THIRD_PARTY_LLM_PROVIDERS: 'mahoraga.third_party_llm.providers',
  PROXY_PORT: 'mahoraga.server.proxy_port',
  SERVER_PORT: 'mahoraga.server.server_port',
  ALLOW_REMOTE_MCP: 'mahoraga.server.allow_remote_in_mcp',
  RESTART_SERVER: 'mahoraga.server.restart_requested',
  SHOW_LLM_CHAT: 'mahoraga.show_llm_chat',
  SHOW_TOOLBAR_LABELS: 'mahoraga.show_toolbar_labels',
  VERTICAL_TABS_ENABLED: 'mahoraga.vertical_tabs_enabled',
  INSTALL_ID: 'mahoraga.metrics_install_id',
} as const
