"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BellRing,
  Plus,
  Trash2,
  AlertTriangle,
  Lock,
  Search,
  X,
  Ticket,
  Home,
  Sparkles,
  Clock,
  Check,
} from "lucide-react";
import { useReminders } from "@/lib/vault/useReminders";
import { ReminderRecord, BookingRecord } from "@/lib/vault/types";
import { revokeSecretAccess } from "@/lib/deviceAuth";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";

export default function RemindersPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  const {
    trip,
    activeReminders,
    pastReminders,
    bookings,
    permissionGranted,
    isLoading,
    error,
    askPermission,
    addCustomReminder,
    scheduleDeparture,
    scheduleCheckIn,
    removeReminder,
    triggerTest,
  } = useReminders(tripId);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<ReminderRecord | null>(null);
  const [testTriggered, setTestTriggered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Form State for Custom Reminder
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formTriggerTime, setFormTriggerTime] = useState("");

  // Lock body scroll when modals are open
  useLockBodyScroll(showAddModal || !!reminderToDelete);

  const handleLockVault = () => {
    revokeSecretAccess();
    router.push("/");
  };

  const showSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // Open Add Custom Modal
  const handleOpenAddModal = () => {
    setFormTitle("");
    setFormBody("");
    // Default trigger time: 1 hour from now
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    const localIso = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFormTriggerTime(localIso);
    setShowAddModal(true);
  };

  // Submit Custom Reminder
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formTriggerTime) return;

    try {
      setIsSubmitting(true);
      await addCustomReminder({
        title: formTitle.trim(),
        body: formBody.trim(),
        triggerTime: new Date(formTriggerTime).toISOString(),
      });
      setShowAddModal(false);
      showSuccess("Custom expedition reminder scheduled!");
    } catch (err) {
      console.error("Failed to add reminder:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Instant 5s Test Alarm
  const handleTestNotification = async () => {
    try {
      setTestTriggered(true);
      await triggerTest(5);
      showSuccess("Test notification scheduled! Will fire in 5 seconds.");
      setTimeout(() => setTestTriggered(false), 6000);
    } catch (err) {
      console.error("Test notification failed:", err);
      setTestTriggered(false);
    }
  };

  // Schedule Departure Alarm
  const handleScheduleDeparture = async (booking: BookingRecord) => {
    try {
      await scheduleDeparture(booking, 2);
      showSuccess(`Departure alert scheduled for ${booking.title}!`);
    } catch (err) {
      console.error("Failed scheduling departure alarm:", err);
    }
  };

  // Schedule Check-in Alarm
  const handleScheduleCheckIn = async (booking: BookingRecord) => {
    try {
      await scheduleCheckIn(booking, 2);
      showSuccess(`Check-in reminder scheduled for ${booking.title}!`);
    } catch (err) {
      console.error("Failed scheduling check-in alarm:", err);
    }
  };

  // Check if an alarm already exists for an entity
  const findReminderForEntity = (entityId: string) => {
    return activeReminders.find((r) => r.relatedEntityId === entityId);
  };

  const transportBookings = bookings.filter((b) => b.category === "TRANSPORT");
  const stayBookings = bookings.filter((b) => b.category === "ACCOMMODATION");

  const filteredActive = activeReminders.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-yellow-500 animate-spin" />
        <span>Loading native alarm schedules...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-muted pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1">
            <Link
              href={`/secret/vault/${tripId}`}
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{trip?.title || "Expedition"}</span>
            </Link>
            <span>/</span>
            <span className="text-accent font-medium">Local Alarms & Reminders</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
            Alarms & Departure Reminders
          </h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Local hardware alarms for transport departures, station arrivals, and hotel check-in times.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={testTriggered}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface border border-muted hover:border-foreground/30 text-xs font-sans text-foreground transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
            title="Test a 5-second notification"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>{testTriggered ? "Firing Alarm in 5s..." : "Test Local Alarm (5s)"}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reminder</span>
          </button>

          <button
            type="button"
            onClick={handleLockVault}
            className="p-2 rounded-xl bg-surface border border-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Lock Vault"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2 shadow-xs animate-fade-in">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-mono shadow-xs animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. 100% OFFLINE ASSURANCE BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-muted shadow-soft">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-0.5">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-sans font-semibold text-sm text-foreground">
                100% Offline Android System Alarms
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                No Internet or Cellular Signal Required
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Alarms are registered directly inside Android’s native <span className="font-mono text-[11px] text-foreground font-semibold">AlarmManager</span> and <span className="font-mono text-[11px] text-foreground font-semibold">NotificationManager</span>. They will reliably ring, vibrate, and alert you on schedule even when your phone is in complete Airplane Mode with zero network reception.
            </p>
          </div>
        </div>
      </div>

      {/* 3. ANDROID NOTIFICATION PERMISSION STATUS */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        permissionGranted
          ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
          : "bg-amber-50/60 border-amber-200 text-amber-900"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl border shrink-0 ${
              permissionGranted
                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                : "bg-amber-100 border-amber-300 text-amber-700"
            }`}>
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-sm">
                {permissionGranted
                  ? "Android Local Notifications Active & Permitted"
                  : "Notification Permission Needed"}
              </h3>
              <p className="text-[11px] opacity-80 mt-0.5 max-w-xl">
                {permissionGranted
                  ? "Time-critical alerts will ring and vibrate even when your screen is locked or the app is closed."
                  : "Grant permission so Android can trigger alarm banners before your train departs or stay check-in arrives."}
              </p>
            </div>
          </div>

          {!permissionGranted && (
            <button
              type="button"
              onClick={askPermission}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs font-sans transition-colors shrink-0 shadow-xs cursor-pointer"
            >
              Grant Notification Access
            </button>
          )}
        </div>
      </div>

      {/* 4. AUTOMATED EXPEDITION ALARM SCHEDULERS */}
      <div className="space-y-4">
        <h2 className="font-display text-lg text-foreground font-normal">
          1-Tap Automated Expedition Alarms
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Section A: Transport Departures */}
          <div className="p-4 rounded-2xl bg-surface border border-muted space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-cyan-400">
              <Ticket className="w-4 h-4" />
              <h3 className="font-sans font-semibold text-xs uppercase tracking-wider text-foreground">
                Transport Departures
              </h3>
            </div>

            {transportBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground font-body">
                No train, flight, or bus bookings configured in your vault yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {transportBookings.map((b) => {
                  const existing = findReminderForEntity(b.id);
                  return (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-background border border-muted text-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-medium text-foreground truncate">{b.title}</span>
                        {existing ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            <span>Armed</span>
                          </span>
                        ) : null}
                      </div>

                      {b.departureOrCheckInTime && (
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Departs: {new Date(b.departureOrCheckInTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}

                      <button
                        onClick={() => handleScheduleDeparture(b)}
                        className={`w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                          existing
                            ? "bg-surface text-muted-foreground hover:text-foreground border border-muted"
                            : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        <Bell className="w-3 h-3" />
                        <span>{existing ? "Update Departure Alarm (2h)" : "Set Departure Alarm (2h)"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: Stay Check-ins */}
          <div className="p-4 rounded-2xl bg-surface border border-muted space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-indigo-400">
              <Home className="w-4 h-4" />
              <h3 className="font-sans font-semibold text-xs uppercase tracking-wider text-foreground">
                Hotel & Stay Check-ins
              </h3>
            </div>

            {stayBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground font-body">
                No accommodation bookings saved in your vault.
              </p>
            ) : (
              <div className="space-y-2.5">
                {stayBookings.map((b) => {
                  const existing = findReminderForEntity(b.id);
                  return (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-background border border-muted text-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-medium text-foreground truncate">{b.title}</span>
                        {existing ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            <span>Armed</span>
                          </span>
                        ) : null}
                      </div>

                      {b.departureOrCheckInTime && (
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Check-in: {new Date(b.departureOrCheckInTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}

                      <button
                        onClick={() => handleScheduleCheckIn(b)}
                        className={`w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                          existing
                            ? "bg-surface text-muted-foreground hover:text-foreground border border-muted"
                            : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        }`}
                      >
                        <Bell className="w-3 h-3" />
                        <span>{existing ? "Update Check-in Alarm" : "Set Check-in Alarm"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. ACTIVE ALARMS SCHEDULE TIMELINE */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-foreground font-normal">
              Armed Expedition Reminders ({activeReminders.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Scheduled alerts armed to wake and trigger system notification banners.
            </p>
          </div>

          {activeReminders.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alarms..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden"
              />
            </div>
          )}
        </div>

        {activeReminders.length === 0 ? (
          <div className="p-10 rounded-2xl bg-surface/40 border border-muted text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-base text-foreground font-normal">
                No Active Alarms Scheduled
              </h3>
              <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Arm departure reminders above, set a 3-hour bike rental warning, or schedule a custom expedition alert.
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs transition-colors"
            >
              Add Custom Alarm
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredActive.map((reminder) => {
              const triggerDate = new Date(reminder.triggerTime);
              return (
                <div
                  key={reminder.id}
                  className="p-4 rounded-2xl bg-surface border border-muted hover:border-yellow-500/40 transition-all flex items-start sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 shrink-0 mt-0.5 sm:mt-0">
                      <BellRing className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans font-medium text-sm text-foreground">
                          {reminder.title}
                        </span>
                        {reminder.relatedType && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-background border border-muted text-muted-foreground">
                            {reminder.relatedType}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-body text-muted-foreground mt-0.5 line-clamp-2">
                        {reminder.body}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-yellow-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Fires: {triggerDate.toLocaleDateString([], { month: "short", day: "numeric" })} at {triggerDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setReminderToDelete(reminder)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-background transition-colors shrink-0"
                    title="Cancel reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Past Reminders Log */}
        {pastReminders.length > 0 && (
          <div className="pt-4 border-t border-muted/60 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
              Dispatched & Past Reminders ({pastReminders.length})
            </span>
            <div className="space-y-1.5">
              {pastReminders.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-surface/30 border border-muted/40 text-xs opacity-60 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="font-medium text-muted-foreground">{r.title}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 ml-2">
                      {new Date(r.triggerTime).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                    Dispatched
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD CUSTOM REMINDER */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-surface border border-muted p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-foreground font-normal">
                  Schedule Custom Reminder
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Alarm Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Check Engine Oil, Take Diamox Tab, Pick Up Permits"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-sm font-sans text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Trigger Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formTriggerTime}
                  onChange={(e) => setFormTriggerTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-muted text-xs font-mono text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Alert Message / Notes
                </label>
                <textarea
                  rows={2}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="e.g. Verify tire pressure at HP petrol pump before entering Zoji La pass."
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-muted text-xs font-sans text-foreground focus:outline-hidden focus:border-accent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formTitle.trim() || !formTriggerTime}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Scheduling..." : "Arm Alarm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {reminderToDelete && (
        <div
          onClick={() => setReminderToDelete(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface border border-muted p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-rose-500">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-display text-lg text-foreground font-normal">
                Cancel Alarm?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to cancel &quot;{reminderToDelete.title}&quot;? Android will disarm this notification.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted">
              <button
                type="button"
                onClick={() => setReminderToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-muted text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Keep Alarm
              </button>
              <button
                type="button"
                onClick={async () => {
                  await removeReminder(reminderToDelete.id);
                  setReminderToDelete(null);
                  showSuccess("Alarm disarmed and cancelled.");
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Disarm Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
