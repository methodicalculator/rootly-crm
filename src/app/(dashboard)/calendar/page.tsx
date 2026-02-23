"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getAppointmentsWithClients } from "@/lib/supabase/queries";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { AppointmentDetailDialog } from "@/components/calendar/appointment-detail-dialog";
import { CancelAppointmentDialog } from "@/components/calendar/cancel-appointment-dialog";
import { CompletedSessionDialog } from "@/components/calendar/completed-session-dialog";
import type { AppointmentWithClient } from "@/types";

const locales = { it };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: AppointmentWithClient;
}

export default function CalendarPage() {
  const { effectiveOrgId, isAdmin, staffOrgIds, loading: orgLoading } = useOrganization();
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithClient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelFlowOpen, setCancelFlowOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<AppointmentWithClient | null>(null);
  const [completedFlowOpen, setCompletedFlowOpen] = useState(false);
  const [completingAppointment, setCompletingAppointment] = useState<AppointmentWithClient | null>(null);
  const calendarWrapperRef = useRef<HTMLDivElement>(null);

  // Mobile detection — default to day view on small screens
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = (matches: boolean) => {
      setIsMobile(matches);
      if (matches) {
        setView("day");
      } else {
        setView((prev) => (prev === "day" ? "week" : prev));
      }
    };
    update(mq.matches);
    const handler = (e: MediaQueryListEvent) => update(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const availableViews: View[] = isMobile ? ["day"] : ["week", "month"];

  // Scroll to 07:00 on mount and when switching to time-based views
  useEffect(() => {
    if (loading || view === "month") return;
    const timer = setTimeout(() => {
      const el = calendarWrapperRef.current?.querySelector(".rbc-time-content");
      if (!el) return;
      // Each timeslot-group = 64px, 07:00 is the 8th row (index 7)
      el.scrollTop = 7 * 64;
    }, 50);
    return () => clearTimeout(timer);
  }, [loading, view]);

  const fetchAppointments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const { data } = await getAppointmentsWithClients(
      effectiveOrgId,
      isAdmin,
      undefined,
      staffOrgIds
    );
    setAppointments((data ?? []) as AppointmentWithClient[]);
    if (showLoader) setLoading(false);
  }, [effectiveOrgId, isAdmin, staffOrgIds]);

  useEffect(() => {
    if (orgLoading) return;
    fetchAppointments();
  }, [orgLoading, fetchAppointments]);

  const events: CalendarEvent[] = useMemo(
    () =>
      appointments.map((appt) => ({
        id: appt.id,
        title: appt.clients
          ? `${appt.clients.nome} ${appt.clients.cognome}`
          : appt.title,
        start: new Date(appt.start_time),
        end: new Date(appt.end_time),
        resource: appt,
      })),
    [appointments]
  );

  function handleSelectEvent(event: CalendarEvent) {
    setSelectedAppointment(event.resource);
    setDetailOpen(true);
  }

  function handleCancelAppointment(appointment: AppointmentWithClient) {
    setCancellingAppointment(appointment);
    setCancelFlowOpen(true);
  }

  function handleCompleteAppointment(appointment: AppointmentWithClient) {
    setCompletingAppointment(appointment);
    setCompletedFlowOpen(true);
  }

  function handleCompletedSessionDone() {
    if (completingAppointment) {
      setAppointments((prev) =>
        prev.filter((a) => a.id !== completingAppointment.id)
      );
    }
    setCompletedFlowOpen(false);
    setCompletingAppointment(null);
    fetchAppointments(false);
  }

  function handleCancelComplete() {
    // Optimistically remove the cancelled event from local state
    if (cancellingAppointment) {
      setAppointments((prev) =>
        prev.filter((a) => a.id !== cancellingAppointment.id)
      );
    }
    setCancelFlowOpen(false);
    setCancellingAppointment(null);
    // Background refresh to sync with DB (no loading spinner)
    fetchAppointments(false);
  }

  const messages = {
    today: "Oggi",
    previous: "Precedente",
    next: "Successivo",
    month: "Mese",
    week: "Settimana",
    day: "Giorno",
    agenda: "Agenda",
    date: "Data",
    time: "Ora",
    event: "Evento",
    noEventsInRange: "Nessun appuntamento in questo periodo.",
    showMore: (total: number) => `+${total} altri`,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Calendario
        </h1>
        <p className="text-muted-foreground">
          Visualizza e gestisci i tuoi appuntamenti.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Caricamento calendario...
          </p>
        </div>
      ) : (
        <div ref={calendarWrapperRef} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <BigCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={availableViews}
            step={60}
            timeslots={1}
            popup
            onSelectEvent={handleSelectEvent}
            components={{
              toolbar: CalendarToolbar,
              event: ({ event }: { event: CalendarEvent }) => {
                if (view === "month") {
                  return (
                    <span className="block truncate text-xs font-medium">
                      {format(event.start, "HH:mm")} {event.title}
                    </span>
                  );
                }
                const notes = event.resource.notes;
                return (
                  <div className="leading-tight">
                    <div className="font-bold text-[0.8125rem]">{event.title}</div>
                    <div className="text-[0.8125rem] opacity-90">
                      {format(event.start, "HH:mm")} – {format(event.end, "HH:mm")}
                    </div>
                    {notes && (
                      <div className="text-[0.6875rem] opacity-75 truncate mt-0.5">
                        {notes}
                      </div>
                    )}
                  </div>
                );
              },
              week: {
                header: ({ date: d }: { date: Date }) => {
                  const dayLabel = format(d, "EEE", { locale: it }).toUpperCase();
                  const dayNum = format(d, "d");
                  const today = isToday(d);
                  return (
                    <div className="flex flex-col items-center gap-0.5 py-1">
                      <span className="text-[0.875rem] font-medium text-muted-foreground">
                        {dayLabel}
                      </span>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[0.9375rem] font-semibold ${
                          today
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {dayNum}
                      </span>
                    </div>
                  );
                },
              },
            }}
            messages={messages}
            culture="it"
            style={{ height: view === "month" ? 700 : "auto" }}
            formats={{
              dayHeaderFormat: (d: Date) =>
                format(d, "EEEE d MMMM", { locale: it }),
              dayFormat: (d: Date) =>
                format(d, "EEE d", { locale: it }),
              timeGutterFormat: (d: Date) =>
                format(d, "HH:mm"),
              eventTimeRangeFormat: () => "",
            }}
          />
        </div>
      )}

      <AppointmentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selectedAppointment}
        onComplete={handleCompleteAppointment}
        onCancel={handleCancelAppointment}
      />

      <CompletedSessionDialog
        open={completedFlowOpen}
        onOpenChange={setCompletedFlowOpen}
        appointment={completingAppointment}
        onComplete={handleCompletedSessionDone}
      />

      <CancelAppointmentDialog
        open={cancelFlowOpen}
        onOpenChange={setCancelFlowOpen}
        appointment={cancellingAppointment}
        onComplete={handleCancelComplete}
      />
    </div>
  );
}
