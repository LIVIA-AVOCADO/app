'use client';

import { useState } from 'react';
import { AvailabilityDialog } from './availability-dialog';
import type { AvailabilityStatus } from './availability-status-indicator';

export function AvailabilityDialogWrapper() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AvailabilityDialog
      onStatusSet={(_status: AvailabilityStatus) => setDismissed(true)}
    />
  );
}
