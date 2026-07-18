diff --git a/chrome/browser/mahoraga/server/server_process_launcher.h b/chrome/browser/mahoraga/server/server_process_launcher.h
new file mode 100644
index 0000000000000000000000000000000000000000..a800642043e169688367367870edd0717e97b71a
--- /dev/null
+++ b/chrome/browser/mahoraga/server/server_process_launcher.h
@@ -0,0 +1,21 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_MAHORAGA_SERVER_SERVER_PROCESS_LAUNCHER_H_
+#define CHROME_BROWSER_MAHORAGA_SERVER_SERVER_PROCESS_LAUNCHER_H_
+
+#include "base/process/process.h"
+
+namespace base {
+class CommandLine;
+}
+
+namespace mahoraga {
+
+// Launches a managed server with platform-appropriate background semantics.
+base::Process LaunchServerProcess(const base::CommandLine& command_line);
+
+}  // namespace mahoraga
+
+#endif  // CHROME_BROWSER_MAHORAGA_SERVER_SERVER_PROCESS_LAUNCHER_H_
