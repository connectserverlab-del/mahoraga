diff --git a/chrome/browser/mahoraga/core/mahoraga_action_utils.h b/chrome/browser/mahoraga/core/mahoraga_action_utils.h
new file mode 100644
index 0000000000000..cf8770fd34479
--- /dev/null
+++ b/chrome/browser/mahoraga/core/mahoraga_action_utils.h
@@ -0,0 +1,60 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_ACTION_UTILS_H_
+#define CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_ACTION_UTILS_H_
+
+#include <string>
+#include <string_view>
+
+#include "base/containers/fixed_flat_set.h"
+#include "chrome/browser/mahoraga/core/mahoraga_constants.h"
+#include "chrome/browser/ui/actions/chrome_action_id.h"
+#include "chrome/browser/ui/side_panel/side_panel_entry_key.h"
+#include "chrome/browser/ui/ui_features.h"
+#include "chrome/common/chrome_features.h"
+#include "ui/actions/actions.h"
+
+namespace mahoraga {
+
+constexpr auto kMahoragaNativeActionIds =
+    base::MakeFixedFlatSet<actions::ActionId>({
+        kActionSidePanelShowThirdPartyLlm,
+    });
+
+inline bool IsMahoragaAction(actions::ActionId id) {
+  if (id == kActionMahoragaAgent) {
+    return mahoraga::IsActiveMahoragaExtension(mahoraga::kAgentExtensionId);
+  }
+
+  if (kMahoragaNativeActionIds.contains(id)) {
+    return true;
+  }
+
+  for (const auto& ext_id : mahoraga::GetActiveMahoragaExtensionIds()) {
+    if (!mahoraga::IsMahoragaLabelledExtension(ext_id)) {
+      continue;
+    }
+    auto ext_action_id = actions::ActionIdMap::StringToActionId(
+        SidePanelEntryKey(SidePanelEntryId::kExtension, ext_id).ToString());
+    if (ext_action_id && id == *ext_action_id) {
+      return true;
+    }
+  }
+
+  return false;
+}
+
+inline const base::Feature* GetFeatureForMahoragaAction(actions::ActionId id) {
+  switch (id) {
+    case kActionSidePanelShowThirdPartyLlm:
+      return &features::kThirdPartyLlmPanel;
+    default:
+      return nullptr;
+  }
+}
+
+}  // namespace mahoraga
+
+#endif  // CHROME_BROWSER_MAHORAGA_CORE_MAHORAGA_ACTION_UTILS_H_
