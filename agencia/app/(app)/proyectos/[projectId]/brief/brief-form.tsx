"use client";

import { useState } from "react";
import { saveBriefAction } from "@/app/actions/work";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/field";
import { BRIEF_FIELDS, briefSections, missingBriefFields, type BriefData } from "@/lib/domain/brief";
import { useDraft } from "@/components/review/use-draft";
import { cx } from "@/components/ui/cx";

/** Brief guiado por secciones. Guarda borrador local mientras escribes y en servidor al pulsar. */
export function BriefForm({ projectId, data, submitted }: { projectId: string; data: BriefData; submitted: boolean }) {
  const [values, setValues, clearLocal] = useDraft<BriefData>(`corte:brief:${projectId}`, data);
  const [section, setSection] = useState(0);
  const sections = briefSections();
  const missing = missingBriefFields(values);
  return (
    <ActionForm action={saveBriefAction} onSuccess={() => clearLocal()} className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <input type="hidden" name="projectId" value={projectId} />
      <nav aria-label="Secciones del brief" className="flex gap-1 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:self-start">
        {sections.map(([name, fields], i) => {
          const pending = fields.filter((f) => f.required && !values[f.key]?.trim()).length;
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSection(i);
                document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cx("flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap", section === i ? "bg-surface font-medium shadow-sm" : "text-ink-2 hover:bg-black/5")}
            >
              {name}
              {pending > 0 ? <span className="rounded-full bg-[var(--tone-attention-bg)] px-1.5 text-[11px] text-[var(--tone-attention)]">{pending}</span> : <span className="text-[11px] text-[var(--tone-success)]">✓</span>}
            </button>
          );
        })}
      </nav>
      <div className="flex flex-col gap-5">
        {sections.map(([name, fields], i) => (
          <section key={name} id={`sec-${i}`} className="scroll-mt-6 rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-4 font-display text-lg font-bold">{name}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const id = `b-${f.key}`;
                const common = {
                  id,
                  name: f.key,
                  value: values[f.key] ?? "",
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [f.key]: e.target.value })),
                  placeholder: f.hint,
                };
                const multiline = "multiline" in f && f.multiline;
                return (
                  <Field key={f.key} label={f.label} htmlFor={id} optional={!f.required} className={multiline ? "sm:col-span-2" : undefined}>
                    {multiline ? <Textarea rows={3} {...common} /> : <Input type={"type" in f && f.type === "date" ? "date" : "text"} {...common} />}
                  </Field>
                );
              })}
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 px-1 py-3 backdrop-blur">
          <SubmitButton variant="secondary" name="intent" value="draft" pendingLabel="Guardando…">
            Guardar borrador
          </SubmitButton>
          <SubmitButton name="intent" value="submit" pendingLabel="Enviando…">
            {submitted ? "Guardar cambios" : "Enviar brief"}
          </SubmitButton>
          <p className="text-[13px] text-ink-3">
            {missing.length ? `Para enviarlo falta: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.` : "Tiene todo lo imprescindible."}
          </p>
        </div>
        <p className="sr-only">{BRIEF_FIELDS.length} campos</p>
      </div>
    </ActionForm>
  );
}
