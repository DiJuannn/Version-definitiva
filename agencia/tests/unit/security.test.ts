import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, randomToken, sha256 } from "@/lib/auth/crypto";
import { signMedia, verifyMedia } from "@/lib/storage/signed-url";
import { storageKey } from "@/lib/storage/provider";
import { LocalDiskStorage } from "@/lib/storage/local";

describe("contraseñas y tokens", () => {
  it("scrypt verifica la correcta y rechaza la incorrecta", async () => {
    const h = await hashPassword("una-clave-segura-1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("una-clave-segura-1", h)).toBe(true);
    expect(await verifyPassword("otra", h)).toBe(false);
    expect(await verifyPassword("x", "formato-raro")).toBe(false);
  });
  it("tokens aleatorios de 256 bits y hash estable", () => {
    const t = randomToken();
    expect(Buffer.from(t, "base64url").length).toBe(32);
    expect(sha256("a")).toBe(sha256("a"));
  });
});

describe("URLs firmadas de media", () => {
  it("verifica firmas válidas y rechaza manipuladas o caducadas", () => {
    const t = signMedia({ assetId: "a1", subject: "u:s1", download: false });
    expect(verifyMedia(t)?.assetId).toBe("a1");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ assetId: "otro", subject: "u:s1", exp: Date.now() + 1e6, download: true })).toString("base64url");
    expect(verifyMedia(`${forged}.${sig}`)).toBeNull();
    expect(verifyMedia(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(verifyMedia(signMedia({ assetId: "a1", subject: "u:s1", download: false }, -1000))).toBeNull();
  });
});

describe("almacenamiento local", () => {
  it("no permite salir de la carpeta raíz", async () => {
    const s = new LocalDiskStorage(".storage-test");
    await expect(s.writeFile("../fuera.txt", new Uint8Array([1]))).rejects.toThrow();
    expect(storageKey({ organizationId: "o", kind: "PREVIEW", assetId: "a", filename: "../../etc/passwd" })).toBe("o/preview/a/.._.._etc_passwd");
  });
  it("escribe por trozos solo en el offset esperado", async () => {
    const s = new LocalDiskStorage(".storage-test");
    const key = `t/${Date.now()}/f.bin`;
    await s.writeChunk(key, 0, new Uint8Array([1, 2, 3]));
    await expect(s.writeChunk(key, 1, new Uint8Array([9]))).rejects.toThrow();
    await s.writeChunk(key, 3, new Uint8Array([4]));
    expect(await s.size(key)).toBe(4);
    expect(await s.sha256(key)).toBe("9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a");
    await s.delete(key);
  });
});
