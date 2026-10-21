/* ── Lumina Pipeline — Inpainting (LaMa via Python backend) ──
 * The backend returns one RGBA patch per detection box; each patch becomes
 * an independent mask layer (Photoshop-style) composited over the original
 * image. The renderer no longer swaps to a single cleaned image.
 */
import { state } from "../state";
import * as i18n from "../i18n";
import { ui } from "../ui";
import { history } from "../history";
import { canvas } from "../canvas/index";
import { invalidateComposite } from "../canvas/render";
import { sidebar } from "../sidebar";
import { models } from "../models";
import { log } from "../logger";
import type { BBox, InpaintMask, Page } from "../../types";

/** Convert a Windows path to a loadable file:// URL */
function fileUrl(p: string): string {
  let norm = p.replace(/\\/g, "/");
  if (!norm.startsWith("/")) norm = "/" + norm;
  return "file://" + encodeURI(norm).replace(/#/g, "%23").replace(/\?/g, "%3F");
}

function loadImage(p: string): Promise<HTMLImageElement> {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () {
      resolve(img);
    };
    img.onerror = function () {
      reject(new Error("Failed to load patch image: " + p));
    };
    img.src = fileUrl(p);
  });
}

async function createMasks(page: Page, model: string): Promise<InpaintMask[]> {
  const result = await window.lumina.apiPost<{
    patches?: Array<{ bbox: BBox; imagePath: string }>;
    detail?: string;
    error?: string;
  }>("/inpaint", {
    imagePath: page.filePath,
    maskPath: page.maskPath ?? null,
    boxes: page.textDetections.map((d) => d.bbox),
    model,
  });
  if (!result || !Array.isArray(result.patches))
    throw new Error(result?.detail || result?.error || "Inpaint failed");

  const ts = Date.now();
  return Promise.all(
    result.patches.map(async (patch, i): Promise<InpaintMask> => ({
      id: "mask-" + ts + "-" + i,
      bbox: patch.bbox,
      imagePath: patch.imagePath,
      visible: true,
      opacity: 1,
      image: await loadImage(patch.imagePath),
    })),
  );
}

export const inpaint = {
  /** Inpaint all text detection boxes of the active page → mask layers */
  run: async function (): Promise<void> {
    const page = state.getActivePage();
    if (state.isRunning || !page) return;
    if (!page.textDetections.length) {
      ui.toast(i18n.t("toast.inpaintNoText"), "warn");
      return;
    }
    state.isRunning = true;

    const isFirstRun = !state._inpaintLoaded;
    const loadingToast = ui.toast(
      isFirstRun
        ? i18n.t("toast.inpaintFirstRun")
        : i18n.t("toast.inpaintRunning"),
      "running",
      0,
    );

    try {
      const model = models.selectedModel("inpaint") || "lama_manga";
      log.debug(
        "fe",
        `inpaint: start model=${model} boxes=${page.textDetections.length}`,
      );
      const masks = await createMasks(page, model);
      log.debug("fe", `inpaint: done ${masks.length} patch(es)`);

      // Replace previous masks (re-run = fresh set of patches).
      page.inpaintMasks = masks;
      page._cleanOnlyProcessed = true;
      state._inpaintLoaded = true;
      invalidateComposite(page.fileName);

      canvas.render();
      sidebar.render();
      history.snapshot();
      ui.dismissToast(loadingToast);
      ui.toast(
        i18n.t("toast.inpaintDone", { count: masks.length }),
        "success",
        3000,
      );
    } catch (err) {
      log.error("fe", `Inpaint: ${err}`);
      ui.dismissToast(loadingToast);
      ui.toast(
        (err as Error).message || i18n.t("toast.inpaintFailed"),
        "error",
      );
    } finally {
      state.isRunning = false;
    }
  },

  /** Clean all pages sequentially, reporting skips and failures together. */
  runAll: async function (): Promise<void> {
    if (state.isRunning || state.pages.length === 0) return;
    state.isRunning = true;
    const button = document.getElementById(
      "btn-inpaint",
    ) as HTMLButtonElement | null;
    if (button) button.disabled = true;
    let progressToast: ReturnType<typeof ui.toast> | null = null;
    const failed: string[] = [];
    let completed = 0;
    try {
      const model = models.selectedModel("inpaint") || "lama_manga";
      for (let i = 0; i < state.pages.length; i++) {
        const page = state.pages[i];
        const alreadyProcessed =
          page._cleanOnlyProcessed ??
          (page.inpaintMasks.length > 0 && !page._cleanOnlyDetectionDone);
        if (alreadyProcessed || !page._cleanOnlyDetectionDone) continue;
        ui.dismissToast(progressToast);
        progressToast = ui.toast(
          i18n.t("toast.batchProgress", {
            current: i + 1,
            total: state.pages.length,
            stage: i18n.t("header.inpaint"),
          }),
          "running",
          0,
        );
        if (!page.textDetections.length) {
          page._cleanOnlyProcessed = true;
          history.snapshotPage(page);
          completed++;
          continue;
        }
        try {
          page.inpaintMasks = await createMasks(page, model);
          state._inpaintLoaded = true;
          page._cleanOnlyProcessed = true;
          invalidateComposite(page.fileName);
          history.snapshotPage(page);
          completed++;
        } catch (err) {
          failed.push(page.fileName);
          log.error("fe", `Inpaint page ${i + 1} (${page.fileName}): ${err}`);
        }
      }
      ui.dismissToast(progressToast);
      progressToast = null;
      canvas.render();
      sidebar.render();
      if (failed.length) {
        ui.toast(
          i18n.t("toast.batchPartial", {
            stage: i18n.t("header.inpaint"),
            completed,
            files: failed.join(", "),
          }),
          completed ? "warn" : "error",
          6000,
        );
      } else if (completed > 0) {
        ui.toast(
          i18n.t("toast.batchDone", {
            stage: i18n.t("header.inpaint"),
            count: completed,
          }),
          "success",
          3000,
        );
      }
    } finally {
      ui.dismissToast(progressToast);
      state.isRunning = false;
      if (button) button.disabled = false;
    }
  },
};
