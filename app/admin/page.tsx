import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { creditsToText } from "@/lib/credits";
import {
  createEquipmentItem,
  createFaqItem,
  createPortfolioItem,
  createProcessStep,
  createProjectImage,
  createServiceItem,
  createTeamMember,
  createTestimonial,
  deleteEquipmentItem,
  deleteFaqItem,
  deletePortfolioItem,
  deleteProcessStep,
  deleteProjectImage,
  deleteServiceItem,
  deleteTeamMember,
  deleteTestimonial,
  updateEquipmentItem,
  updateFaqItem,
  updatePortfolioItem,
  updateProcessStep,
  updateServiceItem,
  updateSiteContent,
  updateTeamMember,
  updateTestimonial,
} from "@/lib/actions/site-content";
import { DeleteButton } from "@/components/DeleteButton";
import { FeatureIntro } from "@/components/FeatureIntro";
import { HelpTip } from "@/components/HelpTip";
import { SubmitButton } from "@/components/SubmitButton";

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
      portfolioItems: {
        orderBy: { order: "asc" },
        include: { images: { orderBy: { order: "asc" } } },
      },
      teamMembers: { orderBy: { order: "asc" } },
      processSteps: { orderBy: { order: "asc" } },
      faqItems: { orderBy: { order: "asc" } },
      equipmentItems: { orderBy: { order: "asc" } },
      testimonials: { orderBy: { order: "asc" } },
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
              Fotografía de fondo del hero
              <HelpTip text="URL de una fotografía real de rodaje, panorámica (16:9 o más ancha). Sin esto, el hero se queda con el fondo con grano de siempre." />
            </span>
            <input
              name="heroImageUrl"
              defaultValue={site.heroImageUrl ?? ""}
              placeholder="https://…"
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
            <SubmitButton
              pendingLabel="Guardando…"
              savedLabel="✓ Guardado"
              className={submitClass}
            >
              Guardar portada
            </SubmitButton>
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
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deleteServiceItem.bind(null, service.id)}
                  confirmMessage="¿Eliminar este servicio de la web? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>
              <textarea
                name="details"
                defaultValue={service.details ?? ""}
                placeholder="Detalles extra (opcional) — aparecen al desplegar este servicio en la web"
                rows={2}
                className={smallFieldClass + " sm:col-span-3"}
              />
              <input
                name="imageUrl"
                defaultValue={service.imageUrl ?? ""}
                placeholder="URL de fotografía asociada (opcional) — aparece al pasar el ratón por este servicio"
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
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadido"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
          >
            Añadir
          </SubmitButton>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Cómo trabajamos
          </p>
          <HelpTip text="Pasos del proceso, en orden (Brief, Preproducción, Rodaje...). Aparece como sección propia en la web, justo después de Servicios." />
        </div>
        <div className="mt-4 space-y-4">
          {site.processSteps.map((step) => (
            <form
              key={step.id}
              action={updateProcessStep.bind(null, step.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
            >
              <input
                name="title"
                defaultValue={step.title}
                placeholder="Título (ej. Brief)"
                required
                className={smallFieldClass}
              />
              <textarea
                name="description"
                defaultValue={step.description}
                placeholder="Descripción"
                rows={2}
                required
                className={smallFieldClass}
              />
              <div className="flex gap-3">
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deleteProcessStep.bind(null, step.id)}
                  confirmMessage="¿Eliminar este paso? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>
            </form>
          ))}
        </div>
        <form
          action={createProcessStep}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input name="title" placeholder="Título" required className={smallFieldClass} />
          <textarea
            name="description"
            placeholder="Descripción"
            rows={2}
            required
            className={smallFieldClass}
          />
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadido"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
          >
            Añadir
          </SubmitButton>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Equipo
          </p>
          <HelpTip text="Aparece como sección propia en la web, justo después de 'Sobre nosotros'. Si no añades a nadie, la sección no se muestra." />
        </div>
        <div className="mt-4 space-y-4">
          {site.teamMembers.map((member) => (
            <form
              key={member.id}
              action={updateTeamMember.bind(null, member.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-2"
            >
              <input
                name="name"
                defaultValue={member.name}
                placeholder="Nombre"
                required
                className={smallFieldClass}
              />
              <input
                name="role"
                defaultValue={member.role}
                placeholder="Rol (ej. Directora, Producción)"
                required
                className={smallFieldClass}
              />
              <input
                name="photoUrl"
                defaultValue={member.photoUrl ?? ""}
                placeholder="URL de retrato (opcional)"
                className={smallFieldClass + " sm:col-span-2"}
              />
              <input
                name="btsPhotoUrl"
                defaultValue={member.btsPhotoUrl ?? ""}
                placeholder="URL de foto en rodaje / BTS (opcional)"
                className={smallFieldClass + " sm:col-span-2"}
              />
              <textarea
                name="bio"
                defaultValue={member.bio ?? ""}
                placeholder="Breve bio (opcional)"
                rows={2}
                className={smallFieldClass + " sm:col-span-2"}
              />
              <div className="flex gap-3">
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deleteTeamMember.bind(null, member.id)}
                  confirmMessage="¿Eliminar a esta persona del equipo? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>
            </form>
          ))}
        </div>
        <form
          action={createTeamMember}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-2"
        >
          <input name="name" placeholder="Nombre" required className={smallFieldClass} />
          <input name="role" placeholder="Rol" required className={smallFieldClass} />
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadido"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
          >
            Añadir
          </SubmitButton>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Equipamiento
          </p>
          <HelpTip text="Aparece en la página /equipo, debajo del equipo humano. Cámara, ópticas, iluminación, flujo de trabajo... lo que quieras enseñar." />
        </div>
        <div className="mt-4 space-y-4">
          {site.equipmentItems.map((item) => (
            <form
              key={item.id}
              action={updateEquipmentItem.bind(null, item.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
            >
              <input
                name="category"
                defaultValue={item.category}
                placeholder="Categoría (ej. Cámara)"
                required
                className={smallFieldClass}
              />
              <input
                name="detail"
                defaultValue={item.detail}
                placeholder="Detalle"
                required
                className={smallFieldClass}
              />
              <div className="flex gap-3">
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deleteEquipmentItem.bind(null, item.id)}
                  confirmMessage="¿Eliminar esta línea de equipamiento? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>
            </form>
          ))}
        </div>
        <form
          action={createEquipmentItem}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input name="category" placeholder="Categoría" required className={smallFieldClass} />
          <input name="detail" placeholder="Detalle" required className={smallFieldClass} />
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadido"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
          >
            Añadir
          </SubmitButton>
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
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deletePortfolioItem.bind(null, item.id)}
                  confirmMessage="¿Eliminar esta pieza del portfolio? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>

              <div className="mt-2 border-t border-line pt-3 sm:col-span-2">
                <div className="flex items-center gap-1.5">
                  <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                    Ficha de proyecto (opcional)
                  </p>
                  <HelpTip text="Rellena esto para que la pieza tenga su propia página en /proyectos/[slug], con hero, sinopsis, créditos y fotogramas. Sin slug, la pieza sigue apareciendo en el portfolio pero sin página propia." />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input
                    name="slug"
                    defaultValue={item.slug ?? ""}
                    placeholder="slug (ej. distorsion)"
                    className={smallFieldClass}
                  />
                  <input
                    name="year"
                    type="number"
                    defaultValue={item.year ?? ""}
                    placeholder="Año"
                    className={smallFieldClass}
                  />
                  <input
                    name="genre"
                    defaultValue={item.genre ?? ""}
                    placeholder="Género (opcional)"
                    className={smallFieldClass + " sm:col-span-2"}
                  />
                  <input
                    name="logline"
                    defaultValue={item.logline ?? ""}
                    placeholder="Logline — una frase potente"
                    className={smallFieldClass + " sm:col-span-4"}
                  />
                  <textarea
                    name="synopsis"
                    defaultValue={item.synopsis ?? ""}
                    placeholder="Sinopsis breve"
                    rows={2}
                    className={smallFieldClass + " sm:col-span-4"}
                  />
                  <input
                    name="heroImageUrl"
                    defaultValue={item.heroImageUrl ?? ""}
                    placeholder="URL del fotograma principal (hero de la ficha)"
                    className={smallFieldClass + " sm:col-span-4"}
                  />
                  <textarea
                    name="credits"
                    defaultValue={creditsToText(item.credits)}
                    placeholder={"Créditos, uno por línea:\nDirección: Nombre\nGuion: Nombre\nDuración: 14 min"}
                    rows={4}
                    className={smallFieldClass + " sm:col-span-4"}
                  />
                  <label className="flex items-center gap-2 font-mono text-xs sm:col-span-4">
                    <input type="checkbox" name="usesTaller" defaultChecked={item.usesTaller} />
                    Este proyecto se organizó con Taller
                  </label>
                  <input
                    name="tallerNote"
                    defaultValue={item.tallerNote ?? ""}
                    placeholder="Nota breve sobre cómo se usó Taller en este proyecto (opcional)"
                    className={smallFieldClass + " sm:col-span-4"}
                  />
                </div>

                <div className="mt-3">
                  <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                    Fotogramas y BTS
                  </p>
                  <div className="mt-2 space-y-1">
                    {item.images.map((img) => (
                      <div key={img.id} className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-accent uppercase">
                          {img.kind}
                        </span>
                        <span className="flex-1 truncate font-mono text-[11px] text-muted">
                          {img.url}
                        </span>
                        <DeleteButton
                          formAction={deleteProjectImage.bind(null, img.id)}
                          confirmMessage="¿Eliminar esta imagen? No se puede deshacer."
                          className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
                        />
                      </div>
                    ))}
                  </div>
                  <form
                    action={createProjectImage.bind(null, item.id)}
                    className="mt-2 grid grid-cols-[auto_1fr_auto] gap-2"
                  >
                    <select name="kind" defaultValue="FRAME" className={smallFieldClass}>
                      <option value="FRAME">Fotograma</option>
                      <option value="BTS">BTS</option>
                    </select>
                    <input name="url" placeholder="URL de la imagen" className={smallFieldClass} />
                    <SubmitButton
                      pendingLabel="…"
                      savedLabel="✓"
                      className="font-mono text-[10px] tracking-widest text-accent uppercase hover:opacity-80"
                    >
                      Añadir
                    </SubmitButton>
                  </form>
                </div>
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
            <SubmitButton
              pendingLabel="Añadiendo…"
              savedLabel="✓ Añadida"
              className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
            >
              Añadir pieza
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Preguntas frecuentes
          </p>
          <HelpTip text="Aparece justo antes del formulario de Presupuesto, como acordeón desplegable." />
        </div>
        <div className="mt-4 space-y-4">
          {site.faqItems.map((item) => (
            <form
              key={item.id}
              action={updateFaqItem.bind(null, item.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
            >
              <input
                name="question"
                defaultValue={item.question}
                placeholder="Pregunta"
                required
                className={smallFieldClass}
              />
              <textarea
                name="answer"
                defaultValue={item.answer}
                placeholder="Respuesta"
                rows={2}
                required
                className={smallFieldClass}
              />
              <div className="flex gap-3">
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deleteFaqItem.bind(null, item.id)}
                  confirmMessage="¿Eliminar esta pregunta? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>
            </form>
          ))}
        </div>
        <form
          action={createFaqItem}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-[1fr_2fr_auto]"
        >
          <input name="question" placeholder="Pregunta" required className={smallFieldClass} />
          <textarea
            name="answer"
            placeholder="Respuesta"
            rows={2}
            required
            className={smallFieldClass}
          />
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadida"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
          >
            Añadir
          </SubmitButton>
        </form>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Testimonios
          </p>
          <HelpTip text="Aparece en la home solo si hay al menos uno — no publiques nada aquí que no sea una cita real de un cliente o colaborador de verdad." />
        </div>
        <div className="mt-4 space-y-4">
          {site.testimonials.map((item) => (
            <form
              key={item.id}
              action={updateTestimonial.bind(null, item.id)}
              className="grid gap-2 border border-line p-4 sm:grid-cols-2"
            >
              <textarea
                name="quote"
                defaultValue={item.quote}
                placeholder="Cita"
                rows={2}
                required
                className={smallFieldClass + " sm:col-span-2"}
              />
              <input
                name="author"
                defaultValue={item.author}
                placeholder="Nombre"
                required
                className={smallFieldClass}
              />
              <input
                name="role"
                defaultValue={item.role ?? ""}
                placeholder="Cargo / empresa (opcional)"
                className={smallFieldClass}
              />
              <input
                name="photoUrl"
                defaultValue={item.photoUrl ?? ""}
                placeholder="URL de foto (opcional)"
                className={smallFieldClass + " sm:col-span-2"}
              />
              <div className="flex gap-3">
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
                <DeleteButton
                  formAction={deleteTestimonial.bind(null, item.id)}
                  confirmMessage="¿Eliminar este testimonio? No se puede deshacer."
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                />
              </div>
            </form>
          ))}
        </div>
        <form
          action={createTestimonial}
          className="mt-4 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-2"
        >
          <textarea
            name="quote"
            placeholder="Cita"
            rows={2}
            required
            className={smallFieldClass + " sm:col-span-2"}
          />
          <input name="author" placeholder="Nombre" required className={smallFieldClass} />
          <input name="role" placeholder="Cargo / empresa (opcional)" className={smallFieldClass} />
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadido"
            className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80 sm:col-span-2"
          >
            Añadir
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
