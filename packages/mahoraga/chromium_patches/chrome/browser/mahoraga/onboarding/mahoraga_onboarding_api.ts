diff --git a/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_api.ts b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_api.ts
new file mode 100644
index 0000000000000..2bf836fe76daa
--- /dev/null
+++ b/chrome/browser/mahoraga/onboarding/mahoraga_onboarding_api.ts
@@ -0,0 +1,94 @@
+// Copyright 2026 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+export const MAHORAGA_ONBOARDING_API_VERSION = 1 as const;
+
+export type MahoragaImportItem = 'history'|'bookmarks'|'cookies'|'passwords'|
+    'searchEngines'|'autofill'|'extensions';
+
+export type MahoragaImportStatus =
+    'idle'|'detecting'|'ready'|'importing'|'succeeded'|'failed'|'completed';
+
+export const MahoragaOnboardingMessage = {
+  PAGE_READY: 'mahoragaOnboardingPageReady',
+  REFRESH_SOURCES: 'mahoragaOnboardingRefreshSources',
+  START_IMPORT: 'mahoragaOnboardingStartImport',
+  COMPLETE: 'mahoragaOnboardingComplete',
+} as const;
+
+export type MahoragaOnboardingMessage =
+    typeof MahoragaOnboardingMessage[keyof typeof MahoragaOnboardingMessage];
+
+export interface MahoragaImportSource {
+  id: string;
+  displayName: string;
+  browserName: string;
+  profileName: string;
+  accountName: string;
+  isManaged: boolean;
+  supportedItems: MahoragaImportItem[];
+  recommendedItems: MahoragaImportItem[];
+}
+
+export interface MahoragaImportProgress {
+  currentItem?: MahoragaImportItem;
+  currentSourceId?: string;
+  currentSourceName?: string;
+  completedItems: MahoragaImportItem[];
+  totalItems: number;
+  completedSources?: number;
+  totalSources?: number;
+}
+
+export interface MahoragaOnboardingError {
+  code: string;
+  message: string;
+}
+
+export type MahoragaImportSourceResultStatus =
+    'importing'|'succeeded'|'failed';
+
+export interface MahoragaImportSourceResult {
+  sourceId: string;
+  displayName: string;
+  status: MahoragaImportSourceResultStatus;
+}
+
+export interface MahoragaOnboardingState {
+  apiVersion: typeof MAHORAGA_ONBOARDING_API_VERSION;
+  status: MahoragaImportStatus;
+  sources: MahoragaImportSource[];
+  progress?: MahoragaImportProgress;
+  error?: MahoragaOnboardingError;
+  /** Single-source imports report one per-source result. */
+  results?: MahoragaImportSourceResult[];
+}
+
+/**
+ * Starts one source import.
+ *
+ * Must be sent directly from the visible Import action. The browser process
+ * rejects hidden or non-interactive startImport messages because importing
+ * cookies/passwords can trigger the macOS Chrome Safe Storage keychain prompt.
+ */
+export interface MahoragaStartImportRequest {
+  sourceId: string;
+  items?: MahoragaImportItem[];
+}
+
+export interface MahoragaOnboardingClient {
+  receiveState(state: MahoragaOnboardingState): void;
+}
+
+export interface MahoragaOnboardingChrome {
+  send(message: MahoragaOnboardingMessage, args?: unknown[]): void;
+}
+
+declare global {
+  interface Window {
+    mahoragaOnboarding?: MahoragaOnboardingClient;
+  }
+
+  const chrome: MahoragaOnboardingChrome;
+}
