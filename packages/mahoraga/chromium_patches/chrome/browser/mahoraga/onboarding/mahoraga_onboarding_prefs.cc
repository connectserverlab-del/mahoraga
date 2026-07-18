diff --git a/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.cc b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.cc
new file mode 100644
index 0000000000000000000000000000000000000000..a403ca0c367402c1e47cf1a91f2cdcdc7569a6d6
--- /dev/null
+++ b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.cc
@@ -0,0 +1,52 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.h"
+
+#include "chrome/browser/browser_process.h"
+#include "chrome/browser/mahoraga/core/mahoraga_prefs.h"
+#include "chrome/browser/mahoraga/core/mahoraga_product.h"
+#include "chrome/browser/profiles/profile.h"
+#include "chrome/common/chrome_constants.h"
+#include "chrome/common/pref_names.h"
+#include "components/prefs/pref_service.h"
+
+namespace mahoraga::onboarding {
+
+bool ShouldShow(Profile* profile) {
+  if (mahoraga::IsMahoragaProduct()) {
+    return false;
+  }
+
+  if (!profile || !profile->IsRegularProfile() || profile->IsOffTheRecord()) {
+    return false;
+  }
+
+  if (profile->GetBaseName() !=
+      base::FilePath().AppendASCII(chrome::kInitialProfile)) {
+    return false;
+  }
+
+  return !profile->GetPrefs()->GetBoolean(
+      mahoraga::prefs::kOnboardingCompleted);
+}
+
+void MarkCompleted(Profile* profile) {
+  if (!profile || !profile->IsRegularProfile()) {
+    return;
+  }
+
+  PrefService* prefs = profile->GetPrefs();
+  prefs->SetBoolean(mahoraga::prefs::kOnboardingCompleted, true);
+  prefs->CommitPendingWrite();
+}
+
+void NeutralizeUpstreamFirstRun() {
+  // Mahoraga owns first-run policy whether it skips or replaces onboarding.
+  if (PrefService* local_state = g_browser_process->local_state()) {
+    local_state->SetBoolean(::prefs::kFirstRunFinished, true);
+  }
+}
+
+}  // namespace mahoraga::onboarding
