diff --git a/chrome/browser/mahoraga/metrics/mahoraga_metrics_service_factory.h b/chrome/browser/mahoraga/metrics/mahoraga_metrics_service_factory.h
new file mode 100644
index 0000000000000..2caddc7598a43
--- /dev/null
+++ b/chrome/browser/mahoraga/metrics/mahoraga_metrics_service_factory.h
@@ -0,0 +1,48 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_METRICS_MAHORAGA_METRICS_SERVICE_FACTORY_H_
+#define CHROME_BROWSER_MAHORAGA_METRICS_MAHORAGA_METRICS_SERVICE_FACTORY_H_
+
+#include "base/no_destructor.h"
+#include "components/keyed_service/content/browser_context_keyed_service_factory.h"
+
+namespace content {
+class BrowserContext;
+}  // namespace content
+
+namespace mahoraga_metrics {
+
+class MahoragaMetricsService;
+
+// Factory for creating MahoragaMetricsService instances per profile.
+class MahoragaMetricsServiceFactory
+    : public BrowserContextKeyedServiceFactory {
+ public:
+  MahoragaMetricsServiceFactory(const MahoragaMetricsServiceFactory&) =
+      delete;
+  MahoragaMetricsServiceFactory& operator=(
+      const MahoragaMetricsServiceFactory&) = delete;
+
+  // Returns the MahoragaMetricsService for |context|, creating one if needed.
+  static MahoragaMetricsService* GetForBrowserContext(
+      content::BrowserContext* context);
+
+  // Returns the singleton factory instance.
+  static MahoragaMetricsServiceFactory* GetInstance();
+
+ private:
+  friend base::NoDestructor<MahoragaMetricsServiceFactory>;
+
+  MahoragaMetricsServiceFactory();
+  ~MahoragaMetricsServiceFactory() override;
+
+  // BrowserContextKeyedServiceFactory:
+  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
+      content::BrowserContext* context) const override;
+};
+
+}  // namespace mahoraga_metrics
+
+#endif  // CHROME_BROWSER_MAHORAGA_METRICS_MAHORAGA_METRICS_SERVICE_FACTORY_H_
