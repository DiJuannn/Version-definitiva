"use client";

import { askQuestionsAction, readStoryAction } from "@/lib/actions/screenplay-ai";
import { useYMap } from "@/lib/screenplay/use-ymap";
import type { Questions, StoryReading } from "@/lib/screenplay/story";
import { AiButton, InlineText, SectionLabel, useWorkspace } from "@/components/screenplay/workspace";

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Lo que la IA entiende de la historia. El equipo lo corrige en el sitio:
// esa versión corregida es la que la IA usa después para referencias y
// preguntas. La IA nunca toca el guion.
export function StoryView() {
  const { screenplayId, maps, userName } = useWorkspace();
  const ai = useYMap<unknown>(maps.ai);
  const reading = ai.reading as StoryReading | undefined;
  const questions = ai["q:script"] as Questions | undefined;

  const edit = (patch: Partial<StoryReading>) => {
    const prev = maps.ai.get("reading") as StoryReading | undefined;
    if (prev) maps.ai.set("reading", { ...prev, ...patch, editedBy: userName });
  };

  return (
    <div className="grid gap-14 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 max-w-3xl">
        {!reading ? (
          <div className="py-6">
            <p className="font-display text-2xl font-black tracking-tight uppercase">¿De qué va tu historia?</p>
            <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted">
              La IA lee el guion entero y te cuenta lo que ha entendido: premisa, temas, tono, qué quiere cada personaje y en qué punto
              está la historia. Si algo no es así, lo corriges aquí, y a partir de ahí todas sus ayudas parten de tu versión. No escribe
              nada en el guion.
            </p>
            <AiButton className="mt-6" label="Leer el guion" run={async () => {
              const res = await readStoryAction(screenplayId);
              if (res.ok) maps.ai.set("reading", res.reading);
              return res;
            }} />
          </div>
        ) : (
          <article>
            <p className="font-mono text-[10px] tracking-[0.2em] text-warn uppercase">
              Lectura de la IA · {dateFmt.format(reading.at)}
              {reading.editedBy && <span className="text-muted"> · corregida por {reading.editedBy}</span>}
            </p>
            <InlineText
              label="Premisa"
              value={reading.premise}
              onSave={(v) => edit({ premise: v })}
              placeholder="Premisa"
              rows={3}
              className="mt-4 font-display text-2xl leading-snug font-bold tracking-tight sm:text-3xl"
            />
            <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-3">
              {(
                [
                  ["Temas", reading.themes.join(", "), (v: string) => edit({ themes: v.split(",").map((t) => t.trim()).filter(Boolean) })],
                  ["Tono", reading.tone, (v: string) => edit({ tone: v })],
                  ["Género", reading.genre, (v: string) => edit({ genre: v })],
                ] as const
              ).map(([label, value, save]) => (
                <div key={label}>
                  <dt className="font-mono text-[10px] tracking-widest text-muted uppercase">{label}</dt>
                  <dd className="mt-1.5">
                    <InlineText label={label} value={value} onSave={save} placeholder="—" rows={2} className="font-sans text-sm" />
                  </dd>
                </div>
              ))}
            </dl>

            <section className="mt-12">
              <SectionLabel>Personajes</SectionLabel>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr className="font-mono text-[10px] tracking-widest text-muted uppercase">
                    <th className="py-2 pr-4 font-normal">Personaje</th>
                    <th className="py-2 pr-4 font-normal">Quiere</th>
                    <th className="py-2 pr-4 font-normal">Se lo impide</th>
                    <th className="py-2 font-normal">Arco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {reading.characters.map((c, i) => (
                    <tr key={c.name}>
                      <td className="py-3 pr-4 font-[family-name:var(--font-courier)] text-xs font-bold uppercase">{c.name}</td>
                      {(["want", "obstacle", "arc"] as const).map((k) => (
                        <td key={k} className="py-2 pr-4">
                          <InlineText
                            label={`${c.name} ${k}`}
                            value={c[k]}
                            rows={2}
                            placeholder="—"
                            className="font-sans text-[13px] leading-relaxed"
                            onSave={(v) => edit({ characters: reading.characters.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="mt-12">
              <SectionLabel>En qué punto está</SectionLabel>
              <InlineText
                label="Estructura"
                value={reading.structure}
                onSave={(v) => edit({ structure: v })}
                placeholder="—"
                rows={4}
                className="mt-3 font-sans text-sm leading-relaxed"
              />
            </section>

            <section className="mt-12">
              <SectionLabel>Preguntas que tu guion deja abiertas al público</SectionLabel>
              <ul className="mt-3 space-y-2">
                {reading.openQuestions.map((q, i) => (
                  <li key={i} className="flex gap-3 font-sans text-sm leading-relaxed">
                    <span className="font-mono text-xs text-warn">?</span>
                    {q}
                  </li>
                ))}
              </ul>
            </section>

            <AiButton
              className="mt-12"
              label="Volver a leer el guion"
              run={async () => {
                const res = await readStoryAction(screenplayId);
                if (res.ok) maps.ai.set("reading", res.reading);
                return res;
              }}
            />
          </article>
        )}
      </div>

      <aside>
        <SectionLabel>¿No sabes cómo seguir?</SectionLabel>
        <p className="mt-3 font-sans text-[13px] leading-relaxed text-muted">
          Preguntas sobre la historia entera, a partir de donde la has dejado. Las respuestas son tuyas.
        </p>
        {questions && (
          <ol className="mt-4 space-y-3">
            {questions.items.map((q, i) => (
              <li key={i} className="flex gap-2.5 font-sans text-sm leading-relaxed">
                <span className="font-mono text-xs text-warn">?</span>
                {q}
              </li>
            ))}
          </ol>
        )}
        <AiButton
          className="mt-5"
          label={questions ? "Otras preguntas" : "Hazme preguntas"}
          pendingLabel="Pensando preguntas…"
          run={async () => {
            const res = await askQuestionsAction(screenplayId, null);
            if (res.ok) maps.ai.set("q:script", res.questions);
            return res;
          }}
        />
        <p className="mt-10 font-mono text-[10px] leading-relaxed text-muted">
          Para leerlo, el texto del guion se envía a la IA (Mistral). Nunca escribe en tu guion.
        </p>
      </aside>
    </div>
  );
}
