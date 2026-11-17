import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export function PdfResumePreview({
  id,
  title,
  text,
  stale = false,
  revealRequest = 0,
  previewId = "profile-resume-pdf",
  staleMessage,
  onEdit,
  targetPages,
}: {
  id: string;
  title: string;
  text: string;
  stale?: boolean;
  revealRequest?: number;
  previewId?: string;
  staleMessage?: string;
  onEdit?: () => void;
  targetPages?: number;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [url, setUrl] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [rendering, setRendering] = useState(false),
    [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState("fit");
  const [paperWidth, setPaperWidth] = useState(612);
  const [renderedPage, setRenderedPage] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const section = useRef<HTMLElement>(null);
  const lastReveal = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let blobUrl = "";
    let task: PDFDocumentLoadingTask | undefined;
    setLoading(true);
    setPdf(null);
    setError("");
    setUrl("");
    setPage(1);
    setRenderedPage(0);
    void (async () => {
      try {
        const response = await fetch(
          "/api/career/resumes/" + id + "/export?format=pdf&inline=true",
          { signal: controller.signal },
        );
        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({ detail: "PDF export failed." }));
          throw new Error(body.detail || "PDF export failed.");
        }
        if (!response.headers.get("content-type")?.includes("application/pdf"))
          throw new Error(
            "The backend did not return a PDF. Restart the updated application.",
          );
        const blob = await response.blob();
        if (!active) return;
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        if (!active) return;
        GlobalWorkerOptions.workerSrc = workerUrl;
        blobUrl = URL.createObjectURL(blob);
        task = getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        const document = await task.promise;
        if (!active) return;
        setPdf(document);
        setUrl(blobUrl);
      } catch (e) {
        if (active)
          setError(
            e instanceof TypeError
              ? "Cannot reach the PDF service. Keep Zynvixs.bat running and retry."
              : String(e),
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (task) void task.destroy().catch(() => {});
    };
  }, [id, retry]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let render: RenderTask | undefined;
    setRendering(true);
    void (async () => {
      try {
        const source = await pdf.getPage(page);
        if (!active || !canvas.current) return;
        setPaperWidth(source.getViewport({ scale: 1 }).width);
        const viewport = source.getViewport({ scale: 1.5 });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = source.render({ canvas: canvas.current, viewport });
        await render.promise;
        if (active) setRenderedPage(page);
      } catch (e) {
        if (active) setError("PDF rendering failed: " + String(e));
      } finally {
        if (active) setRendering(false);
      }
    })();
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page]);
  useEffect(() => {
    if (
      pdf &&
      !loading &&
      !rendering &&
      !error &&
      renderedPage === page &&
      revealRequest > lastReveal.current
    ) {
      section.current?.scrollIntoView({ behavior: "auto", block: "start" });
      lastReveal.current = revealRequest;
    }
  }, [pdf, loading, rendering, error, renderedPage, page, revealRequest]);
  return (
    <section
      ref={section}
      className="pdf-resume-panel"
      id={previewId}
      aria-label="Resume PDF preview"
      data-pdf-ready={
        !loading && !rendering && !!pdf && !error && renderedPage === page
      }
    >
      <small>STEP 2 · REVIEW YOUR ACTUAL PDF</small>
      <h2>{title}</h2>
      <p>
        This is the saved PDF, not an image mockup. Check your details before
        downloading.
      </p>
      {stale && (
        <p role="status" className="connection-note">
          {staleMessage ||
            "Your information has changed. Click Save info & preview resume PDF again to create and download an updated version."}
        </p>
      )}
      {loading && <p role="status">Creating PDF preview…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry PDF preview
          </button>
        </p>
      )}
      {pdf && !error && (
        <>
          {targetPages && pdf.numPages !== targetPages && (
            <p role="status" className="pdf-length-status">
              Actual length: {pdf.numPages} pages; requested target:{" "}
              {targetPages}. Page count depends on supplied facts, model output
              and paper layout. No facts or blank pages are added to fill the
              target.
            </p>
          )}
          <div className="pdf-toolbar">
            <button
              disabled={rendering || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous page
            </button>
            <span>
              Page {page} of {pdf.numPages}
            </span>
            <button
              disabled={rendering || page >= pdf.numPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next page
            </button>
          </div>
          <div className="pdf-view-controls">
            <label>
              Go to page
              <select
                aria-label="Go to PDF page"
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              >
                {Array.from({ length: pdf.numPages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Page {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preview zoom
              <select
                aria-label="PDF preview zoom"
                value={zoom}
                onChange={(e) => setZoom(e.target.value)}
              >
                <option value="fit">Fit to width</option>
                {[75, 100, 125, 150].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="pdf-page-browser">
            <nav className="pdf-thumbnails" aria-label="PDF page thumbnails">
              {Array.from({ length: pdf.numPages }, (_, i) => (
                <PdfThumbnail
                  key={i + 1}
                  pdf={pdf}
                  number={i + 1}
                  selected={page === i + 1}
                  onSelect={() => setPage(i + 1)}
                />
              ))}
            </nav>
            <div
              className="pdf-canvas-wrap"
              style={
                {
                  "--pdf-zoom-width":
                    zoom === "fit"
                      ? "100%"
                      : `${(Number(zoom) * paperWidth) / 100}px`,
                } as React.CSSProperties
              }
            >
              <canvas
                ref={canvas}
                role="img"
                aria-label={"Resume PDF page " + page}
              />
            </div>
          </div>
          {rendering && <p role="status">Rendering page…</p>}
        </>
      )}
      <div className="pdf-download-actions">
        <button
          type="button"
          onClick={() =>
            onEdit
              ? onEdit()
              : document
                  .getElementById("profile-resume-form")
                  ?.scrollIntoView({ block: "start" })
          }
        >
          {onEdit ? "Edit resume draft" : "Edit your information"}
        </button>
        <button
          type="button"
          className={"pdf-download-button " + (!url || stale ? "disabled" : "")}
          disabled={!url || stale}
          aria-disabled={!url || stale}
          onClick={() => {
            if (!url || stale) return;
            const a = document.createElement("a");
            a.href = url;
            a.download = "resume.pdf";
            document.body.append(a);
            a.click();
            a.remove();
          }}
        >
          Download resume PDF
        </button>
        {url && !stale && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open PDF full size ↗
          </a>
        )}
      </div>
      <details>
        <summary>Read saved resume text</summary>
        <pre>{text}</pre>
      </details>
    </section>
  );
}

function PdfThumbnail({
  pdf,
  number,
  selected,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    let task: RenderTask | undefined;
    void pdf
      .getPage(number)
      .then(async (source) => {
        if (!active || !ref.current) return;
        const viewport = source.getViewport({ scale: 0.16 });
        ref.current.width = viewport.width;
        ref.current.height = viewport.height;
        task = source.render({ canvas: ref.current, viewport });
        await task.promise;
      })
      .catch(() => {});
    return () => {
      active = false;
      task?.cancel();
    };
  }, [pdf, number]);
  return (
    <button
      type="button"
      aria-label={`Preview page ${number}`}
      aria-current={selected ? "page" : undefined}
      onClick={onSelect}
    >
      <canvas ref={ref} aria-hidden="true" />
      <span>{number}</span>
    </button>
  );
}
