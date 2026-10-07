import "server-only";
import { Resend } from "resend";
import { env } from "@/env";
import type { AlertHit, AlertRule } from "@/lib/types";
import { fmtInt, fmtUsd, fmtDate } from "@/lib/utils";

let resend: Resend | null | undefined;

function getResend(): Resend | null {
  if (resend !== undefined) return resend;
  resend = env.AUTH_RESEND_KEY ? new Resend(env.AUTH_RESEND_KEY) : null;
  return resend;
}

export function isEmailEnabled(): boolean {
  return Boolean(env.AUTH_RESEND_KEY);
}

export async function sendAlertEmail(to: string, alert: AlertRule, hits: AlertHit[]): Promise<boolean> {
  const r = getResend();
  if (!r || !hits.length) return false;
  const rows = hits
    .slice(0, 12)
    .map(
      (h) =>
        `<tr><td style="padding:6px 10px">${fmtDate(h.date)}</td><td style="padding:6px 10px">${h.origin}→${h.destination}</td><td style="padding:6px 10px">${h.carrier}</td><td style="padding:6px 10px">${h.programId}</td><td style="padding:6px 10px;font-variant-numeric:tabular-nums">${fmtInt(h.miles)} + ${fmtUsd(h.taxesUsd)}</td><td style="padding:6px 10px">${h.seats}</td></tr>`,
    )
    .join("");
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;color:#10131f">
    <h2 style="font-weight:600">Award space opened: ${alert.name}</h2>
    <p>${hits.length} new result${hits.length > 1 ? "s" : ""} for ${alert.cabin} · ${alert.passengers} passenger${alert.passengers > 1 ? "s" : ""}.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr style="text-align:left;color:#6b7590"><th style="padding:6px 10px">Date</th><th style="padding:6px 10px">Route</th><th style="padding:6px 10px">Carrier</th><th style="padding:6px 10px">Program</th><th style="padding:6px 10px">Cost</th><th style="padding:6px 10px">Seats</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px"><a href="${env.NEXT_PUBLIC_APP_URL}/alerts/${alert.id}" style="background:#ff8a3d;color:#1a0b00;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">Open in Kestrel</a></p>
    <p style="color:#6b7590;font-size:12px">Availability changes fast. Confirm with the program before transferring points.</p>
  </div>`;
  try {
    await r.emails.send({ from: env.EMAIL_FROM, to, subject: `✈ ${hits.length} new award seat${hits.length > 1 ? "s" : ""}: ${alert.name}`, html });
    return true;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}
