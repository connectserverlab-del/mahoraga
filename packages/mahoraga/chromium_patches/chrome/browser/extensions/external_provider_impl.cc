diff --git a/chrome/browser/extensions/external_provider_impl.cc b/chrome/browser/extensions/external_provider_impl.cc
index 06fbe5a802929..2bf65856933bc 100644
--- a/chrome/browser/extensions/external_provider_impl.cc
+++ b/chrome/browser/extensions/external_provider_impl.cc
@@ -30,6 +30,8 @@
 #include "chrome/browser/browser_features.h"
 #include "chrome/browser/browser_process.h"
 #include "chrome/browser/browser_process_platform_part.h"
+#include "chrome/browser/mahoraga/core/mahoraga_switches.h"
+#include "chrome/browser/mahoraga/extensions/mahoraga_extension_loader.h"
 #include "chrome/browser/extensions/extension_management.h"
 #include "chrome/browser/extensions/extension_migrator.h"
 #include "chrome/browser/extensions/external_component_loader.h"
@@ -920,6 +922,40 @@ void ExternalProviderImpl::CreateExternalProviders(
     provider_list->push_back(std::move(initial_external_extensions_provider));
   }
 #endif  // BUILDFLAG(ENABLE_EXTENSIONS)
+
+  // Add Mahoraga external extension loader
+  // This loader supports both bundled CRX files (for immediate install) and
+  // remote configuration (for updates). Bundled extensions are tried first.
+  auto mahoraga_loader =
+      base::MakeRefCounted<mahoraga::MahoragaExtensionLoader>(profile);
+
+  // Allow custom config URL via command line
+  if (base::CommandLine::ForCurrentProcess()->HasSwitch(
+          mahoraga::kExtensionsUrl)) {
+    std::string config_url =
+        base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
+            mahoraga::kExtensionsUrl);
+    GURL url(config_url);
+    if (url.is_valid()) {
+      mahoraga_loader->SetConfigUrl(url);
+    }
+  }
+
+  // Allow disabling via command line flag if needed
+  if (!base::CommandLine::ForCurrentProcess()->HasSwitch(
+          mahoraga::kDisableExtensions)) {
+    // Use kExternalComponent for all Mahoraga extensions - higher privilege
+    // level, consistent location for both bundled CRX and remote URL installs.
+    auto mahoraga_provider = std::make_unique<ExternalProviderImpl>(
+        service, mahoraga_loader, profile,
+        ManifestLocation::kExternalComponent,  // CRX location (bundled)
+        ManifestLocation::kExternalComponent,  // Download location (remote)
+        Extension::WAS_INSTALLED_BY_DEFAULT);
+    mahoraga_provider->set_auto_acknowledge(true);
+    mahoraga_provider->set_allow_updates(true);
+    mahoraga_provider->set_install_immediately(true);
+    provider_list->push_back(std::move(mahoraga_provider));
+  }
 }
 
 }  // namespace extensions
