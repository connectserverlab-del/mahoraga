diff --git a/chrome/browser/extensions/api/browser_os/browser_os_api.h b/chrome/browser/extensions/api/browser_os/browser_os_api.h
new file mode 100644
index 0000000000000..0da7f357c6730
--- /dev/null
+++ b/chrome/browser/extensions/api/browser_os/browser_os_api.h
@@ -0,0 +1,124 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_EXTENSIONS_API_BROWSER_OS_BROWSER_OS_API_H_
+#define CHROME_BROWSER_EXTENSIONS_API_BROWSER_OS_BROWSER_OS_API_H_
+
+#include "extensions/browser/extension_function.h"
+#include "ui/shell_dialogs/select_file_dialog.h"
+
+namespace extensions::api {
+
+class MahoragaGetPrefFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.getPref", BROWSER_OS_GETPREF)
+
+  MahoragaGetPrefFunction() = default;
+
+ protected:
+  ~MahoragaGetPrefFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+class MahoragaSetPrefFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.setPref", BROWSER_OS_SETPREF)
+
+  MahoragaSetPrefFunction() = default;
+
+ protected:
+  ~MahoragaSetPrefFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+class MahoragaLogMetricFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.logMetric", BROWSER_OS_LOGMETRIC)
+
+  MahoragaLogMetricFunction() = default;
+
+ protected:
+  ~MahoragaLogMetricFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+class MahoragaGetVersionNumberFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.getVersionNumber",
+                             BROWSER_OS_GETVERSIONNUMBER)
+
+  MahoragaGetVersionNumberFunction() = default;
+
+ protected:
+  ~MahoragaGetVersionNumberFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+class MahoragaGetMahoragaVersionNumberFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.getMahoragaVersionNumber",
+                             BROWSER_OS_GETMAHORAGAVERSIONNUMBER)
+
+  MahoragaGetMahoragaVersionNumberFunction() = default;
+
+ protected:
+  ~MahoragaGetMahoragaVersionNumberFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+class MahoragaChoosePathFunction : public ExtensionFunction,
+                                    public ui::SelectFileDialog::Listener {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.choosePath", BROWSER_OS_CHOOSEPATH)
+
+  MahoragaChoosePathFunction();
+  MahoragaChoosePathFunction(const MahoragaChoosePathFunction&) = delete;
+  MahoragaChoosePathFunction& operator=(const MahoragaChoosePathFunction&) =
+      delete;
+
+  // ui::SelectFileDialog::Listener:
+  void FileSelected(const ui::SelectedFileInfo& file, int index) override;
+  void FileSelectionCanceled() override;
+
+ protected:
+  ~MahoragaChoosePathFunction() override;
+
+  ResponseAction Run() override;
+
+ private:
+  scoped_refptr<ui::SelectFileDialog> select_file_dialog_;
+};
+
+class MahoragaShowToastFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.showToast", BROWSER_OS_SHOWTOAST)
+
+  MahoragaShowToastFunction() = default;
+
+ protected:
+  ~MahoragaShowToastFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+class MahoragaShowInfoBarFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("mahoraga.showInfoBar", BROWSER_OS_SHOWINFOBAR)
+
+  MahoragaShowInfoBarFunction() = default;
+
+ protected:
+  ~MahoragaShowInfoBarFunction() override = default;
+
+  ResponseAction Run() override;
+};
+
+}  // namespace extensions::api
+
+#endif  // CHROME_BROWSER_EXTENSIONS_API_BROWSER_OS_BROWSER_OS_API_H_
