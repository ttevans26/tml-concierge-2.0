import { useMemo, useState, type FormEvent } from "react";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { useTripStore, type Trip, type ChecklistTask } from "@/stores/useTripStore";
import { deriveAiTasks } from "@/lib/checklistBackfill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  trip: Trip | null;
}

export default function PreparednessChecklist({ trip }: Props) {
  const items = useTripStore((s) => s.itineraryItems);
  const stored = useTripStore((s) => s.checklistTasks);
  const addChecklistTask = useTripStore((s) => s.addChecklistTask);
  const toggleChecklistTask = useTripStore((s) => s.toggleChecklistTask);
  const deleteChecklistTask = useTripStore((s) => s.deleteChecklistTask);
  const acceptAiTask = useTripStore((s) => s.acceptAiTask);
  const dismissAiTask = useTripStore((s) => s.dismissAiTask);
  const updateChecklistTask = useTripStore((s) => s.updateChecklistTask);

  const [draft, setDraft] = useState("");

  const tripItems = useMemo(
    () => (trip ? items.filter((i) => i.trip_id === trip.id) : []),
    [items, trip],
  );

  // Merge: stored tasks (manual + already-materialised AI) + derived AI tasks
  // (skipping derived ones whose id already exists in store).
  const merged: ChecklistTask[] = useMemo(() => {
    if (!trip) return [];
    const tripStored = stored.filter((t) => t.trip_id === trip.id);
    const derived = deriveAiTasks(trip, tripItems).filter(
      (d) => !tripStored.some((t) => t.id === d.id),
    );
    return [...tripStored, ...derived];
  }, [stored, trip, tripItems]);

  const manual = merged.filter((t) => !t.is_ai_generated && !t.dismissed);
  const ai = merged.filter((t) => t.is_ai_generated && !t.dismissed);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!trip || !draft.trim()) return;
    addChecklistTask({ trip_id: trip.id, task_text: draft.trim() });
    setDraft("");
  };

  const persistAiToggle = (task: ChecklistTask) => {
    // If it's a derived (not-yet-stored) AI task, materialise it before toggling.
    const isStored = stored.some((t) => t.id === task.id);
    if (!isStored) {
      useTripStore.setState((s) => ({
        checklistTasks: [...s.checklistTasks, { ...task, is_completed: true }],
      }));
    } else {
      toggleChecklistTask(task.id);
    }
  };

  const persistAiDismiss = (task: ChecklistTask) => {
    const isStored = stored.some((t) => t.id === task.id);
    if (!isStored) {
      useTripStore.setState((s) => ({
        checklistTasks: [...s.checklistTasks, { ...task, dismissed: true }],
      }));
    } else {
      dismissAiTask(task.id);
    }
  };

  const persistAiAccept = (task: ChecklistTask) => {
    const isStored = stored.some((t) => t.id === task.id);
    if (!isStored) {
      useTripStore.setState((s) => ({
        checklistTasks: [...s.checklistTasks, { ...task, is_ai_generated: false }],
      }));
    } else {
      acceptAiTask(task.id);
    }
  };

  return (
    <section className="bg-card border-thin border-foreground/80 rounded-sm p-4 md:p-6">
      <header className="mb-4">
        <p className="font-inter text-[10px] tracking-[0.22em] text-muted-foreground uppercase mb-1">
          Pre-Travel Preparedness
        </p>
        <h2 className="font-playfair text-xl text-foreground">Checklist</h2>
        <p className="font-inter text-xs text-muted-foreground mt-1.5 max-w-prose">
          A working list of personal tasks, augmented by logistics insights drawn from your itinerary.
        </p>
      </header>

      {/* Add input */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 mb-4">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task — e.g. Pack formal evening attire"
          className="rounded-sm border-thin border-foreground/40 bg-background font-inter text-sm h-10"
          disabled={!trip}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!trip || !draft.trim()}
          className="rounded-sm border-thin border-foreground/60 h-10 px-4 font-inter"
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </form>

      {/* Track A: manual */}
      <div className="space-y-1 mb-5">
        {manual.length === 0 ? (
          <p className="font-playfair italic text-foreground/50 text-sm">
            No personal tasks yet.
          </p>
        ) : (
          manual.map((t) => (
            <ChecklistRow
              key={t.id}
              task={t}
              onToggle={() => toggleChecklistTask(t.id)}
              onDelete={() => deleteChecklistTask(t.id)}
              onTextChange={(text) => updateChecklistTask(t.id, { task_text: text })}
            />
          ))
        )}
      </div>

      {/* Track B: AI suggestions */}
      {ai.length > 0 && (
        <div className="pt-4 border-t-thin border-foreground/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <p className="font-inter text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Suggested Logistics Insights
            </p>
          </div>
          <ul className="space-y-3">
            {ai.map((t) => (
              <li
                key={t.id}
                className="border-l-2 border-accent/70 pl-3 py-0.5 flex items-start gap-3"
              >
                <button
                  type="button"
                  onClick={() => persistAiToggle(t)}
                  aria-label={t.is_completed ? "Mark as not done" : "Mark as done"}
                  className={`mt-1 h-5 w-5 shrink-0 border-thin border-foreground/60 rounded-sm flex items-center justify-center ${
                    t.is_completed ? "bg-foreground text-background" : "bg-background"
                  }`}
                >
                  {t.is_completed && <Check className="h-3 w-3" strokeWidth={2.5} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-playfair text-sm text-foreground leading-snug ${
                      t.is_completed ? "line-through text-foreground/50" : ""
                    }`}
                  >
                    {t.task_text}
                  </p>
                  {t.detail && (
                    <p className="font-inter text-xs text-foreground/65 mt-1 leading-relaxed italic">
                      {t.detail}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => persistAiAccept(t)}
                      className="font-inter text-[11px] tracking-wider uppercase text-accent hover:underline min-h-[44px] md:min-h-0 py-2 md:py-0"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => persistAiDismiss(t)}
                      className="font-inter text-[11px] tracking-wider uppercase text-muted-foreground hover:text-foreground min-h-[44px] md:min-h-0 py-2 md:py-0"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ChecklistRow({
  task,
  onToggle,
  onDelete,
  onTextChange,
}: {
  task: ChecklistTask;
  onToggle: () => void;
  onDelete: () => void;
  onTextChange: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(task.task_text);

  return (
    <div className="group flex items-start gap-3 py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-label={task.is_completed ? "Mark as not done" : "Mark as done"}
        className={`mt-1 h-5 w-5 shrink-0 border-thin border-foreground/60 rounded-sm flex items-center justify-center ${
          task.is_completed ? "bg-foreground text-background" : "bg-background"
        }`}
      >
        {task.is_completed && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (val.trim()) onTextChange(val.trim());
              setEditing(false);
            }}
          >
            <Input
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={() => {
                if (val.trim()) onTextChange(val.trim());
                setEditing(false);
              }}
              className="rounded-sm border-thin border-foreground/40 bg-background font-inter text-sm h-9"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`text-left font-inter text-sm leading-relaxed w-full ${
              task.is_completed ? "line-through text-foreground/50" : "text-foreground"
            }`}
          >
            {task.task_text}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete task"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-2 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
