/**
 * @license
 * Copyright 2025 Mahoraga
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { FieldErrors, Resolver, ResolverResult } from 'react-hook-form'
import type { MahoragaImportItem } from './mahoraga-onboarding-api'
import {
  DEFAULT_MAHORAGA_IMPORT_SOURCE_ID,
  MOCK_MAHORAGA_IMPORT_SOURCES,
  selectableItemsForSource,
} from './onboarding-v2.helpers'

export interface OnboardingFormValues {
  selectedSourceId: string
  selectedItems: MahoragaImportItem[]
}

interface OnboardingFormIssue {
  message: string
  path: ['selectedSourceId']
}

interface OnboardingFormError {
  issues: OnboardingFormIssue[]
}

export const onboardingFormDefaults: OnboardingFormValues = {
  selectedSourceId: DEFAULT_MAHORAGA_IMPORT_SOURCE_ID,
  selectedItems: selectableItemsForSource(MOCK_MAHORAGA_IMPORT_SOURCES[0]),
}

function sanitizeSelectedItems(value: unknown): MahoragaImportItem[] {
  const selectedItems =
    typeof value === 'object' && value !== null && 'selectedItems' in value
      ? (value as { selectedItems?: unknown }).selectedItems
      : undefined
  if (!Array.isArray(selectedItems)) return []
  return selectedItems.filter(
    (item): item is MahoragaImportItem => typeof item === 'string',
  )
}

function validateFormValues(
  value: unknown,
):
  | { success: true; data: OnboardingFormValues }
  | { success: false; error: OnboardingFormError } {
  const selectedSourceId =
    typeof value === 'object' && value !== null && 'selectedSourceId' in value
      ? (value as { selectedSourceId?: unknown }).selectedSourceId
      : undefined
  if (typeof selectedSourceId === 'string' && selectedSourceId.length > 0) {
    return {
      success: true,
      data: { selectedSourceId, selectedItems: sanitizeSelectedItems(value) },
    }
  }
  return {
    success: false,
    error: {
      issues: [{ message: 'Pick a profile.', path: ['selectedSourceId'] }],
    },
  }
}

export const onboardingFormSchema = {
  parse(value: unknown): OnboardingFormValues {
    const result = validateFormValues(value)
    if (result.success) return result.data
    throw result.error
  },
  safeParse: validateFormValues,
}

/** Validates the dynamic Chromium source id without bundling Zod into WebUI resources. */
export const onboardingFormResolver: Resolver<OnboardingFormValues> = (
  values,
): ResolverResult<OnboardingFormValues> => {
  const result = onboardingFormSchema.safeParse(values)
  if (result.success) {
    return { values: result.data, errors: {} }
  }
  const errors: FieldErrors<OnboardingFormValues> = {
    selectedSourceId: {
      type: 'required',
      message: result.error.issues[0]?.message,
    },
  }
  return {
    values: {},
    errors,
  }
}
