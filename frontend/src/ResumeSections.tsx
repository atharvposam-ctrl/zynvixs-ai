import { useState, useRef, useEffect } from "react";
import { Markdown } from "./components/Markdown";
export function ResumeSections({
  text,
  onChange,
  showPreview = true,
}: {
  text: string;
  onChange: (text: string) => void;
  showPreview?: boolean;
}) {
  function parse(source: string) {
    const chunks = source.split(/(?=^#{1,3}\s)/m).filter((x) => x.trim());
    const sections = (chunks.length ? chunks : [""]).map((chunk) => {
      const match = chunk.match(/^(#{1,3})\s+([^\n]*)\n?([\s\S]*)$/);
      return match
        ? { level: match[1].length, title: match[2], body: match[3].trim() }
        : { level: 0, title: "", body: chunk.trim() };
    });
    return sections;
  }
  const [sections, setSections] = useState(() => parse(text));
  const emitted = useRef(text);
  useEffect(() => {
    if (text !== emitted.current) {
      setSections(parse(text));
      emitted.current = text;
    }
  }, [text]);
  function save(next: typeof sections) {
    setSections(next);
    const changed = next
      .map(
        (s) =>
          (s.title ? "#".repeat(s.level || 2) + " " + s.title + "\n" : "") +
          s.body,
      )
      .join("\n\n");
    emitted.current = changed;
    onChange(changed);
  }
  return (
    <details className="workflow-panel">
      <summary>Edit resume sections & preview</summary>
      <p>
        Heading-based sections preserve the source text. Changes stay in the
        editor until you save a new version.
      </p>
      {sections.map((section, i) => (
        <fieldset key={i}>
          <legend>Section {i + 1}</legend>
          <label>
            Section heading
            <input
              aria-label={"Resume section " + (i + 1) + " heading"}
              value={section.title}
              onChange={(e) =>
                save(
                  sections.map((s, k) =>
                    k === i ? { ...s, title: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          <label>
            Section content
            <textarea
              aria-label={"Resume section " + (i + 1) + " content"}
              value={section.body}
              onChange={(e) =>
                save(
                  sections.map((s, k) =>
                    k === i ? { ...s, body: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Remove this section from the editor? Existing saved versions are retained.",
                )
              )
                save(sections.filter((_, k) => k !== i));
            }}
          >
            Remove section from editor
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          save([...sections, { level: 2, title: "New section", body: "" }])
        }
      >
        Add resume section
      </button>
      {showPreview && (
        <>
          <h3>Document preview</h3>
          <div className="resume-preview">
            <Markdown text={text} />
          </div>
        </>
      )}
    </details>
  );
}
