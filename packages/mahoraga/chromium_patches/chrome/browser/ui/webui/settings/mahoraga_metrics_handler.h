diff --git a/chrome/browser/ui/webui/settings/mahoraga_metrics_handler.h b/chrome/browser/ui/webui/settings/mahoraga_metrics_handler.h
new file mode 100644
index 0000000000000..23476bae86858
--- /dev/null
+++ b/chrome/browser/ui/webui/settings/mahoraga_metrics_handler.h
@@ -0,0 +1,39 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_UI_WEBUI_SETTINGS_MAHORAGA_METRICS_HANDLER_H_
+#define CHROME_BROWSER_UI_WEBUI_SETTINGS_MAHORAGA_METRICS_HANDLER_H_
+
+#include "chrome/browser/ui/webui/settings/settings_page_ui_handler.h"
+
+namespace base {
+class Value;
+}  // namespace base
+
+namespace settings {
+
+// Handler for Mahoraga metrics messages from the settings page.
+class MahoragaMetricsHandler : public SettingsPageUIHandler {
+ public:
+  MahoragaMetricsHandler();
+  ~MahoragaMetricsHandler() override;
+
+  MahoragaMetricsHandler(const MahoragaMetricsHandler&) = delete;
+  MahoragaMetricsHandler& operator=(const MahoragaMetricsHandler&) = delete;
+
+  // WebUIMessageHandler:
+  void RegisterMessages() override;
+
+ private:
+  // Handler for logMahoragaMetric message from JavaScript
+  void HandleLogMahoragaMetric(const base::ListValue& args);
+
+  // SettingsPageUIHandler:
+  void OnJavascriptAllowed() override;
+  void OnJavascriptDisallowed() override;
+};
+
+}  // namespace settings
+
+#endif  // CHROME_BROWSER_UI_WEBUI_SETTINGS_MAHORAGA_METRICS_HANDLER_H_
\ No newline at end of file
