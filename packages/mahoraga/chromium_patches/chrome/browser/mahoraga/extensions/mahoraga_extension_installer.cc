diff --git a/chrome/browser/mahoraga/extensions/mahoraga_extension_installer.cc b/chrome/browser/mahoraga/extensions/mahoraga_extension_installer.cc
new file mode 100644
index 0000000000000..ed44e6788a59e
--- /dev/null
+++ b/chrome/browser/mahoraga/extensions/mahoraga_extension_installer.cc
@@ -0,0 +1,309 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/mahoraga/extensions/mahoraga_extension_installer.h"
+
+#include <optional>
+#include <utility>
+
+#include "base/feature_list.h"
+#include "base/files/file_util.h"
+#include "base/json/json_reader.h"
+#include "base/logging.h"
+#include "base/path_service.h"
+#include "base/task/thread_pool.h"
+#include "chrome/browser/browser_features.h"
+#include "chrome/browser/mahoraga/core/mahoraga_constants.h"
+#include "chrome/browser/extensions/external_provider_impl.h"
+#include "chrome/browser/profiles/profile.h"
+#include "chrome/common/chrome_paths.h"
+#include "content/public/browser/storage_partition.h"
+#include "net/base/load_flags.h"
+#include "net/traffic_annotation/network_traffic_annotation.h"
+#include "services/network/public/cpp/resource_request.h"
+#include "services/network/public/cpp/simple_url_loader.h"
+
+namespace mahoraga {
+
+namespace {
+
+constexpr net::NetworkTrafficAnnotationTag kTrafficAnnotation =
+    net::DefineNetworkTrafficAnnotation("mahoraga_extension_install", R"(
+        semantics {
+          sender: "Mahoraga Extension Installer"
+          description:
+            "Fetches JSON configuration specifying which extensions should "
+            "be installed for Mahoraga users."
+          trigger: "Browser startup when no bundled extensions available."
+          data: "No user data. GET request only."
+          destination: OTHER
+          destination_other: "Mahoraga configuration server."
+        }
+        policy {
+          cookies_allowed: NO
+          setting: "Controlled via command-line flags or enterprise policies."
+          policy_exception_justification: "Mahoraga feature."
+        })");
+
+}  // namespace
+
+InstallResult::InstallResult() = default;
+InstallResult::~InstallResult() = default;
+InstallResult::InstallResult(InstallResult&&) = default;
+InstallResult& InstallResult::operator=(InstallResult&&) = default;
+
+MahoragaExtensionInstaller::MahoragaExtensionInstaller(Profile* profile)
+    : profile_(profile) {
+  for (const std::string& id : GetActiveMahoragaExtensionIds()) {
+    extension_ids_.insert(id);
+  }
+}
+
+MahoragaExtensionInstaller::~MahoragaExtensionInstaller() = default;
+
+void MahoragaExtensionInstaller::StartInstallation(
+    const GURL& config_url,
+    InstallCompleteCallback callback) {
+  config_url_ = config_url;
+  callback_ = std::move(callback);
+
+  LOG(INFO) << "mahoraga: Starting extension installation";
+
+  if (TryLoadFromBundled()) {
+    return;
+  }
+
+  FetchFromRemote();
+}
+
+bool MahoragaExtensionInstaller::TryLoadFromBundled() {
+  base::FilePath bundled_path;
+  if (!base::PathService::Get(chrome::DIR_MAHORAGA_BUNDLED_EXTENSIONS,
+                              &bundled_path)) {
+    LOG(INFO) << "mahoraga: Bundled path not available";
+    return false;
+  }
+
+  base::FilePath manifest_path =
+      bundled_path.Append(FILE_PATH_LITERAL("bundled_extensions.json"));
+
+  LOG(INFO) << "mahoraga: Loading from bundled at " << bundled_path.value();
+
+  // Manifest existence is checked on the blocking task below (missing file
+  // yields empty prefs and OnBundledLoadComplete falls back to remote), so
+  // startup never touches the disk on the UI thread here.
+
+  base::ThreadPool::PostTaskAndReplyWithResult(
+      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
+      base::BindOnce(&MahoragaExtensionInstaller::ReadBundledManifest,
+                     manifest_path, bundled_path),
+      base::BindOnce(&MahoragaExtensionInstaller::OnBundledLoadComplete,
+                     weak_ptr_factory_.GetWeakPtr(), bundled_path));
+
+  return true;
+}
+
+// static
+base::DictValue MahoragaExtensionInstaller::ReadBundledManifest(
+    const base::FilePath& manifest_path,
+    const base::FilePath& bundled_path) {
+  std::string json_content;
+  if (!base::ReadFileToString(manifest_path, &json_content)) {
+    LOG(INFO) << "mahoraga: No bundled manifest at " << manifest_path.value();
+    return base::DictValue();
+  }
+
+  std::optional<base::Value> parsed =
+      base::JSONReader::Read(json_content, base::JSON_PARSE_RFC);
+  if (!parsed || !parsed->is_dict()) {
+    LOG(ERROR) << "mahoraga: Invalid bundled manifest JSON";
+    return base::DictValue();
+  }
+
+  base::DictValue prefs;
+
+  for (const auto [extension_id, config] : parsed->GetDict()) {
+    if (!config.is_dict()) {
+      continue;
+    }
+
+    if (!IsActiveMahoragaExtension(extension_id)) {
+      LOG(WARNING) << "mahoraga: Skipping inactive or unregistered extension "
+                   << extension_id;
+      continue;
+    }
+
+    const base::DictValue& config_dict = config.GetDict();
+    const std::string* crx_file = config_dict.FindString("external_crx");
+    const std::string* version = config_dict.FindString("external_version");
+
+    if (!crx_file || !version) {
+      LOG(WARNING) << "mahoraga: Bundled config missing crx/version for "
+                   << extension_id;
+      continue;
+    }
+
+    base::FilePath crx_path =
+        bundled_path.Append(base::FilePath::FromUTF8Unsafe(*crx_file));
+
+    if (!base::PathExists(crx_path)) {
+      LOG(WARNING) << "mahoraga: CRX not found: " << crx_path.value();
+      continue;
+    }
+
+    base::DictValue ext_prefs;
+    ext_prefs.Set(extensions::ExternalProviderImpl::kExternalCrx,
+                  crx_path.AsUTF8Unsafe());
+    ext_prefs.Set(extensions::ExternalProviderImpl::kExternalVersion, *version);
+
+    prefs.Set(extension_id, std::move(ext_prefs));
+    LOG(INFO) << "mahoraga: Prepared bundled " << extension_id << " v"
+              << *version;
+  }
+
+  return prefs;
+}
+
+void MahoragaExtensionInstaller::OnBundledLoadComplete(
+    const base::FilePath& bundled_path,
+    base::DictValue prefs) {
+  LOG(INFO) << "mahoraga: Bundled load complete, " << prefs.size()
+            << " extensions from " << bundled_path.value();
+
+  if (prefs.empty()) {
+    LOG(INFO) << "mahoraga: No bundled prefs, falling back to remote";
+    FetchFromRemote();
+    return;
+  }
+
+  InstallResult result;
+  result.bundled_path = bundled_path;
+  result.from_bundled = true;
+  result.prefs = std::move(prefs);
+
+  for (const auto [extension_id, _] : result.prefs) {
+    result.extension_ids.insert(extension_id);
+  }
+
+  Complete(std::move(result));
+}
+
+void MahoragaExtensionInstaller::FetchFromRemote() {
+  if (!config_url_.is_valid()) {
+    LOG(ERROR) << "mahoraga: Invalid config URL";
+    Complete(InstallResult());
+    return;
+  }
+
+  LOG(INFO) << "mahoraga: Fetching config from " << config_url_.spec();
+
+  if (!url_loader_factory_) {
+    url_loader_factory_ = profile_->GetDefaultStoragePartition()
+                              ->GetURLLoaderFactoryForBrowserProcess();
+  }
+
+  auto request = std::make_unique<network::ResourceRequest>();
+  request->url = config_url_;
+  request->method = "GET";
+  request->load_flags = net::LOAD_BYPASS_CACHE | net::LOAD_DISABLE_CACHE;
+
+  url_loader_ =
+      network::SimpleURLLoader::Create(std::move(request), kTrafficAnnotation);
+
+  url_loader_->DownloadToStringOfUnboundedSizeUntilCrashAndDie(
+      url_loader_factory_.get(),
+      base::BindOnce(&MahoragaExtensionInstaller::OnRemoteFetchComplete,
+                     weak_ptr_factory_.GetWeakPtr()));
+}
+
+void MahoragaExtensionInstaller::OnRemoteFetchComplete(
+    std::optional<std::string> response_body) {
+  if (!response_body.has_value()) {
+    LOG(ERROR) << "mahoraga: Failed to fetch config";
+    Complete(InstallResult());
+    return;
+  }
+
+  base::DictValue extensions_config = ParseConfigJson(*response_body);
+
+  if (extensions_config.empty()) {
+    Complete(InstallResult());
+    return;
+  }
+
+  InstallResult result;
+  result.config = extensions_config.Clone();
+  result.from_bundled = false;
+
+  for (const auto [extension_id, config] : extensions_config) {
+    if (!config.is_dict()) {
+      continue;
+    }
+
+    if (!IsActiveMahoragaExtension(extension_id)) {
+      LOG(WARNING) << "mahoraga: Skipping inactive or unregistered extension "
+                   << extension_id;
+      continue;
+    }
+
+    result.extension_ids.insert(extension_id);
+
+    const base::DictValue& config_dict = config.GetDict();
+    base::DictValue ext_prefs;
+
+    if (const std::string* update_url = config_dict.FindString(
+            extensions::ExternalProviderImpl::kExternalUpdateUrl)) {
+      ext_prefs.Set(extensions::ExternalProviderImpl::kExternalUpdateUrl,
+                    *update_url);
+    }
+
+    if (const std::string* crx = config_dict.FindString(
+            extensions::ExternalProviderImpl::kExternalCrx)) {
+      ext_prefs.Set(extensions::ExternalProviderImpl::kExternalCrx, *crx);
+    }
+
+    if (const std::string* version = config_dict.FindString(
+            extensions::ExternalProviderImpl::kExternalVersion)) {
+      ext_prefs.Set(extensions::ExternalProviderImpl::kExternalVersion,
+                    *version);
+    }
+
+    if (!ext_prefs.empty()) {
+      result.prefs.Set(extension_id, std::move(ext_prefs));
+    }
+  }
+
+  LOG(INFO) << "mahoraga: Loaded " << result.prefs.size()
+            << " extensions from remote config";
+
+  Complete(std::move(result));
+}
+
+base::DictValue MahoragaExtensionInstaller::ParseConfigJson(
+    const std::string& json_content) {
+  std::optional<base::Value> parsed =
+      base::JSONReader::Read(json_content, base::JSON_PARSE_RFC);
+
+  if (!parsed || !parsed->is_dict()) {
+    LOG(ERROR) << "mahoraga: Invalid config JSON";
+    return base::DictValue();
+  }
+
+  const base::DictValue* extensions = parsed->GetDict().FindDict("extensions");
+
+  if (!extensions) {
+    LOG(ERROR) << "mahoraga: No 'extensions' key in config";
+    return base::DictValue();
+  }
+
+  return extensions->Clone();
+}
+
+void MahoragaExtensionInstaller::Complete(InstallResult result) {
+  if (callback_) {
+    std::move(callback_).Run(std::move(result));
+  }
+}
+
+}  // namespace mahoraga
