import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import {
  createPortfolioItem,
  createServiceItem,
  deletePortfolioItem,
  deleteServiceItem,
  updatePortfolioItem,
  updateServiceItem,
  updateSiteContent,
} from "@/lib/actions/site-content";
import { FeatureIntro } from "@/components/FeatureIntro";
import { HelpTip } from "@/components/HelpTip";

const fieldClass =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const smallFieldClass =
  "border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent";
const submitClass =
  "rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/app/login");

  const site = await prisma.siteContent.upsert({
    where: { organizationId: profile.organizationId },
    create: { organizationId: profile.organizationId },
    update: {},
    include: {
      services: { orderBy: { order: "asc" } },
      portfolioItems: { orderBy: { order: "asc" } },
    },
  });

  return (
    <div>
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        Editor de la web pública
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold uppercase">
        Contenido de versiondefinitiva.com
      </h1>

      <FeatureIntro featureId="site-admin">
        Todo lo que cambies aquí se refleja al instante en la web pública —
        no hace falta tocar código. Cada sección se guarda por separado.
      </FeatureIntro>

      <section className="mt-10 border border-line p-6">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Portada
        </p>
        <form action={updateSiteContent} className="mt-4 grid gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Título grande
            </span>
            <textarea
              name="heroTitle"
              defaultValue={site.heroTitle}
              rows={2}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Subtítulo
            </span>
            <input
              name="heroSubtitle"
              defaultValue={site.heroSubtitle}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
              Palabras de la cinta animada
              <HelpTip text="Se muestran en el banderín que se desliza justo debajo de la portada. Sepáralas con comas." />
            </span>
            <input
              name="marqueeTags"
              defaultValue={site.marqueeTags.join(", ")}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Pregunta destacada (sección Sobre nosotros)
            </span>
            <input
              name="aboutQuestion"
              defaultValue={site.aboutQuestion}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Texto Sobre nosotros
            </span>
            <textarea
              name="aboutText"
              defaultValue={site.aboutText}
              rows={3}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Email de contacto
            </span>
            <input
              name="contactEmail"
              type="email"
              defaultValue={site.contactEmail}
              className={fieldClass}
            />
          </label>

          <div className="mt-2 border-t border-line pt-4">
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-xs tracking-widest text-accent uppercase">
                Datos legales
              </p>
              <HelpTip text="Obligatorios por ley (Aviso Legal) antes de publicar la web de verdad. Sin esto, las páginas de Aviso Legal / Privacidad mostrarán un aviso de 'pendiente de completar'." />
            </div>
            <div className="mt-3 grid gap-4">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  Nombre legal (tu nombre o el de la empresa)
                </span>
                <input
                  name="legalName"
                  defaultValue={site.legalName ?? ""}
                  placeholder="Ej. Juan Molina Pérez, o Versión Definitiva S.L."
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  NIF / CIF
                </span>
                <input
                  name="legalTaxId"
                  defaultValue={site.legalTaxId ?? ""}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  Domicilio (a efectos legales)
                </span>
                <input
                  name="legalAddress"
                  defaultValue={site.legalAddress ?? ""}
                  className={fieldClass}
                />
              </label>
            </div>
          </div>

          <div>
            <button type="submit" className={submitClass}>
              Guardar portada
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Servicios
        </p>
        <div className="mt-4 space-y-4">
          {site.services.map((service) => (
            <form
              key={service.id}
              action={updateServiceItem.bind(null, service.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
            >
              <input
                name="title"
                defaultValue={service.title}
                required
                className={smallFieldClass}
              />
              <input
                name="description"
                defaultValue={service.description}
                className={smallFieldClass}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </button>
                <button
                  formAction={deleteServiceItem.bind(null, service.id)}
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Eliminar
                </button>
              </div>
              <textarea
                name="details"
                defaultValue={service.details ?? ""}
                placeholder="Detalles extra (opcional) — aparecen al desplegar este servicio en la web"
                rows={2}
                className={smallFieldClass + " sm:col-span-3"}
              />
            </form>
          ))}
        </div>
        <form
          action={createServiceItem}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input name="title" placeholder="Título (ej. Ficción)" required className={smallFieldClass} />
          <input name="description" placeholder="Descripción breve" className={smallFieldClass} />
          <button
            type="submit"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
          >
            Añadir
          </button>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Portfolio / Cortos
          </p>
          <HelpTip text="El vídeo se enlaza desde YouTube o Vimeo — pega la URL normal (por ejemplo, la de la barra de direcciones al ver el vídeo) y se incrusta solo. No hace falta subir ningún archivo de vídeo aquí. Marca 'Destacado' en como mucho una pieza — es la que aparece grande arriba del todo." />
        </div>
        <div className="mt-4 space-y-4">
          {site.portfolioItems.map((item) => (
            <form
              key={item.id}
              action={updatePortfolioItem.bind(null, item.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-2"
            >
              <input
                name="title"
                defaultValue={item.title}
                placeholder="Título"
                required
                className={smallFieldClass}
              />
              <input
                name="category"
                defaultValue={item.category ?? ""}
                placeholder="Categoría (ej. Ficción)"
                className={smallFieldClass}
              />
              <input
                name="videoUrl"
                defaultValue={item.videoUrl ?? ""}
                placeholder="URL de YouTube o Vimeo"
                className={smallFieldClass + " sm:col-span-2"}
              />
              <input
                name="description"
                defaultValue={item.description ?? ""}
                placeholder="Descripción breve (opcional)"
                className={smallFieldClass + " sm:col-span-2"}
              />
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 font-mono text-xs">
                  <input type="checkbox" name="featured" defaultChecked={item.featured} />
                  Destacado
                </label>
                <label className="flex items-center gap-2 font-mono text-xs">
                  <input type="checkbox" name="published" defaultChecked={item.published} />
                  Publicado
                </label>
                <button
                  type="submit"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </button>
                <button
                  formAction={deletePortfolioItem.bind(null, item.id)}
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Eliminar
                </button>
              </div>
            </form>
          ))}
        </div>
        <form
          action={createPortfolioItem}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-2"
        >
          <input name="title" placeholder="Título" required className={smallFieldClass} />
          <input name="category" placeholder="Categoría" className={smallFieldClass} />
          <input
            name="videoUrl"
            placeholder="URL de YouTube o Vimeo (opcional)"
            className={smallFieldClass + " sm:col-span-2"}
          />
          <div>
            <button
              type="submit"
              className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
            >
              Añadir pieza
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
