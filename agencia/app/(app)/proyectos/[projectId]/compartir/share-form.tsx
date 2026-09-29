"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { createShareAction } from "@/app/actions/work";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

type P = { id: string; title: string; versions: { id: string; number: number }[] };

export function ShareForm({ projectId, pieces, defaultPieceId, defaultVersionId }: { projectId: string; pieces: P[]; defaultPieceId?: string; defaultVersionId?: string }) {
  const [scope, setScope] = useState<"PROJECT" | "PIECE" | "VERSION">(defaultVersionId ? "VERSION" : defaultPieceId ? "PIECE" : "PROJECT");
  const [pieceId, setPieceId] = useState(defaultPieceId ?? pieces[0]?.id ?? "");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const piece = pieces.find((p) => p.id === pieceId);
  return (
    <div className="p-4">
      {created && (
        <div className="mb-4 rounded-md border border-[var(--tone-success)]/30 bg-[var(--tone-success-bg)] p-3">
          <p className="text-[13px] font-medium text-[var(--tone-success)]">Enlace creado. Cópialo ahora: no se volverá a mostrar completo.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={created} className="h-9 flex-1 rounded border border-line bg-white px-2 font-mono text-[12px]" aria-label="Enlace de revisión" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className={buttonClass("secondary", "md")}
              onClick={async () => {
                await navigator.clipboard?.writeText(created).catch(() => {});
                setCopied(true);
              }}
            >
              <Copy className="size-4" /> {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
      <ActionForm
        action={createShareAction}
        showMessage={false}
        onSuccess={(s) => {
          setCopied(false);
          setCreated(`${window.location.origin}/r/${String(s?.data?.token)}`);
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <Field label="Nombre interno" htmlFor="s-name" hint="Para reconocerlo luego, p. ej. «Marta — reel otoño».">
          <Input id="s-name" name="name" required />
          <FieldError name="name" />
        </Field>
        <Field label="Alcance" htmlFor="s-scope">
          <Select id="s-scope" name="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="PROJECT">Todo el proyecto (piezas publicadas)</option>
            <option value="PIECE">Una pieza (todas sus versiones publicadas)</option>
            <option value="VERSION">Una versión concreta</option>
          </Select>
        </Field>
        {scope !== "PROJECT" && (
          <Field label="Pieza" htmlFor="s-piece">
            <Select id="s-piece" name="pieceId" value={pieceId} onChange={(e) => setPieceId(e.target.value)}>
              {pieces.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
        )}
        {scope === "VERSION" && (
          <Field label="Versión" htmlFor="s-version" hint={piece?.versions.length ? undefined : "Esta pieza no tiene versiones publicadas."}>
            <Select id="s-version" name="versionId" defaultValue={defaultVersionId}>
              {piece?.versions.map((v) => (
                <option key={v.id} value={v.id}>V{v.number}</option>
              ))}
            </Select>
          </Field>
        )}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-[13px] font-medium">Permisos</legend>
          <Checkbox name="canComment" label="Comentar y dibujar" defaultChecked />
          <Checkbox name="canApprove" label="Aprobar o pedir cambios" hint="Exige identificarse con nombre y email." />
          <Checkbox name="canDownload" label="Descargar entregas y versiones" />
          <Checkbox name="requireIdentity" label="Pedir nombre y email" defaultChecked />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Caduca en" htmlFor="s-exp">
            <Select id="s-exp" name="expiresInDays" defaultValue="30">
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="">No caduca</option>
            </Select>
          </Field>
          <Field label="Contraseña" htmlFor="s-pw" optional>
            <Input id="s-pw" name="password" type="text" autoComplete="off" />
          </Field>
        </div>
        <Field label="Restringir a un dominio de email" htmlFor="s-domain" optional hint="Por ejemplo: cafenorte.com">
          <Input id="s-domain" name="allowedDomain" placeholder="empresa.com" />
          <FieldError name="allowedDomain" />
        </Field>
        <FieldError name="_" />
        <div>
          <SubmitButton pendingLabel="Creando…">Crear enlace</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
