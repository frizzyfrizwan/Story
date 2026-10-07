"use client";

/**
 * Who is looking. Pages read the session on the server and hand the id down so client pieces can
 * short-circuit (toast + sign-in redirect) instead of letting a 401 round-trip decide.
 */

import { createContext, useContext, type ReactNode } from "react";

interface Viewer {
  id: string | null;
  signedIn: boolean;
}

const ViewerContext = createContext<Viewer>({ id: null, signedIn: false });

export function ViewerProvider({ viewerId, children }: { viewerId: string | null; children: ReactNode }) {
  return <ViewerContext.Provider value={{ id: viewerId, signedIn: Boolean(viewerId) }}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  return useContext(ViewerContext);
}
