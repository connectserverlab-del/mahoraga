diff --git a/chrome/browser/mahoraga/core/mahoraga_switches.h b/chrome/browser/mahoraga/core/mahoraga_switches.h
new file mode 100644
index 0000000000000..98317c9cd677f
--- /dev/null
+++ b/chrome/browser/mahoraga/core/mahoraga_switches.h
@@ -0,0 +1,32 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_SWITCHES_H_
+#define CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_SWITCHES_H_
+
+namespace mahoraga {
+
+inline constexpr char kDisableServer[] = "disable-mahoraga-server";
+inline constexpr char kDisableServerUpdater[] =
+    "disable-mahoraga-server-updater";
+inline constexpr char kServerAppcastUrl[] = "mahoraga-server-appcast-url";
+inline constexpr char kServerResourcesDir[] = "mahoraga-server-resources-dir";
+inline constexpr char kCDPPort[] = "mahoraga-cdp-port";
+inline constexpr char kProxyPort[] = "mahoraga-proxy-port";
+inline constexpr char kServerPort[] = "mahoraga-server-port";
+inline constexpr char kDisableExtensions[] = "disable-mahoraga-extensions";
+inline constexpr char kExtensionsUrl[] = "mahoraga-extensions-url";
+inline constexpr char kDisableUrlOverrides[] =
+    "mahoraga-disable-url-overrides";
+inline constexpr char kSparkleUrl[] = "mahoraga-sparkle-url";
+inline constexpr char kSparkleForceCheck[] = "mahoraga-sparkle-force-check";
+inline constexpr char kSparkleDryRun[] = "sparkle-dry-run";
+inline constexpr char kSparkleSkipSignature[] = "sparkle-skip-signature";
+inline constexpr char kSparkleSpoofVersion[] = "sparkle-spoof-version";
+inline constexpr char kSparkleVerbose[] = "sparkle-verbose";
+inline constexpr char kMahoragaProduct[] = "mahoraga-product";
+inline constexpr char kDockIcon[] = "mahoraga-dock-icon";
+}  // namespace mahoraga
+
+#endif  // CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_SWITCHES_H_
