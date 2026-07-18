diff --git a/chrome/browser/flag_descriptions.h b/chrome/browser/flag_descriptions.h
index eb93b7a1529f9..0bc2602ef8dd4 100644
--- a/chrome/browser/flag_descriptions.h
+++ b/chrome/browser/flag_descriptions.h
@@ -291,6 +291,18 @@ inline constexpr char kBookmarksTreeViewName[] =
 inline constexpr char kBookmarksTreeViewDescription[] =
     "Show the bookmarks side panel in a tree view while in compact mode.";
 
+// Mahoraga: feature flags
+inline constexpr char kMahoragaAlphaFeaturesName[] =
+    "Mahoraga Alpha Features";
+inline constexpr char kMahoragaAlphaFeaturesDescription[] =
+    "Enables Mahoraga alpha features.";
+
+inline constexpr char kMahoragaKeyboardShortcutsName[] =
+    "Mahoraga Keyboard Shortcuts";
+inline constexpr char kMahoragaKeyboardShortcutsDescription[] =
+    "Enables Mahoraga keyboard shortcuts (Cmd+Shift+K, Cmd+Shift+L, "
+    "Option+A). Disable if these conflict with your keyboard layout.";
+
 inline constexpr char kBrowsingHistoryActorIntegrationM2Name[] =
     "Browsing History Actor Integration M2";
 inline constexpr char kBrowsingHistoryActorIntegrationM2Description[] =
