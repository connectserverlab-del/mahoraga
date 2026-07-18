diff --git a/chrome/browser/mahoraga/core/mahoraga_prefs.h b/chrome/browser/mahoraga/core/mahoraga_prefs.h
new file mode 100644
index 0000000000000..b04a6ef039a6b
--- /dev/null
+++ b/chrome/browser/mahoraga/core/mahoraga_prefs.h
@@ -0,0 +1,111 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_PREFS_H_
+#define CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_PREFS_H_
+
+#include <string>
+
+#include "components/prefs/pref_service.h"
+#include "ui/actions/action_id.h"
+
+namespace user_prefs {
+class PrefRegistrySyncable;
+}  // namespace user_prefs
+
+namespace mahoraga {
+
+namespace prefs {
+
+// Toolbar visibility prefs
+// Boolean: Show LLM Chat in toolbar (default: true)
+inline constexpr char kShowLLMChat[] = "mahoraga.show_llm_chat";
+
+// Boolean: Show Assistant in toolbar (default: true)
+inline constexpr char kShowAssistant[] = "mahoraga.show_assistant";
+
+// Boolean: Show labels on Mahoraga toolbar actions (default: true)
+inline constexpr char kShowToolbarLabels[] = "mahoraga.show_toolbar_labels";
+
+// Boolean: Enable vertical tabs (default: true)
+inline constexpr char kVerticalTabsEnabled[] =
+    "mahoraga.vertical_tabs_enabled";
+
+// Boolean: Show saved tab groups in the bookmark bar (default: true, false for
+// BrowserClaw).
+inline constexpr char kShowTabGroupsInBookmarkBar[] =
+    "mahoraga.show_tab_groups_in_bookmark_bar";
+
+// AI Provider prefs
+// JSON string containing the list of AI providers and configuration
+inline constexpr char kProviders[] = "mahoraga.providers";
+
+// JSON string containing custom AI providers for Mahoraga
+inline constexpr char kCustomProviders[] = "mahoraga.custom_providers";
+
+// String containing the default provider ID for Mahoraga
+inline constexpr char kDefaultProviderId[] = "mahoraga.default_provider_id";
+
+// Boolean: Focus NTP content instead of omnibox on new tab (default: true)
+inline constexpr char kNtpFocusContent[] = "mahoraga.ntp_focus_content";
+
+inline constexpr char kOnboardingCompleted[] = "mahoraga.onboarding_completed";
+
+}  // namespace prefs
+
+// Registers Mahoraga profile preferences.
+void RegisterProfilePrefs(user_prefs::PrefRegistrySyncable* registry);
+
+// Check if LLM Chat should be shown in toolbar.
+bool ShouldShowLLMChat(PrefService* pref_service);
+
+// Check if Assistant should be shown in toolbar.
+bool ShouldShowAssistant(PrefService* pref_service);
+
+// Check if toolbar labels should be shown for Mahoraga actions.
+bool ShouldShowToolbarLabels(PrefService* pref_service);
+
+// Check if vertical tabs should be enabled.
+bool IsVerticalTabsEnabled(PrefService* pref_service);
+
+// Check if saved tab groups should be shown in the bookmark bar.
+bool ShouldShowTabGroupsInBookmarkBar(PrefService* pref_service);
+
+// Syncs the Mahoraga vertical tabs pref to the upstream Chrome pref.
+// Call this early (e.g. during controller init) so the upstream pref
+// reflects Mahoraga's default.
+void SyncVerticalTabsPref(PrefService* pref_service);
+
+// Applies the Mahoraga saved tab groups bookmark bar pref to the upstream
+// Chrome pref.
+void ApplyShowTabGroupsInBookmarkBarPref(PrefService* pref_service);
+
+// Syncs the Mahoraga saved tab groups bookmark bar pref to the upstream Chrome
+// pref only while the upstream pref is still at its default value.
+void SyncShowTabGroupsInBookmarkBarPref(PrefService* pref_service);
+
+// Sets the default Mahoraga theme (blue tonal spot) on first run
+// when the user hasn't customized the theme yet.
+void SyncDefaultTheme(PrefService* pref_service);
+
+// Check if a toolbar action should be shown based on its visibility pref.
+// Returns true if:
+//   - Action has no visibility pref
+//   - Action's visibility pref is true
+// Returns false if action's visibility pref is false.
+bool ShouldShowToolbarAction(actions::ActionId id, PrefService* pref_service);
+
+// Check if a Mahoraga extension should be pinned from its catalog metadata.
+bool ShouldPinMahoragaExtension(const std::string& extension_id,
+                                 PrefService* pref_service);
+
+// Check if NTP content should receive focus instead of the omnibox.
+bool IsNtpFocusContentEnabled(PrefService* pref_service);
+
+// Get the visibility pref key for an action, or nullptr if none exists.
+const char* GetVisibilityPrefForAction(actions::ActionId id);
+
+}  // namespace mahoraga
+
+#endif  // CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_PREFS_H_
