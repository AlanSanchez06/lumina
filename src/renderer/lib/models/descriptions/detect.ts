/** Bilingual model descriptions — Text Detection. */
import type { ModelDescMap } from "./index";

export const DETECT_DESCS: ModelDescMap = {
  rtdetr: {
    en: `RT-DETR v2 r50vd fine-tuned on comics (by ogkalu) — detects text boxes and speech bubbles on manga pages with high accuracy.

• The default detector — Apache-2.0 licensed, safe to use for any purpose.
• Fast box-only detection, no segmentation mask output.
• Works reliably on clean pages as well as pages with screentones.
• Inpainting falls back to heuristic (Otsu) masking inside each box.
• Source: huggingface.co/ogkalu/comic-text-and-bubble-detector`,
    es: `RT-DETR v2 r50vd ajustado con cómics (por ogkalu): detecta con gran precisión cuadros de texto y globos de diálogo en páginas de manga.

• Detector predeterminado, con licencia Apache-2.0 y apto para cualquier uso.
• Detección rápida de cuadros; no genera máscaras de segmentación.
• Funciona bien tanto en páginas limpias como en páginas con tramas.
• La limpieza usa una máscara heurística (Otsu) dentro de cada cuadro.
• Fuente: huggingface.co/ogkalu/comic-text-and-bubble-detector`,
    id: `RT-DETR v2 r50vd yang di-fine-tune pada dataset komik (oleh ogkalu) — mendeteksi kotak teks dan gelembung ucapan pada halaman manga dengan akurasi tinggi.

• Detektor default — berlisensi Apache-2.0, aman dipakai untuk tujuan apa pun.
• Deteksi kotak yang cepat, tanpa output mask segmentasi.
• Bekerja andal pada halaman bersih maupun halaman berscreentone.
• Inpainting memakai masking heuristik (Otsu) di dalam setiap kotak.
• Sumber: huggingface.co/ogkalu/comic-text-and-bubble-detector`,
  },
  rfdetr_seg: {
    en: `Koharu Layout RF-DETR Seg 2XL (1152px, by ShiniShiho) — segmentation model that outputs precise per-text instance masks.

• Best-quality segmentation, but trained on the Manga109 dataset — academic/research use only (see License).
• Produces a full-page binary text mask, so inpainting erases exactly the glyph pixels instead of a rough box — much better on colorful and detailed pages.
• Onomatopoeia/SFX are deliberately kept as artwork, only text is erased.
• Slower on CPU (~10-30s/page).
• Source: huggingface.co/ShiniShiho/koharu-layout-rfdetr-seg-2xl-1152-onnx`,
    es: `Koharu Layout RF-DETR Seg 2XL (1152 px, por ShiniShiho): modelo de segmentación que genera máscaras precisas para cada instancia de texto.

• Segmentación de alta calidad, pero se entrenó con Manga109; su uso está limitado a fines académicos y de investigación (consulta la licencia).
• Genera una máscara binaria de texto para toda la página; así, la limpieza elimina los píxeles de las letras en vez de cubrir un cuadro aproximado. Mejora notablemente el resultado en páginas coloridas y detalladas.
• Conserva deliberadamente las onomatopeyas y los efectos de sonido como parte de la ilustración; solo elimina el texto.
• Más lento en CPU: aproximadamente 10–30 s por página.
• Fuente: huggingface.co/ShiniShiho/koharu-layout-rfdetr-seg-2xl-1152-onnx`,
    id: `Koharu Layout RF-DETR Seg 2XL (1152px, oleh ShiniShiho) — model segmentasi yang menghasilkan mask per-teks yang presisi.

• Segmentasi kualitas terbaik, tetapi dilatih pada dataset Manga109 — khusus penggunaan akademik/riset (lihat License).
• Menghasilkan mask teks biner satu halaman penuh, sehingga inpainting menghapus tepat piksel huruf, bukan kotak kasar — jauh lebih baik pada halaman berwarna dan detail.
• Onomatope/SFX sengaja dipertahankan sebagai artwork, hanya teks yang dihapus.
• Lebih lambat di CPU (~10-30 detik/halaman).
• Sumber: huggingface.co/ShiniShiho/koharu-layout-rfdetr-seg-2xl-1152-onnx`,
  },
};
