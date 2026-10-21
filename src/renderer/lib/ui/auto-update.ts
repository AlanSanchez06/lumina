/** Show update button when a newer version exists; download → install → relaunch. */
import * as i18n from "../i18n";
import { ui } from ".";
import { createIcons } from "./icons";

type UpdateState =
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

let requestUpdateAction: (() => Promise<void>) | null = null;

export function requestUpdate(): Promise<void> {
  return requestUpdateAction?.() ?? Promise.resolve();
}

export function initAutoUpdate(): void {
  const btnUpdate = document.getElementById("btn-update");
  const updateIcon = btnUpdate?.querySelector("i[data-lucide]");
  const badge = btnUpdate?.querySelector("span");
  let updateToast: HTMLElement | null = null;
  let updateState: UpdateState = "checking";
  let downloadedVersion: string | undefined;
  let initialCheck: Promise<void> | null = null;

  function setSettingsUpdateStatus(message: string): void {
    const status = document.getElementById("settings-update-status");
    if (status) status.textContent = message;
  }

  function setUpdateIcon(name: string): void {
    if (updateIcon) {
      updateIcon.setAttribute("data-lucide", name);
      updateIcon.className = "w-3 h-3";
    }
    if (createIcons)
      createIcons({
        nameAttr: "data-lucide",
        attrs: {},
        root: btnUpdate as HTMLElement,
      });
  }

  function setUpdateButton(state: UpdateState, title: string): void {
    updateState = state;
    if (!btnUpdate) return;
    btnUpdate.hidden = state === "checking";
    btnUpdate.toggleAttribute(
      "disabled",
      state === "downloading" || state === "installing",
    );
    if (title) btnUpdate.title = title;
    if (badge) badge.hidden = state !== "available";
    if (state === "downloading" || state === "installing")
      setUpdateIcon("loader-2");
    else if (state === "downloaded") setUpdateIcon("download");
    else if (state === "error") setUpdateIcon("alert-triangle");
    else setUpdateIcon("cloud-download");
  }

  async function installDownloadedUpdate(
    version: string | undefined = downloadedVersion,
  ): Promise<void> {
    try {
      const { guardUnsavedChanges } = await import("../project");
      if (!(await guardUnsavedChanges(i18n.t("update.restartDetail")))) {
        setUpdateButton(
          "downloaded",
          i18n.t("update.install", { version: version || "" }),
        );
        setSettingsUpdateStatus(i18n.t("update.downloaded", { version: version || "" }));
        return;
      }
      setUpdateButton("installing", i18n.t("update.installing"));
      setSettingsUpdateStatus(i18n.t("update.installing"));
      ui.toast(i18n.t("update.installing"), "running", 0);
      await window.lumina.installUpdate();
    } catch (err) {
      ui.toast(
        err instanceof Error ? err.message : i18n.t("update.installError"),
        "error",
        8000,
      );
      setUpdateButton(
        "downloaded",
        i18n.t("update.install", { version: version || "" }),
      );
      setSettingsUpdateStatus(i18n.t("update.installError"));
    }
  }

  function startDownload(): void {
    setUpdateButton("downloading", i18n.t("update.downloading"));
    setSettingsUpdateStatus(i18n.t("update.downloading"));
    updateToast = ui.downloadToast(i18n.t("update.downloading"));
    void window.lumina.downloadUpdate().catch(function (err: unknown) {
      ui.toast(
        err instanceof Error ? err.message : i18n.t("update.downloadError"),
        "error",
        8000,
      );
      setSettingsUpdateStatus(i18n.t("update.downloadError"));
      setUpdateButton("error", i18n.t("update.retry"));
    });
  }

  requestUpdateAction = async function (): Promise<void> {
    if (updateState === "downloaded") {
      await installDownloadedUpdate();
      return;
    }
    if (updateState === "downloading" || updateState === "installing") {
      setSettingsUpdateStatus(i18n.t("update.downloading"));
      return;
    }
    if (updateState === "available") {
      startDownload();
      return;
    }

    const button = document.getElementById(
      "settings-check-updates",
    ) as HTMLButtonElement | null;
    if (button) button.disabled = true;
    setSettingsUpdateStatus(i18n.t("update.checking"));
    try {
      if (updateState === "checking" && initialCheck) await initialCheck;
      const result = await window.lumina.checkForUpdates();
      if (!result.available) {
        setSettingsUpdateStatus(i18n.t("update.upToDate"));
        ui.toast(i18n.t("update.upToDate"), "success", 5000);
        return;
      }
      setUpdateButton(
        "available",
        i18n.t("update.available", { version: result.latest || "" }),
      );
      setSettingsUpdateStatus(
        i18n.t("update.available", { version: result.latest || "" }),
      );
      startDownload();
    } catch (err) {
      setSettingsUpdateStatus(i18n.t("update.checkError"));
      ui.toast(
        err instanceof Error ? err.message : i18n.t("update.checkError"),
        "error",
        8000,
      );
    } finally {
      if (button) button.disabled = false;
    }
  };

  if (btnUpdate) {
    btnUpdate.addEventListener("click", function () {
      if (updateState === "downloaded") {
        void installDownloadedUpdate();
      } else if (updateState === "available" || updateState === "error") {
        startDownload();
      }
    });
  }

  window.lumina.onUpdateProgress(function (p) {
    if (p.state === "downloading") {
      setUpdateButton("downloading", i18n.t("update.downloading"));
      setSettingsUpdateStatus(i18n.t("update.downloading"));
      if (!updateToast)
        updateToast = ui.downloadToast(i18n.t("update.downloading"));
      ui.updateDownloadToast(p.percent || 0, p.transferred || 0, p.total || 0);
    } else if (p.state === "downloaded") {
      downloadedVersion = p.version;
      setSettingsUpdateStatus(
        i18n.t("update.available", { version: p.version || "" }),
      );
      if (updateToast) {
        ui.dismissToast(updateToast as never);
        updateToast = null;
      }
      void installDownloadedUpdate(p.version);
    } else if (p.state === "error") {
      if (updateToast) {
        ui.dismissToast(updateToast as never);
        updateToast = null;
      }
      ui.toast(i18n.t("update.downloadError"), "error", 8000);
      setSettingsUpdateStatus(i18n.t("update.downloadError"));
      setUpdateButton("error", i18n.t("update.retry"));
    }
  });

  initialCheck = window.lumina
    .checkForUpdates()
    .then(function (res) {
      if (!res.available) {
        setUpdateButton("checking", "");
        return;
      }
      setUpdateButton(
        "available",
        i18n.t("update.available", { version: res.latest || "" }),
      );
    })
    .catch(function () {
      setUpdateButton("checking", "");
    });
}
