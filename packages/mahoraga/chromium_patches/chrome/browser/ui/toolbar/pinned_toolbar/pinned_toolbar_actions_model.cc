diff --git a/chrome/browser/ui/toolbar/pinned_toolbar/pinned_toolbar_actions_model.cc b/chrome/browser/ui/toolbar/pinned_toolbar/pinned_toolbar_actions_model.cc
index 0177d0e3bda7c..9d074bf01dca6 100644
--- a/chrome/browser/ui/toolbar/pinned_toolbar/pinned_toolbar_actions_model.cc
+++ b/chrome/browser/ui/toolbar/pinned_toolbar/pinned_toolbar_actions_model.cc
@@ -16,6 +16,8 @@
 #include "base/observer_list.h"
 #include "base/strings/strcat.h"
 #include "base/values.h"
+#include "chrome/browser/mahoraga/core/mahoraga_action_utils.h"
+#include "chrome/browser/mahoraga/core/mahoraga_prefs.h"
 #include "chrome/browser/profiles/profile.h"
 #include "chrome/browser/ui/actions/chrome_action_id.h"
 #include "chrome/browser/ui/tab_search_feature.h"
@@ -37,8 +39,26 @@ PinnedToolbarActionsModel::PinnedToolbarActionsModel(Profile* profile)
       base::BindRepeating(&PinnedToolbarActionsModel::UpdatePinnedActionIds,
                           base::Unretained(this)));
 
+  // Observe Mahoraga visibility prefs for reactive updates.
+  pref_change_registrar_.Add(
+      mahoraga::prefs::kShowLLMChat,
+      base::BindRepeating(
+          &PinnedToolbarActionsModel::OnMahoragaVisibilityPrefChanged,
+          base::Unretained(this)));
+  pref_change_registrar_.Add(
+      mahoraga::prefs::kShowAssistant,
+      base::BindRepeating(
+          &PinnedToolbarActionsModel::OnMahoragaVisibilityPrefChanged,
+          base::Unretained(this)));
+  pref_change_registrar_.Add(
+      mahoraga::prefs::kShowToolbarLabels,
+      base::BindRepeating(
+          &PinnedToolbarActionsModel::OnMahoragaLabelsPrefChanged,
+          base::Unretained(this)));
+
   // Initialize the model with the current state of the kPinnedActions pref.
   UpdatePinnedActionIds();
+  EnsureAlwaysPinnedActions();
 }
 
 PinnedToolbarActionsModel::~PinnedToolbarActionsModel() = default;
@@ -239,8 +259,11 @@ void PinnedToolbarActionsModel::MaybeMigrateExistingPinnedStates() {
   if (!CanUpdate()) {
     return;
   }
+  // Chrome Labs is no longer automatically pinned for new profiles
+  // We keep this migration complete check to not affect users who already have
+  // it
   if (!pref_service_->GetBoolean(prefs::kPinnedChromeLabsMigrationComplete)) {
-    UpdatePinnedState(kActionShowChromeLabs, true);
+    // UpdatePinnedState(kActionShowChromeLabs, true);  // No longer auto-pin
     pref_service_->SetBoolean(prefs::kPinnedChromeLabsMigrationComplete, true);
   }
   if (features::HasTabSearchToolbarButton() &&
@@ -256,6 +279,49 @@ void PinnedToolbarActionsModel::MaybeMigrateExistingPinnedStates() {
   }
 }
 
+void PinnedToolbarActionsModel::EnsureAlwaysPinnedActions() {
+  // Only update if we're allowed to (not incognito/guest profiles).
+  if (!CanUpdate()) {
+    return;
+  }
+
+  const auto agent_extension_action_id = actions::ActionIdMap::StringToActionId(
+      SidePanelEntryKey(SidePanelEntryId::kExtension,
+                        mahoraga::kAgentExtensionId)
+          .ToString());
+  if (agent_extension_action_id && Contains(*agent_extension_action_id)) {
+    UpdatePinnedState(*agent_extension_action_id, false);
+  }
+
+  const bool should_pin_agent =
+      mahoraga::IsActiveMahoragaExtension(mahoraga::kAgentExtensionId) &&
+      mahoraga::ShouldShowToolbarAction(kActionMahoragaAgent, pref_service_);
+  UpdatePinnedState(kActionMahoragaAgent, should_pin_agent);
+
+  // Pin native Mahoraga actions if:
+  // 1. Their feature flag is enabled (or no feature flag exists)
+  // 2. Their visibility pref allows it
+  for (actions::ActionId id : mahoraga::kMahoragaNativeActionIds) {
+    const base::Feature* feature = mahoraga::GetFeatureForMahoragaAction(id);
+    bool feature_enabled = !feature || base::FeatureList::IsEnabled(*feature);
+    bool pref_enabled = mahoraga::ShouldShowToolbarAction(id, pref_service_);
+
+    if (feature_enabled && pref_enabled) {
+      // Should be pinned - add if not already present
+      if (!Contains(id)) {
+        UpdatePinnedState(id, true);
+      }
+    } else {
+      // Should not be pinned - remove if currently pinned
+      if (Contains(id)) {
+        UpdatePinnedState(id, false);
+      }
+    }
+  }
+
+  // Note: Extension pinning is handled by ExtensionSidePanelManager
+}
+
 const std::vector<actions::ActionId>&
 PinnedToolbarActionsModel::PinnedActionIds() const {
   return pinned_action_ids_;
@@ -274,3 +340,20 @@ void PinnedToolbarActionsModel::UpdatePref(
     list_of_values.Append(id_string.value());
   }
 }
+
+void PinnedToolbarActionsModel::OnMahoragaVisibilityPrefChanged() {
+  // Re-evaluate which Mahoraga actions should be pinned.
+  EnsureAlwaysPinnedActions();
+
+  // Notify observers that actions may have changed.
+  for (Observer& observer : observers_) {
+    observer.OnActionsChanged();
+  }
+}
+
+void PinnedToolbarActionsModel::OnMahoragaLabelsPrefChanged() {
+  // Notify observers so buttons can refresh their labels.
+  for (Observer& observer : observers_) {
+    observer.OnLabelsVisibilityChanged();
+  }
+}
