diff --git a/chrome/browser/extensions/api/side_panel/side_panel_api.h b/chrome/browser/extensions/api/side_panel/side_panel_api.h
index 72a88888eb9fc..3f0779a57b615 100644
--- a/chrome/browser/extensions/api/side_panel/side_panel_api.h
+++ b/chrome/browser/extensions/api/side_panel/side_panel_api.h
@@ -115,6 +115,36 @@ class SidePanelCloseFunction : public SidePanelApiFunction {
   ResponseAction RunFunction() override;
 };
 
+class SidePanelMahoragaToggleFunction : public SidePanelApiFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("sidePanel.mahoragaToggle",
+                             SIDEPANEL_MAHORAGATOGGLE)
+  SidePanelMahoragaToggleFunction() = default;
+  SidePanelMahoragaToggleFunction(const SidePanelMahoragaToggleFunction&) =
+      delete;
+  SidePanelMahoragaToggleFunction& operator=(
+      const SidePanelMahoragaToggleFunction&) = delete;
+
+ private:
+  ~SidePanelMahoragaToggleFunction() override = default;
+  ResponseAction RunFunction() override;
+};
+
+class SidePanelMahoragaIsOpenFunction : public SidePanelApiFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("sidePanel.mahoragaIsOpen",
+                             SIDEPANEL_MAHORAGAISOPEN)
+  SidePanelMahoragaIsOpenFunction() = default;
+  SidePanelMahoragaIsOpenFunction(const SidePanelMahoragaIsOpenFunction&) =
+      delete;
+  SidePanelMahoragaIsOpenFunction& operator=(
+      const SidePanelMahoragaIsOpenFunction&) = delete;
+
+ private:
+  ~SidePanelMahoragaIsOpenFunction() override = default;
+  ResponseAction RunFunction() override;
+};
+
 }  // namespace extensions
 
 #endif  // CHROME_BROWSER_EXTENSIONS_API_SIDE_PANEL_SIDE_PANEL_API_H_
