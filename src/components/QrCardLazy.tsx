import { lazy, Suspense } from "react";

import type { ComponentProps } from "react";
import type { QrCard as QrCardType } from "./QrCard";

/**
 * QR rendering pulls in the QR code library and the plate layouts.
 * Load it only when a user actually opens a QR / plate sheet.
 */
const QrCardImpl = lazy(() => import("./QrCard").then((m) => ({ default: m.QrCard })));

export function QrCardLazy(props: ComponentProps<typeof QrCardType>) {
  return (
    <Suspense fallback={null}>
      <QrCardImpl {...props} />
    </Suspense>
  );
}
