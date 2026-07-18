diff --git a/chrome/browser/ui/webui/settings/mahoraga_metrics_handler.cc b/chrome/browser/ui/webui/settings/mahoraga_metrics_handler.cc
new file mode 100644
index 0000000000000..df71e4624bd5f
--- /dev/null
+++ b/chrome/browser/ui/webui/settings/mahoraga_metrics_handler.cc
@@ -0,0 +1,56 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/ui/webui/settings/mahoraga_metrics_handler.h"
+
+#include "base/logging.h"
+#include "base/values.h"
+#include "chrome/browser/mahoraga/metrics/mahoraga_metrics.h"
+
+namespace settings {
+
+MahoragaMetricsHandler::MahoragaMetricsHandler() = default;
+
+MahoragaMetricsHandler::~MahoragaMetricsHandler() = default;
+
+void MahoragaMetricsHandler::RegisterMessages() {
+  web_ui()->RegisterMessageCallback(
+      "logMahoragaMetric",
+      base::BindRepeating(&MahoragaMetricsHandler::HandleLogMahoragaMetric,
+                         base::Unretained(this)));
+}
+
+void MahoragaMetricsHandler::HandleLogMahoragaMetric(
+    const base::ListValue& args) {
+  if (args.size() < 1 || !args[0].is_string()) {
+    LOG(WARNING) << "mahoraga: Invalid metric event name";
+    return;
+  }
+
+  const std::string& event_name = args[0].GetString();
+  
+  if (args.size() > 1) {
+    // Has properties
+    if (args[1].is_dict()) {
+      base::DictValue properties = args[1].GetDict().Clone();
+      mahoraga_metrics::MahoragaMetrics::Log(event_name, std::move(properties));
+    } else {
+      LOG(WARNING) << "mahoraga: Invalid metric properties format";
+      mahoraga_metrics::MahoragaMetrics::Log(event_name);
+    }
+  } else {
+    // No properties
+    mahoraga_metrics::MahoragaMetrics::Log(event_name);
+  }
+}
+
+void MahoragaMetricsHandler::OnJavascriptAllowed() {
+  // No special setup needed
+}
+
+void MahoragaMetricsHandler::OnJavascriptDisallowed() {
+  // No cleanup needed
+}
+
+}  // namespace settings
\ No newline at end of file
