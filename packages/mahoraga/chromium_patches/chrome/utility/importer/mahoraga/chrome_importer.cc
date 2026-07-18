diff --git a/chrome/utility/importer/mahoraga/chrome_importer.cc b/chrome/utility/importer/mahoraga/chrome_importer.cc
new file mode 100644
index 0000000000000..3674707cab113
--- /dev/null
+++ b/chrome/utility/importer/mahoraga/chrome_importer.cc
@@ -0,0 +1,225 @@
+// Copyright 2023 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/utility/importer/mahoraga/chrome_importer.h"
+
+#include "base/logging.h"
+#include "chrome/common/importer/importer_bridge.h"
+#include "chrome/grit/generated_resources.h"
+#include "chrome/utility/importer/mahoraga/chrome_autofill_importer.h"
+#include "chrome/utility/importer/mahoraga/chrome_bookmarks_importer.h"
+#include "chrome/utility/importer/mahoraga/chrome_cookie_importer.h"
+#include "chrome/utility/importer/mahoraga/chrome_decryptor.h"
+#include "chrome/utility/importer/mahoraga/chrome_extensions_importer.h"
+#include "chrome/utility/importer/mahoraga/chrome_history_importer.h"
+#include "chrome/utility/importer/mahoraga/chrome_password_importer.h"
+#include "components/user_data_importer/common/importer_data_types.h"
+#include "ui/base/l10n/l10n_util.h"
+
+ChromeImporter::ChromeImporter() = default;
+
+ChromeImporter::~ChromeImporter() = default;
+
+void ChromeImporter::StartImport(
+    const user_data_importer::SourceProfile& source_profile,
+    uint16_t items,
+    ImporterBridge* bridge) {
+  bridge_ = bridge;
+  source_path_ = source_profile.source_path;
+  source_profile_name_ = source_profile.profile;
+  chrome_encryption_key_.clear();
+
+  bridge_->NotifyStarted();
+
+  if ((items & (user_data_importer::PASSWORDS | user_data_importer::COOKIES)) &&
+      !cancelled()) {
+    mahoraga_importer::KeyExtractionResult key_result;
+    chrome_encryption_key_ =
+        mahoraga_importer::ExtractChromeKey(source_path_, &key_result);
+    if (chrome_encryption_key_.empty()) {
+      LOG(WARNING) << "mahoraga: Failed to extract Chrome encryption key, "
+                   << "result: " << static_cast<int>(key_result);
+    }
+  }
+
+  if ((items & user_data_importer::HISTORY) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::HISTORY);
+    ImportHistory();
+    bridge_->NotifyItemEnded(user_data_importer::HISTORY);
+  }
+
+  if ((items & user_data_importer::FAVORITES) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::FAVORITES);
+    ImportBookmarks();
+    bridge_->NotifyItemEnded(user_data_importer::FAVORITES);
+  }
+
+  if ((items & user_data_importer::PASSWORDS) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::PASSWORDS);
+    ImportPasswords();
+    bridge_->NotifyItemEnded(user_data_importer::PASSWORDS);
+  }
+
+  if ((items & user_data_importer::COOKIES) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::COOKIES);
+    ImportCookies();
+    bridge_->NotifyItemEnded(user_data_importer::COOKIES);
+  }
+
+  if ((items & user_data_importer::AUTOFILL_FORM_DATA) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::AUTOFILL_FORM_DATA);
+    ImportAutofillFormData();
+    bridge_->NotifyItemEnded(user_data_importer::AUTOFILL_FORM_DATA);
+  }
+
+  if ((items & user_data_importer::EXTENSIONS) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::EXTENSIONS);
+    ImportExtensions();
+    bridge_->NotifyItemEnded(user_data_importer::EXTENSIONS);
+  }
+
+  bridge_->NotifyEnded();
+  chrome_encryption_key_.clear();
+}
+
+void ChromeImporter::ImportHistory() {
+  LOG(INFO) << "mahoraga: Starting history import";
+
+  std::vector<user_data_importer::ImporterURLRow> rows =
+      mahoraga_importer::ImportChromeHistory(source_path_);
+
+  if (rows.empty()) {
+    LOG(INFO) << "mahoraga: No history to import";
+    return;
+  }
+
+  LOG(INFO) << "mahoraga: Importing " << rows.size() << " history items";
+
+  if (!cancelled()) {
+    bridge_->SetHistoryItems(rows,
+                             user_data_importer::VISIT_SOURCE_CHROME_IMPORTED);
+  }
+
+  LOG(INFO) << "mahoraga: History import complete";
+}
+
+void ChromeImporter::ImportBookmarks() {
+  LOG(INFO) << "mahoraga: Starting bookmarks import";
+
+  mahoraga_importer::ChromeBookmarksResult result =
+      mahoraga_importer::ImportChromeBookmarks(source_path_);
+
+  if (!result.bookmarks.empty() && !cancelled()) {
+    LOG(INFO) << "mahoraga: Importing " << result.bookmarks.size()
+              << " bookmarks";
+    std::u16string folder_name =
+        l10n_util::GetStringUTF16(IDS_IMPORT_FROM_CHROME);
+    if (!source_profile_name_.empty()) {
+      folder_name += u" (";
+      folder_name += source_profile_name_;
+      folder_name += u")";
+    }
+    bridge_->AddBookmarks(result.bookmarks, folder_name);
+  } else {
+    LOG(INFO) << "mahoraga: No bookmarks to import";
+  }
+
+  if (!result.favicons.empty() && !cancelled()) {
+    LOG(INFO) << "mahoraga: Importing " << result.favicons.size()
+              << " favicons";
+    bridge_->SetFavicons(result.favicons);
+  }
+
+  LOG(INFO) << "mahoraga: Bookmarks import complete";
+}
+
+void ChromeImporter::ImportPasswords() {
+  LOG(INFO) << "mahoraga: Starting password import";
+
+  std::vector<user_data_importer::ImportedPasswordForm> passwords =
+      mahoraga_importer::ImportChromePasswords(source_path_,
+                                                chrome_encryption_key_);
+
+  if (passwords.empty()) {
+    LOG(INFO) << "mahoraga: No passwords to import";
+    return;
+  }
+
+  LOG(INFO) << "mahoraga: Importing " << passwords.size() << " passwords";
+
+  for (const auto& password : passwords) {
+    if (cancelled()) {
+      break;
+    }
+    bridge_->SetPasswordForm(password);
+  }
+
+  LOG(INFO) << "mahoraga: Password import complete";
+}
+
+void ChromeImporter::ImportCookies() {
+  LOG(INFO) << "mahoraga: Starting cookie import";
+
+  std::vector<mahoraga_importer::ImportedCookieEntry> cookies =
+      mahoraga_importer::ImportChromeCookies(source_path_,
+                                              chrome_encryption_key_);
+
+  if (cookies.empty()) {
+    LOG(INFO) << "mahoraga: No cookies to import";
+    return;
+  }
+
+  LOG(INFO) << "mahoraga: Importing " << cookies.size() << " cookies";
+
+  for (const auto& cookie : cookies) {
+    if (cancelled()) {
+      break;
+    }
+    bridge_->SetCookie(cookie);
+  }
+
+  LOG(INFO) << "mahoraga: Cookie import complete";
+}
+
+void ChromeImporter::ImportAutofillFormData() {
+  LOG(INFO) << "mahoraga: Starting autofill import";
+
+  std::vector<ImporterAutofillFormDataEntry> entries =
+      mahoraga_importer::ImportChromeAutofill(source_path_);
+
+  if (entries.empty()) {
+    LOG(INFO) << "mahoraga: No autofill entries to import";
+    return;
+  }
+
+  LOG(INFO) << "mahoraga: Importing " << entries.size()
+            << " autofill entries";
+
+  if (!cancelled()) {
+    bridge_->SetAutofillFormData(entries);
+  }
+
+  LOG(INFO) << "mahoraga: Autofill import complete";
+}
+
+void ChromeImporter::ImportExtensions() {
+  LOG(INFO) << "mahoraga: Starting extensions import";
+
+  std::vector<std::string> extension_ids =
+      mahoraga_importer::ImportChromeExtensions(source_path_);
+
+  if (extension_ids.empty()) {
+    LOG(INFO) << "mahoraga: No extensions to import";
+    return;
+  }
+
+  LOG(INFO) << "mahoraga: Importing " << extension_ids.size()
+            << " extensions";
+
+  if (!cancelled()) {
+    bridge_->SetExtensions(extension_ids);
+  }
+
+  LOG(INFO) << "mahoraga: Extensions import complete";
+}
