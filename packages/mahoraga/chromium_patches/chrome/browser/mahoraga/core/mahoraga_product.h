diff --git a/chrome/browser/mahoraga/core/mahoraga_product.h b/chrome/browser/mahoraga/core/mahoraga_product.h
new file mode 100644
index 0000000000000..e35cbdaf72a25
--- /dev/null
+++ b/chrome/browser/mahoraga/core/mahoraga_product.h
@@ -0,0 +1,89 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_PRODUCT_H_
+#define CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_PRODUCT_H_
+
+#include <optional>
+#include <string>
+#include <string_view>
+
+#include "base/command_line.h"
+#include "base/logging.h"
+#include "chrome/browser/mahoraga/buildflags.h"
+#include "chrome/browser/mahoraga/core/mahoraga_switches.h"
+
+namespace mahoraga {
+
+enum class Product {
+  kMahoraga,
+  kBrowserClaw,
+};
+
+static_assert(BUILDFLAG(MAHORAGA_PRODUCT_MAHORAGA) !=
+                  BUILDFLAG(MAHORAGA_PRODUCT_BROWSERCLAW),
+              "Exactly one Mahoraga product must be selected");
+
+inline Product GetBakedProduct() {
+#if BUILDFLAG(MAHORAGA_PRODUCT_BROWSERCLAW)
+  return Product::kBrowserClaw;
+#else
+  return Product::kMahoraga;
+#endif
+}
+
+#if BUILDFLAG(MAHORAGA_ALLOW_RUNTIME_PRODUCT_OVERRIDE)
+inline constexpr char kMahoragaProductValue[] = "mahoraga";
+inline constexpr char kBrowserClawProductValue[] = "browserclaw";
+
+inline std::optional<Product> ProductFromSwitchValue(std::string_view value) {
+  if (value == kMahoragaProductValue) {
+    return Product::kMahoraga;
+  }
+  if (value == kBrowserClawProductValue) {
+    return Product::kBrowserClaw;
+  }
+  return std::nullopt;
+}
+#endif
+
+inline Product GetProduct() {
+  const Product baked_product = GetBakedProduct();
+
+#if BUILDFLAG(MAHORAGA_ALLOW_RUNTIME_PRODUCT_OVERRIDE)
+  if (!base::CommandLine::InitializedForCurrentProcess()) {
+    return baked_product;
+  }
+
+  const base::CommandLine* command_line =
+      base::CommandLine::ForCurrentProcess();
+  if (!command_line->HasSwitch(kMahoragaProduct)) {
+    return baked_product;
+  }
+
+  const std::string value =
+      command_line->GetSwitchValueASCII(kMahoragaProduct);
+  std::optional<Product> product = ProductFromSwitchValue(value);
+  if (product.has_value()) {
+    return *product;
+  }
+
+  LOG(WARNING) << "mahoraga: Ignoring invalid --" << kMahoragaProduct << "="
+               << value;
+#endif
+
+  return baked_product;
+}
+
+inline bool IsMahoragaProduct() {
+  return GetProduct() == Product::kMahoraga;
+}
+
+inline bool IsBrowserClawProduct() {
+  return GetProduct() == Product::kBrowserClaw;
+}
+
+}  // namespace mahoraga
+
+#endif  // CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_PRODUCT_H_
