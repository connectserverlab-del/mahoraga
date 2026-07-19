diff --git a/chrome/browser/about_flags.cc b/chrome/browser/about_flags.cc
index 659379c7d74a1..a819194debde4 100644
--- a/chrome/browser/about_flags.cc
+++ b/chrome/browser/about_flags.cc
@@ -10898,6 +10898,16 @@ const FeatureEntry kFeatureEntries[] = {
     {"bookmarks-tree-view", flag_descriptions::kBookmarksTreeViewName,
      flag_descriptions::kBookmarksTreeViewDescription, kOsDesktop,
      FEATURE_VALUE_TYPE(features::kBookmarksTreeView)},
+
+    {"enable-mahoraga-alpha-features",
+     flag_descriptions::kMahoragaAlphaFeaturesName,
+     flag_descriptions::kMahoragaAlphaFeaturesDescription, kOsDesktop,
+     FEATURE_VALUE_TYPE(features::kMahoragaAlphaFeatures)},
+
+    {"enable-mahoraga-keyboard-shortcuts",
+     flag_descriptions::kMahoragaKeyboardShortcutsName,
+     flag_descriptions::kMahoragaKeyboardShortcutsDescription, kOsDesktop,
+     FEATURE_VALUE_TYPE(features::kMahoragaKeyboardShortcuts)},
 #endif
 
 #if BUILDFLAG(IS_ANDROID)
