diff --git a/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.h b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.h
new file mode 100644
index 0000000000000000000000000000000000000000..0a78fc904746e06fdc2ad0ebf514702fa1aeed3f
--- /dev/null
+++ b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_prefs.h
@@ -0,0 +1,23 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_ONBOARDING_MAHORAGA_ONBOARDING_PREFS_H_
+#define CHROME_BROWSER_MAHORAGA_ONBOARDING_MAHORAGA_ONBOARDING_PREFS_H_
+
+class Profile;
+
+namespace mahoraga::onboarding {
+
+// Returns whether onboarding should interrupt startup for `profile`.
+bool ShouldShow(Profile* profile);
+
+// Marks the Mahoraga onboarding popup complete for `profile`.
+void MarkCompleted(Profile* profile);
+
+// Marks Chromium's DICE first-run finished so Mahoraga can skip or replace it.
+void NeutralizeUpstreamFirstRun();
+
+}  // namespace mahoraga::onboarding
+
+#endif  // CHROME_BROWSER_MAHORAGA_ONBOARDING_MAHORAGA_ONBOARDING_PREFS_H_
