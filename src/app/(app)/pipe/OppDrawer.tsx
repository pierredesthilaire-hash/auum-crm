"use client";

import { useState, useTransition } from "react";
import { STAGES, PROB_OPTIONS, SOURCES, stageOf } from "@/lib/stages";
import { keur } from "@/lib/format";
import { changeStage, saveOpportunity, markWon, markLost, createOpportunity } from "./actions";
import type { ConfirmRequest } from "./ConfirmDialog";
import type { AeOption, CurrentUser, OppRow } from "./types";

type ConfirmFn = (
  req: Omit<ConfirmRequest, "onConfirm" | "onCancel">,
) => Promise<{ ok: boolean; comment: string; extraChecked: boolean }>;

export function OppDrawer({
  opp,
  aes,
  entityNames,
  currentUser,
  onClose,
  confirm,
}: {
  opp: OppRow | null;
  aes: AeOption[];
  entityNames: string[];
  currentUser: CurrentUser;
  onClose: () => void;
  confirm: ConfirmFn;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[200]"
        style={{ background: "rgba(14,20,17,.35)" }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-[201] flex h-full w-[420px] max-w-[92vw] flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {opp ? (
          <EditOpp opp={opp} currentUser={currentUser} onClose={onClose} confirm={confirm} />
        ) : (
          <CreateOpp aes={aes} entityNames={entityNames} currentUser={currentUser} onClose={onClose} />
        )}
      </div>
    </>
  );
}

function EditOpp({
  opp,
  currentUser,
  onClose,
  confirm,
}: {
  opp: OppRow;
  currentUser: CurrentUser;
  onClose: () => void;
  confirm: ConfirmFn;
}) {
  const [stage, setStage] = useState(opp.stage);
  const [prob, setProb] = useState(opp.prob);
  const [machines, setMachines] = useState(opp.machines);
  const [amount, setAmount] = useState(opp.amount);
  const [closeDate, setCloseDate] = useState(opp.close_date ?? "");
  const [installDate, setInstallDate] = useState(opp.install_date ?? "");
  const [notes, setNotes] = useState(opp.notes ?? "");
  const [pending, setPending] = useState(false);

  const wAmount = (amount * prob) / 100;

  const handleSave = async () => {
    // Le state "pending" ne doit couvrir que les appels serveur, pas
    // l'attente d'une interaction utilisateur dans la modale de
    // confirmation (sinon le bouton reste bloqué indéfiniment).
    setPending(true);
    await saveOpportunity(opp.id, {
      prob,
      machines,
      amount,
      closeDate: closeDate || null,
      installDate: installDate || null,
      notes,
    });
    setPending(false);

    if (stage !== opp.stage) {
      const from = stageOf(opp.stage)!;
      const to = stageOf(stage)!;
      const stages = STAGES.map((s) => s.id);
      const dir = stages.indexOf(to.id) > stages.indexOf(from.id) ? "up" : "down";
      const r = await confirm({
        title: "Changement d'étape",
        message: (
          <>
            Confirmez-vous le passage de <b>{opp.entities?.name}</b> — {opp.name}
            <br />
            de <b style={{ color: from.color }}>{from.label}</b> vers{" "}
            <b style={{ color: to.color }}>{to.label}</b> ?
            {dir === "down" && (
              <>
                <br />
                <span style={{ color: "var(--red)", fontWeight: 600 }}>
                  ⚠️ Recul dans le pipeline — précisez la raison en commentaire.
                </span>
              </>
            )}
          </>
        ),
        withComment: true,
      });
      if (r.ok) {
        setPending(true);
        await changeStage(opp.id, stage, r.comment);
        setPending(false);
      }
    }
    onClose();
  };

  const handleWon = async () => {
    const r = await confirm({
      title: "Marquer gagnée",
      withComment: true,
      extraCheckboxLabel: `Ajouter les ${machines} machine(s) au parc du compte`,
      extraCheckboxDefault: true,
      message: (
        <>
          Confirmez-vous la <b>signature</b> de {opp.entities?.name} — {opp.name} ?
          <br />
          {machines} machine(s) · {keur(amount)}
        </>
      ),
    });
    if (r.ok) {
      setPending(true);
      await markWon(opp.id, r.comment, r.extraChecked);
      setPending(false);
      onClose();
    }
  };

  const handleLost = async () => {
    const r = await confirm({
      title: "Marquer perdue",
      withComment: true,
      message: (
        <>
          Confirmez-vous la <b>perte</b> de {opp.entities?.name} — {opp.name} ?
          <br />
          Indiquez la raison en commentaire (prix, concurrent, sans suite, budget…).
        </>
      ),
    });
    if (r.ok) {
      setPending(true);
      await markLost(opp.id, r.comment);
      setPending(false);
      onClose();
    }
  };

  return (
    <>
      <div className="relative border-b p-5" style={{ borderColor: "var(--line)" }}>
        <button onClick={onClose} className="absolute right-5 top-5 text-lg">
          ✕
        </button>
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
          {opp.entities?.name}
        </div>
        <h2 className="font-display text-lg font-semibold">{opp.name}</h2>
        <div className="text-xs text-[var(--muted)]">
          {opp.profiles?.full_name} · provenance : {opp.stage_orig ?? "—"}
        </div>
      </div>

      <div className="flex-1 space-y-3 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Étape">
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="input">
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Probabilité (%)">
            <select value={prob} onChange={(e) => setProb(+e.target.value)} className="input">
              {PROB_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre de machines">
            <input
              type="number"
              min={0}
              value={machines}
              onChange={(e) => setMachines(+e.target.value || 0)}
              className="input"
            />
          </Field>
          <Field label="Montant total (€)">
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(+e.target.value || 0)}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Closing estimé">
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Installation prévue">
            <input
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexte, décideurs, prochaine action…"
            className="input"
          />
        </Field>

        <div
          className="rounded-lg p-3 text-[12.5px]"
          style={{ background: "var(--teal-soft)" }}
        >
          Pondéré AE : <b className="font-display">{keur(wAmount)}</b> ·{" "}
          <b className="font-display">{((machines * prob) / 100).toFixed(1)}</b> machines pondérées
        </div>

        <div className="text-[11.5px] leading-relaxed text-[var(--muted)]">
          <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">
            Référence Dynamics
          </div>
          Phase d&apos;origine : <b>{opp.stage_orig ?? "—"}</b>
          <br />
          ID opportunité : {opp.dyn_id || "—"}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t p-4" style={{ borderColor: "var(--line)" }}>
        <button onClick={handleWon} disabled={pending} className="btn" style={{ color: "var(--pine)", borderColor: "var(--pine)" }}>
          ✓ Gagnée
        </button>
        <button onClick={handleLost} disabled={pending} className="btn" style={{ color: "var(--red)" }}>
          ✗ Perdue
        </button>
        <button onClick={handleSave} disabled={pending} className="btn-primary ml-auto">
          Enregistrer
        </button>
      </div>
    </>
  );
}

function CreateOpp({
  aes,
  entityNames,
  currentUser,
  onClose,
}: {
  aes: AeOption[];
  entityNames: string[];
  currentUser: CurrentUser;
  onClose: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [name, setName] = useState("");
  const [aeId, setAeId] = useState(currentUser.isDirection ? aes[0]?.id ?? currentUser.id : currentUser.id);
  const [stage, setStage] = useState<string>(STAGES[0].id);
  const [machines, setMachines] = useState(1);
  const [amount, setAmount] = useState(7400);
  const [prob, setProb] = useState(20);
  const [closeDate, setCloseDate] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    if (!clientName.trim()) {
      setError("Indiquez le compte client");
      return;
    }
    startTransition(async () => {
      const r = await createOpportunity({
        clientName: clientName.trim(),
        name: name.trim(),
        aeId,
        stage,
        machines,
        amount,
        prob,
        closeDate: closeDate || null,
        source,
      });
      if (!r.ok) {
        setError(r.error ?? "Échec de création");
        return;
      }
      onClose();
    });
  };

  return (
    <>
      <div className="relative border-b p-5" style={{ borderColor: "var(--line)" }}>
        <button onClick={onClose} className="absolute right-5 top-5 text-lg">
          ✕
        </button>
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
          Nouvelle opportunité
        </div>
        <h2 className="font-display text-lg font-semibold">Créer une opportunité</h2>
        <div className="text-xs text-[var(--muted)]">
          Elle sera tracée au journal comme créée par {currentUser.fullName}
        </div>
      </div>

      <div className="flex-1 space-y-3 p-5">
        <Field label="Compte client">
          <input
            list="ent-list"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Choisir un compte existant ou saisir un nouveau…"
            className="input"
          />
          <datalist id="ent-list">
            {entityNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="Nom de la transaction">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. 12 machines — siège La Défense"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="AE en charge">
            {currentUser.isDirection ? (
              <select value={aeId} onChange={(e) => setAeId(e.target.value)} className="input">
                {aes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <input value={currentUser.fullName} disabled className="input" />
            )}
          </Field>
          <Field label="Étape">
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="input">
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Machines">
            <input
              type="number"
              min={0}
              value={machines}
              onChange={(e) => setMachines(+e.target.value || 0)}
              className="input"
            />
          </Field>
          <Field label="Montant (€)">
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(+e.target.value || 0)}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Probabilité (%)">
            <select value={prob} onChange={(e) => setProb(+e.target.value)} className="input">
              {[20, 40, 50, 60, 80].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Closing estimé">
            <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Provenance">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        {error && <div className="text-[12.5px] font-semibold text-[var(--red)]">{error}</div>}
      </div>

      <div className="border-t p-4" style={{ borderColor: "var(--line)" }}>
        <button onClick={handleCreate} disabled={pending} className="btn-primary w-full">
          Créer l&apos;opportunité
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink)]">
      {label}
      {children}
    </label>
  );
}
