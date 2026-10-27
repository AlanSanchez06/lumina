/** Wire backend progress events → subscribers + download toast. */
import * as i18n from "../i18n";
import { ui } from "../ui";
import { s } from "./state";
import type { DownloadProgress, RuntimeProgress } from "../../types";

let runtimeToastState: RuntimeProgress["state"] | null = null;

export function initProgressHandlers(): void {
  // Forward model download progress to subscribers and drive the
  // global download toast (bottom-right: bar, size, speed).
  window.lumina.onDownloadProgress((p: DownloadProgress) => {
    s.downloading = p.running;
    for (const cb of s.progressCbs) cb(p);
    if (p.running) {
      if (!document.getElementById("dl-toast")) {
        const kindLabel = p.model
          ? i18n.t(
              "models.section" + p.model[0].toUpperCase() + p.model.slice(1),
            )
          : "";
        ui.downloadToast(
          i18n.t("toast.modelDownloading", { model: kindLabel }),
          () => {
            void window.lumina.cancelDownload().catch(() => {});
          },
        );
      }
      ui.updateDownloadToast(p.progress || 0, p.downloaded || 0, p.total || 0);
    } else if (p.done || p.error || p.cancelled) {
      const el = document.getElementById("dl-toast");
      if (el) el.remove();
      if (p.done) ui.toast(i18n.t("toast.modelDownloaded"), "success", 3000);
      else if (p.cancelled)
        ui.toast(i18n.t("toast.downloadCancelled"), "info", 3000);
    }
  });

  // CUDA runtime download — same toast, highest priority. While it runs,
  // model downloads and the app update queue behind it.
  window.lumina.onRuntimeProgress((p: RuntimeProgress) => {
    s.runtimeBusy =
      p.state === "downloading" || p.state === "extracting";
    if (p.state === "downloading" || p.state === "extracting") {
      if (
        runtimeToastState !== p.state ||
        !document.getElementById("dl-toast")
      ) {
        runtimeToastState = p.state;
        ui.downloadToast(
          i18n.t(
            p.state === "downloading"
              ? "toast.runtimeDownloading"
              : "toast.runtimeExtracting",
          ),
          () => {
            void window.lumina.cancelRuntime().catch((err) => {
              ui.toast(String(err), "error", 5000);
            });
          },
          i18n.t("toast.cancelRuntime"),
        );
      }
      ui.updateDownloadToast(p.percent || 0, p.transferred || 0, p.total || 0);
    } else if (p.state === "cancelled") {
      runtimeToastState = null;
      const el = document.getElementById("dl-toast");
      if (el) el.remove();
      ui.toast(i18n.t("toast.runtimeCancelled"), "info", 3000);
    } else if (p.state === "ready") {
      runtimeToastState = null;
      const el = document.getElementById("dl-toast");
      if (el) el.remove();
      ui.toast(i18n.t("toast.runtimeInstalled"), "success", 4000);
    } else if (p.state === "error") {
      runtimeToastState = null;
      const el = document.getElementById("dl-toast");
      if (el) el.remove();
      ui.toast(i18n.t("toast.runtimeError"), "error", 8000);
    }
  });

  // Main pushes busy state so the Models tab can gate its download buttons.
  window.lumina.onRuntimeBusy((busy) => {
    s.runtimeBusy = busy;
    for (const cb of s.progressCbs)
      cb({ running: busy, progress: 0, downloaded: 0, total: 0, done: false });
    for (const cb of s.runtimeCbs)
      cb({ state: busy ? "downloading" : "ready" });
  });
}
