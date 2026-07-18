diff --git a/chrome/browser/mahoraga/core/mahoraga_prefs_unittest.cc b/chrome/browser/mahoraga/core/mahoraga_prefs_unittest.cc
new file mode 100644
index 0000000000000..88f9feadd5d8d
--- /dev/null
+++ b/chrome/browser/mahoraga/core/mahoraga_prefs_unittest.cc
@@ -0,0 +1,131 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/mahoraga/core/mahoraga_prefs.h"
+
+#include "base/test/scoped_command_line.h"
+#include "chrome/browser/mahoraga/buildflags.h"
+#include "chrome/browser/mahoraga/core/mahoraga_product.h"
+#include "chrome/browser/mahoraga/core/mahoraga_switches.h"
+#include "components/bookmarks/browser/bookmark_utils.h"
+#include "components/bookmarks/common/bookmark_pref_names.h"
+#include "components/pref_registry/pref_registry_syncable.h"
+#include "components/sync_preferences/testing_pref_service_syncable.h"
+#include "testing/gtest/include/gtest/gtest.h"
+
+namespace mahoraga {
+namespace {
+
+void RegisterPrefs(sync_preferences::TestingPrefServiceSyncable* pref_service) {
+  bookmarks::RegisterProfilePrefs(pref_service->registry());
+  RegisterProfilePrefs(pref_service->registry());
+}
+
+#if BUILDFLAG(MAHORAGA_ALLOW_RUNTIME_PRODUCT_OVERRIDE)
+void SetProductOverride(base::test::ScopedCommandLine* scoped_command_line,
+                        Product product) {
+  scoped_command_line->GetProcessCommandLine()->AppendSwitchASCII(
+      kMahoragaProduct, product == Product::kBrowserClaw
+                             ? kBrowserClawProductValue
+                             : kMahoragaProductValue);
+}
+#endif  // BUILDFLAG(MAHORAGA_ALLOW_RUNTIME_PRODUCT_OVERRIDE)
+
+TEST(MahoragaPrefsTest, ShowTabGroupsInBookmarkBarDefaultMatchesBakedProduct) {
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+
+  EXPECT_EQ(!IsBrowserClawProduct(),
+            pref_service.GetBoolean(prefs::kShowTabGroupsInBookmarkBar));
+}
+
+#if BUILDFLAG(MAHORAGA_ALLOW_RUNTIME_PRODUCT_OVERRIDE)
+TEST(MahoragaPrefsTest, BrowserClawDefaultsToHidingTabGroupsInBookmarkBar) {
+  base::test::ScopedCommandLine scoped_command_line;
+  SetProductOverride(&scoped_command_line, Product::kBrowserClaw);
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+
+  EXPECT_FALSE(pref_service.GetBoolean(prefs::kShowTabGroupsInBookmarkBar));
+}
+
+TEST(MahoragaPrefsTest, MahoragaDefaultsToShowingTabGroupsInBookmarkBar) {
+  base::test::ScopedCommandLine scoped_command_line;
+  SetProductOverride(&scoped_command_line, Product::kMahoraga);
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+
+  EXPECT_TRUE(pref_service.GetBoolean(prefs::kShowTabGroupsInBookmarkBar));
+}
+#endif  // BUILDFLAG(MAHORAGA_ALLOW_RUNTIME_PRODUCT_OVERRIDE)
+
+TEST(MahoragaPrefsTest,
+     SyncShowTabGroupsInBookmarkBarPrefAppliesMahoragaDefault) {
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+  pref_service.SetBoolean(prefs::kShowTabGroupsInBookmarkBar, false);
+
+  ASSERT_TRUE(pref_service
+                  .FindPreference(bookmarks::prefs::kShowTabGroupsInBookmarkBar)
+                  ->IsDefaultValue());
+  SyncShowTabGroupsInBookmarkBarPref(&pref_service);
+
+  EXPECT_FALSE(
+      pref_service.GetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar));
+}
+
+TEST(MahoragaPrefsTest,
+     SyncShowTabGroupsInBookmarkBarPrefPreservesUserOverride) {
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+  pref_service.SetBoolean(prefs::kShowTabGroupsInBookmarkBar, true);
+  pref_service.SetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar, false);
+
+  ASSERT_FALSE(
+      pref_service
+          .FindPreference(bookmarks::prefs::kShowTabGroupsInBookmarkBar)
+          ->IsDefaultValue());
+  SyncShowTabGroupsInBookmarkBarPref(&pref_service);
+
+  EXPECT_FALSE(
+      pref_service.GetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar));
+}
+
+TEST(MahoragaPrefsTest,
+     SyncShowTabGroupsInBookmarkBarPrefLeavesMatchingDefaultUntouched) {
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+  pref_service.SetBoolean(prefs::kShowTabGroupsInBookmarkBar, true);
+
+  const PrefService::Preference* upstream_pref = pref_service.FindPreference(
+      bookmarks::prefs::kShowTabGroupsInBookmarkBar);
+  ASSERT_TRUE(upstream_pref->IsDefaultValue());
+  ASSERT_TRUE(
+      pref_service.GetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar));
+
+  SyncShowTabGroupsInBookmarkBarPref(&pref_service);
+
+  EXPECT_TRUE(upstream_pref->IsDefaultValue());
+  EXPECT_TRUE(
+      pref_service.GetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar));
+}
+
+TEST(MahoragaPrefsTest,
+     ApplyShowTabGroupsInBookmarkBarPrefUpdatesUpstreamPref) {
+  sync_preferences::TestingPrefServiceSyncable pref_service;
+  RegisterPrefs(&pref_service);
+
+  pref_service.SetBoolean(prefs::kShowTabGroupsInBookmarkBar, false);
+  ApplyShowTabGroupsInBookmarkBarPref(&pref_service);
+  EXPECT_FALSE(
+      pref_service.GetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar));
+
+  pref_service.SetBoolean(prefs::kShowTabGroupsInBookmarkBar, true);
+  ApplyShowTabGroupsInBookmarkBarPref(&pref_service);
+  EXPECT_TRUE(
+      pref_service.GetBoolean(bookmarks::prefs::kShowTabGroupsInBookmarkBar));
+}
+
+}  // namespace
+}  // namespace mahoraga
