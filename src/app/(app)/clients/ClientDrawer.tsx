"use client";

import { useMemo, useState } from "react";
import { keur, fdate, initials, aeColor } from "@/lib/format";
import { SEG_LABEL, SEG_COLOR, segDesc, segmentOf, type SegConfig } from "@/lib/segments";
import { stageOf } from "@/lib/stages";
import { updateEntity, createGroup, addContact, removeContact } from "./actions";
import type { AeOption, ContactRow, CurrentUser, EntityOpp, EntityRow, GroupOption } from "./types";

export function ClientDrawer({
  entity,
  opps,
  contacts,
  groups,
  aes,
  currentUser,
  segConfig,
  onClose,
}: {
  entity: EntityRow;
  opps: EntityOpp[];
  contacts: ContactRow[];
  groups: GroupOption[];
  aes: AeOption[];
  currentUser: CurrentUser;
  segConfig: SegConfig;
  onClose: () => void;
}) {
  const [headcount, setHeadcount] = useState(entity.headcount ?? "");
  const [groupId, setGroupId] = useState(entity.group_id ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [ownerId, setOwnerId] = useState(entity.owner_id ?? "");
  const [parc, setParc] = useState(entity.parc ?? 0);
  const [parcNote, setParcNote] = useState(entity.parc_note ?? "");
  const [contactForm, setContactForm] = useState({ full_name: "", role: "", email: "", phone: "" });

  const seg = segmentOf(headcount === "" ? null : +headcount, segConfig);
  const activeAes = useMemo(() => {
    const names = new Set(opps.map((o) => o.profiles?.full_name).filter(Boolean) as string[]);
    if (entity.profiles?.full_name) names.delete(entity.profiles.full_name);
    return [...names];
  }, [opps, entity.profiles]);

  const totalAmount = opps.reduce((s, o) => s + o.amount, 0);
  const totalMachines = opps.reduce((s, o) => s + o.machines, 0);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    const r = await createGroup(newGroupName.trim());
    if (r.ok && r.id) {
      setGroupId(r.id);
      setNewGroupName("");
      await updateEntity(entity.id, { group_id: r.id });
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.full_name.trim()) return;
    await addContact(entity.id, contactForm);
    setContactForm({ full_name: "", role: "", email: "", phone: "" });
  };

  return (
    <>
      <div className="fixed inset-0 z-[200]" style={{ background: "rgba(14,20,17,.35)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-[201] flex h-full w-[460px] max-w-[92vw] flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b p-5" style={{ borderColor: "var(--line)" }}>
          <button onClick={onClose} className="absolute right-5 top-5 text-lg">
            ✕
          </button>
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
            {entity.groups ? `🏛 ${entity.groups.name}` : "Entité indépendante"}
          </div>
          <h2 className="font-display text-lg font-semibold">{entity.name}</h2>
        </div>

        <div className="flex-1 space-y-4 p-5">
          {/* Effectif + segment */}
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Effectif (nb de personnes)" className="max-w-[170px]">
              <input
                type="number"
                min={0}
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value === "" ? "" : +e.target.value)}
                onBlur={() => updateEntity(entity.id, { headcount: headcount === "" ? null : +headcount })}
                placeholder="inconnu"
                className="input"
              />
            </Field>
            <div>
              <div className="mb-1 text-[10.5px] text-[var(--muted)]">Segment</div>
              {seg ? (
                <>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white"
                    style={{ background: SEG_COLOR[seg] }}
                  >
                    {SEG_LABEL[seg]}
                  </span>{" "}
                  <span className="text-[11px] text-[var(--muted)]">{segDesc(seg, segConfig)}</span>
                </>
              ) : (
                <span className="text-[12px] text-[var(--muted)]">renseignez l&apos;effectif</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 rounded-lg p-3 text-center" style={{ background: "var(--bg)" }}>
            <StatBox v={opps.length} l="Oppos en cours" />
            <StatBox v={keur(totalAmount)} l="Pipe total" />
            <StatBox v={totalMachines} l="Machines en jeu" />
            <StatBox v={entity.parc || 0} l="Au parc" />
          </div>

          {/* Rattachement */}
          <Section title="Rattachement juridique">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Groupe (société mère)">
                <select
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    updateEntity(entity.id, { group_id: e.target.value || null });
                  }}
                  className="input"
                >
                  <option value="">— Aucun (entité indépendante)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nouveau groupe">
                <div className="flex gap-1.5">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nom du groupe…"
                    className="input"
                  />
                  <button onClick={handleCreateGroup} className="btn shrink-0">
                    Créer
                  </button>
                </div>
              </Field>
            </div>
          </Section>

          {/* AE référent */}
          <Section title="AE référent">
            <div className="grid grid-cols-2 gap-3">
              <Field label="AE référent du compte">
                {currentUser.isDirection ? (
                  <select
                    value={ownerId}
                    onChange={(e) => {
                      setOwnerId(e.target.value);
                      updateEntity(entity.id, { owner_id: e.target.value || null });
                    }}
                    className="input"
                  >
                    <option value="">— Non défini</option>
                    {aes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={entity.profiles?.full_name ?? "— Non défini"} disabled className="input" />
                )}
              </Field>
              <Field label="AE actifs sur ce compte">
                <div className="flex flex-wrap gap-1 pt-1">
                  {activeAes.length ? (
                    activeAes.map((a) => (
                      <span
                        key={a}
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: aeColor(a, aes.map((x) => x.full_name)) + "22", color: aeColor(a, aes.map((x) => x.full_name)) }}
                      >
                        {a.split(" ")[0]}
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-[var(--muted)]">aucune autre oppo active</span>
                  )}
                </div>
              </Field>
            </div>
          </Section>

          {/* Parc */}
          <Section title="Parc machines installé">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Machines au parc">
                <input
                  type="number"
                  min={0}
                  value={parc}
                  onChange={(e) => setParc(+e.target.value || 0)}
                  onBlur={() => updateEntity(entity.id, { parc })}
                  className="input"
                />
              </Field>
              <Field label="Note parc (sites, modèles, contrat)">
                <input
                  value={parcNote}
                  onChange={(e) => setParcNote(e.target.value)}
                  onBlur={() => updateEntity(entity.id, { parc_note: parcNote || null })}
                  placeholder="ex. 12 machines site Roissy, contrat 39 mois…"
                  className="input"
                />
              </Field>
            </div>
          </Section>

          {/* Contacts */}
          <Section title={`Contacts (${contacts.length})`}>
            {!contacts.length && (
              <div className="text-[12px] text-[var(--muted)]">Aucun contact pour l&apos;instant.</div>
            )}
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border p-2"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: "var(--pine)" }}
                  >
                    {initials(c.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold">{c.full_name}</div>
                    <div className="truncate text-[10.5px] text-[var(--muted)]">
                      {[c.role, c.email, c.phone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button onClick={() => removeContact(c.id)} className="btn shrink-0" style={{ color: "var(--red)" }}>
                    Retirer
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <input
                value={contactForm.full_name}
                onChange={(e) => setContactForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Nom"
                className="input"
              />
              <input
                value={contactForm.role}
                onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Rôle (RSE, QHSE…)"
                className="input"
              />
              <input
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email"
                className="input"
              />
              <input
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Tél."
                className="input"
              />
            </div>
            <button onClick={handleAddContact} className="btn-primary mt-1.5 w-full">
              Ajouter
            </button>
          </Section>

          {/* Opportunités */}
          <Section title={`Opportunités (${opps.length})`}>
            {!opps.length ? (
              <div className="text-[12px] text-[var(--muted)]">Aucune opportunité en cours sur cette entité.</div>
            ) : (
              <div className="space-y-1.5">
                {opps.map((o) => {
                  const s = stageOf(o.stage);
                  return (
                    <div key={o.id} className="rounded-lg border p-2 text-[11.5px]" style={{ borderColor: "var(--line)" }}>
                      <div className="font-semibold">{o.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[var(--muted)]">
                        <span>{o.profiles?.full_name?.split(" ")[0]}</span>
                        {s && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ background: s.color }}
                          >
                            {s.label}
                          </span>
                        )}
                        <span>{o.machines} mach.</span>
                        <b style={{ color: "var(--ink)" }}>{keur(o.amount)}</b>
                        <span>{fdate(o.close_date)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-[var(--ink)] ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}

function StatBox({ v, l }: { v: string | number; l: string }) {
  return (
    <div>
      <div className="font-display text-[16px] font-bold">{v}</div>
      <div className="text-[9.5px] text-[var(--muted)]">{l}</div>
    </div>
  );
}
