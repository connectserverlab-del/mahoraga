diff --git a/chrome/browser/chrome_browser_application_mac.mm b/chrome/browser/chrome_browser_application_mac.mm
index 0e91128e6ed16..0145e63e89cbc 100644
--- a/chrome/browser/chrome_browser_application_mac.mm
+++ b/chrome/browser/chrome_browser_application_mac.mm
@@ -9,13 +9,16 @@
 #include "base/apple/call_with_eh_frame.h"
 #include "base/check.h"
 #include "base/command_line.h"
+#include "base/logging.h"
 #import "base/mac/mac_util.h"
 #include "base/observer_list.h"
 #include "base/strings/stringprintf.h"
 #include "base/strings/sys_string_conversions.h"
 #include "base/trace_event/trace_event.h"
 #import "chrome/browser/app_controller_mac.h"
+#include "chrome/browser/mahoraga/core/mahoraga_switches.h"
 #import "chrome/browser/mac/exception_processor.h"
+#import "chrome/browser/ui/cocoa/dock_icon.h"
 #include "chrome/browser/ui/cocoa/l10n_util.h"
 #include "chrome/common/chrome_switches.h"
 #include "components/crash/core/common/crash_key.h"
@@ -51,6 +54,46 @@ void CancelTerminate() {
 
 namespace {
 
+struct MahoragaDockIconVariant {
+  const char* name;
+  int rgb;
+};
+
+constexpr MahoragaDockIconVariant kMahoragaDockIconVariants[] = {
+    {"dev", 0x10b981},
+    {"alpha", 0xd946ef},
+    {"beta", 0x06b6d4},
+};
+
+NSColor* MahoragaDockIconColor(int rgb) {
+  return [NSColor colorWithSRGBRed:((rgb >> 16) & 0xff) / 255.0
+                             green:((rgb >> 8) & 0xff) / 255.0
+                              blue:(rgb & 0xff) / 255.0
+                             alpha:1];
+}
+
+void ApplyMahoragaDockIconVariant() {
+  const base::CommandLine* command_line =
+      base::CommandLine::ForCurrentProcess();
+  if (!command_line->HasSwitch(mahoraga::kDockIcon)) {
+    return;
+  }
+
+  const std::string value =
+      command_line->GetSwitchValueASCII(mahoraga::kDockIcon);
+  for (const auto& variant : kMahoragaDockIconVariants) {
+    if (value == variant.name) {
+      DockIcon* dock_icon = [DockIcon sharedDockIcon];
+      [dock_icon setDockIconVariantColor:MahoragaDockIconColor(variant.rgb)];
+      [dock_icon updateIcon];
+      return;
+    }
+  }
+
+  LOG(WARNING) << "mahoraga: Ignoring unsupported --" << mahoraga::kDockIcon
+               << "=" << value << " (expected dev, alpha, or beta)";
+}
+
 // Calling -[NSEvent description] is rather slow to build up the event
 // description. The description is stored in a crash key to aid debugging, so
 // this helper function constructs a shorter, but still useful, description.
@@ -188,6 +231,8 @@ - (void)finishLaunching {
       base::mac::MacOSVersion() >= 14'00'00 &&
       base::FeatureList::IsEnabled(
           features::kSonomaAccessibilityActivationRefinements);
+
+  ApplyMahoragaDockIconVariant();
 }
 
 - (void)observeValueForKeyPath:(NSString*)keyPath
