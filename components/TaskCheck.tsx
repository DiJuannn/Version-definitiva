"use client";

import { useFormStatus } from "react-dom";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { useToast } from "@/components/Toast";

function CheckButton({ done, title }: { done: boolean; title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={done ? `Marcar «${title}» como pendiente` : `Completar «${title}»`}
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
        done
          ? "border-success bg-success text-bg"
          : "border-muted/70 text-transparent hover:border-accent hover:bg-accent/10 hover:text-accent"
      } ${pending ? "animate-pulse" : ""}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// Casilla real para completar (o reabrir) una tarea sin entrar a su ficha.
export function TaskCheck({
  taskId,
  done,
  title,
}: {
  taskId: string;
  done: boolean;
  title: string;
}) {
  const { toast } = useToast();
  return (
    <form
      action={async (formData) => {
        await updateTaskStatus(taskId, formData);
        toast("success", done ? "Tarea reabierta" : "Tarea completada");
      }}
    >
      <input type="hidden" name="status" value={done ? "PENDING" : "DONE"} />
      <CheckButton done={done} title={title} />
    </form>
  );
}
