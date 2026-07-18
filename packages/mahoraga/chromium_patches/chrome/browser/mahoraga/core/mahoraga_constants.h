diff --git a/chrome/browser/mahoraga/core/mahoraga_constants.h b/chrome/browser/mahoraga/core/mahoraga_constants.h
new file mode 100644
index 0000000000000..e7b9a3a608cde
--- /dev/null
+++ b/chrome/browser/mahoraga/core/mahoraga_constants.h
@@ -0,0 +1,242 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_CONSTANTS_H_
+#define CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_CONSTANTS_H_
+
+#include <cstddef>
+#include <string>
+#include <string_view>
+#include <vector>
+
+#include "base/command_line.h"
+#include "chrome/browser/mahoraga/core/mahoraga_product.h"
+#include "chrome/browser/mahoraga/core/mahoraga_switches.h"
+
+namespace mahoraga {
+
+inline bool IsURLOverridesDisabled() {
+  return base::CommandLine::ForCurrentProcess()->HasSwitch(
+      kDisableUrlOverrides);
+}
+
+inline constexpr char kMahoragaConfigUrl[] =
+    "https://cdn.mahoraga.com/extensions/extensions.json";
+inline constexpr char kMahoragaAlphaConfigUrl[] =
+    "https://cdn.mahoraga.com/extensions/extensions.alpha.json";
+
+inline constexpr char kAgentExtensionId[] = "bflpfmnmnokmjhmgnolecpppdbdophmk";
+
+inline constexpr char kBugReporterExtensionId[] =
+    "adlpneommgkgeanpaekgoaolcpncohkf";
+
+inline constexpr char kBrowserClawExtensionId[] =
+    "pjimfkbpehlcllblajnpfamdfjhhlgkc";
+
+inline constexpr char kMahoragaUpdateUrl[] =
+    "https://cdn.mahoraga.com/extensions/update-manifest.xml";
+inline constexpr char kMahoragaAlphaUpdateUrl[] =
+    "https://cdn.mahoraga.com/extensions/update-manifest.alpha.xml";
+
+inline constexpr char kMahoragaHost[] = "mahoraga";
+
+struct MahoragaURLRoute {
+  const char* virtual_path;
+  const char* extension_id;
+  const char* extension_page;
+  const char* extension_hash;
+};
+
+enum class MahoragaExtensionProduct {
+  kMahoraga,
+  kBrowserClaw,
+  kAll,
+};
+
+struct MahoragaExtensionInfo {
+  const char* id;
+  bool is_pinned;
+  bool is_labelled;
+  MahoragaExtensionProduct product;
+};
+
+inline constexpr MahoragaExtensionInfo kMahoragaExtensions[] = {
+    {kAgentExtensionId, false, false, MahoragaExtensionProduct::kMahoraga},
+    {kBugReporterExtensionId, true, false, MahoragaExtensionProduct::kAll},
+    {kBrowserClawExtensionId, false, false,
+     MahoragaExtensionProduct::kBrowserClaw},
+};
+
+inline constexpr size_t kMahoragaExtensionsCount =
+    sizeof(kMahoragaExtensions) / sizeof(kMahoragaExtensions[0]);
+
+inline bool IsMahoragaExtensionProductActive(
+    MahoragaExtensionProduct product) {
+  switch (product) {
+    case MahoragaExtensionProduct::kMahoraga:
+      return IsMahoragaProduct();
+    case MahoragaExtensionProduct::kBrowserClaw:
+      return IsBrowserClawProduct();
+    case MahoragaExtensionProduct::kAll:
+      return true;
+  }
+  return false;
+}
+
+inline const MahoragaExtensionInfo* FindMahoragaExtensionInfo(
+    const std::string& extension_id) {
+  for (const auto& info : kMahoragaExtensions) {
+    if (extension_id == info.id) {
+      return &info;
+    }
+  }
+  return nullptr;
+}
+
+// Known means catalog membership, independent of the current product.
+inline bool IsKnownMahoragaExtension(const std::string& extension_id) {
+  return FindMahoragaExtensionInfo(extension_id) != nullptr;
+}
+
+// Active means the catalog entry belongs to the current Mahoraga product.
+inline bool IsActiveMahoragaExtension(const std::string& extension_id) {
+  const MahoragaExtensionInfo* info = FindMahoragaExtensionInfo(extension_id);
+  return info && IsMahoragaExtensionProductActive(info->product);
+}
+
+// Returns catalog IDs that should participate in current-product behavior.
+inline std::vector<std::string> GetActiveMahoragaExtensionIds() {
+  std::vector<std::string> ids;
+  ids.reserve(kMahoragaExtensionsCount);
+  for (const auto& info : kMahoragaExtensions) {
+    if (IsMahoragaExtensionProductActive(info.product)) {
+      ids.push_back(info.id);
+    }
+  }
+  return ids;
+}
+
+// Returns every managed catalog ID for cleanup and migration paths.
+inline std::vector<std::string> GetAllMahoragaExtensionIds() {
+  std::vector<std::string> ids;
+  ids.reserve(kMahoragaExtensionsCount);
+  for (const auto& info : kMahoragaExtensions) {
+    ids.push_back(info.id);
+  }
+  return ids;
+}
+
+inline constexpr MahoragaURLRoute kMahoragaURLRoutes[] = {
+    {"/settings", kAgentExtensionId, "app.html", "/settings"},
+    {"/mcp", kAgentExtensionId, "app.html", "/mcp"},
+    {"/onboarding", kAgentExtensionId, "app.html", "/onboarding"},
+    {"/claw", kBrowserClawExtensionId, "newtab.html", ""},
+};
+
+inline constexpr size_t kMahoragaURLRoutesCount =
+    sizeof(kMahoragaURLRoutes) / sizeof(kMahoragaURLRoutes[0]);
+
+inline const MahoragaURLRoute* FindMahoragaRoute(std::string_view path) {
+  for (const auto& route : kMahoragaURLRoutes) {
+    if (path == route.virtual_path &&
+        IsActiveMahoragaExtension(route.extension_id)) {
+      return &route;
+    }
+  }
+  return nullptr;
+}
+
+inline std::string GetMahoragaExtensionURL(std::string_view virtual_path) {
+  if (IsURLOverridesDisabled()) {
+    return std::string();
+  }
+  const MahoragaURLRoute* route = FindMahoragaRoute(virtual_path);
+  if (!route) {
+    return std::string();
+  }
+  std::string url = std::string("chrome-extension://") + route->extension_id +
+                    "/" + route->extension_page;
+  if (route->extension_hash[0] != '\0') {
+    url += "#";
+    url += route->extension_hash;
+  }
+  return url;
+}
+
+inline std::string GetMahoragaVirtualURL(std::string_view extension_id,
+                                          std::string_view extension_path,
+                                          std::string_view extension_ref) {
+  if (IsURLOverridesDisabled()) {
+    return std::string();
+  }
+
+  // Normalize ref - strip leading slash if present (handles both #ai and #/ai)
+  std::string normalized_ref(extension_ref);
+  if (!normalized_ref.empty() && normalized_ref[0] == '/') {
+    normalized_ref = normalized_ref.substr(1);
+  }
+
+  const MahoragaURLRoute* fallback_route = nullptr;
+
+  for (const auto& route : kMahoragaURLRoutes) {
+    if (!IsActiveMahoragaExtension(route.extension_id)) {
+      continue;
+    }
+
+    if (extension_id != route.extension_id) {
+      continue;
+    }
+
+    // Compare path (handle leading slash)
+    std::string route_path = std::string("/") + route.extension_page;
+    if (extension_path != route_path &&
+        extension_path != route.extension_page) {
+      continue;
+    }
+
+    // Exact hash match - normalize route hash the same way (strip leading /)
+    std::string normalized_hash(route.extension_hash);
+    if (!normalized_hash.empty() && normalized_hash[0] == '/') {
+      normalized_hash = normalized_hash.substr(1);
+    }
+    if (normalized_ref == normalized_hash) {
+      return std::string("chrome://") + kMahoragaHost + route.virtual_path;
+    }
+
+    // Track fallback: route with empty hash for same page
+    if (route.extension_hash[0] == '\0') {
+      fallback_route = &route;
+    }
+  }
+
+  // No exact match - use fallback if available
+  if (fallback_route) {
+    return std::string("chrome://") + kMahoragaHost +
+           fallback_route->virtual_path;
+  }
+
+  return std::string();
+}
+
+inline bool IsMahoragaPinnedExtension(const std::string& extension_id) {
+  const MahoragaExtensionInfo* info = FindMahoragaExtensionInfo(extension_id);
+  return info && IsMahoragaExtensionProductActive(info->product) &&
+         info->is_pinned;
+}
+
+inline bool IsMahoragaLabelledExtension(const std::string& extension_id) {
+  const MahoragaExtensionInfo* info = FindMahoragaExtensionInfo(extension_id);
+  return info && IsMahoragaExtensionProductActive(info->product) &&
+         info->is_labelled;
+}
+
+// Sentry crash reporting
+// https://9a76046fcfbcfe69a3580f4d204579f1@o4510545525932032.ingest.us.sentry.io/4510938172620800
+inline constexpr char kSentryMinidumpUrl[] =
+    "https://o4510545525932032.ingest.us.sentry.io/api/4510938172620800/"
+    "minidump/?sentry_key=9a76046fcfbcfe69a3580f4d204579f1";
+
+}  // namespace mahoraga
+
+#endif  // CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_CONSTANTS_H_
