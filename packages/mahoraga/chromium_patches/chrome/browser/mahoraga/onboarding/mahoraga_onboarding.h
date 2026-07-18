diff --git a/chrome/browser/mahoraga/onboarding/mahoraga_onboarding.h b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding.h
new file mode 100644
index 0000000000000..6d84599152fc6
--- /dev/null
+++ b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding.h
@@ -0,0 +1,37 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_ONBOARDING_MAHORAGA_ONBOARDING_H_
+#define CHROME_BROWSER_MAHORAGA_ONBOARDING_MAHORAGA_ONBOARDING_H_
+
+#include "base/functional/callback_forward.h"
+#include "base/memory/raw_ptr.h"
+#include "content/public/browser/web_ui_controller.h"
+#include "content/public/browser/webui_config.h"
+
+class MahoragaOnboardingHandler;
+class MahoragaOnboarding;
+
+class MahoragaOnboardingUIConfig
+    : public content::DefaultWebUIConfig<MahoragaOnboarding> {
+ public:
+  MahoragaOnboardingUIConfig();
+};
+
+class MahoragaOnboarding : public content::WebUIController {
+ public:
+  explicit MahoragaOnboarding(content::WebUI* web_ui);
+  MahoragaOnboarding(const MahoragaOnboarding&) = delete;
+  MahoragaOnboarding& operator=(const MahoragaOnboarding&) = delete;
+  ~MahoragaOnboarding() override;
+
+  void SetCompletionCallback(base::RepeatingClosure completion_callback);
+
+ private:
+  raw_ptr<MahoragaOnboardingHandler> handler_ = nullptr;
+
+  WEB_UI_CONTROLLER_TYPE_DECL();
+};
+
+#endif  // CHROME_BROWSER_MAHORAGA_ONBOARDING_MAHORAGA_ONBOARDING_H_
