diff --git a/chrome/browser/mahoraga/server/server_process_launcher.cc b/chrome/browser/mahoraga/server/server_process_launcher.cc
new file mode 100644
index 0000000000000000000000000000000000000000..b834c7d4c52e08ca9e26b2e6a057b26f9c9a89f8
--- /dev/null
+++ b/chrome/browser/mahoraga/server/server_process_launcher.cc
@@ -0,0 +1,15 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/mahoraga/server/server_process_launcher.h"
+
+#include "base/process/launch.h"
+
+namespace mahoraga {
+
+base::Process LaunchServerProcess(const base::CommandLine& command_line) {
+  return base::LaunchProcess(command_line, {});
+}
+
+}  // namespace mahoraga
