"use client";
import { useEffect, useRef } from "react";

/**
 * DashboardTourO — Organization Dashboard first-time onboarding tour.
 *
 * SETUP: Run this once in your project root:
 *   npm install driver.js
 *
 * Place this file at: src/components/DashboardTourO.js
 */

const TOUR_KEY = "hasSeenOrgTour";

const STEPS = [
  {
    element: "#tour-sidebar",
    popover: {
      title: "👋 Welcome to Your Organization Dashboard!",
      description:
        "You're all set up! Let's walk through the dashboard so you can start managing events like a pro. This will only take a moment.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-profile",
    popover: {
      title: "🏢 Your Organization Profile",
      description:
        "Your organization name and avatar appear here. Click the ✏️ pencil icon to update your profile, logo, and contact details.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-dashboard",
    popover: {
      title: "🏠 Dashboard",
      description:
        "Your home base. Come back here anytime to see an overview of all your events, filter them, and track activity.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-addevent",
    popover: {
      title: "➕ Add Event",
      description:
        "Create a new event — set the title, type, date, venue, city, and description. Published events become visible to students immediately.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-attendance",
    popover: {
      title: "✅ Attendance",
      description:
        "Scan student QR codes or manually mark attendance for your events. Keep track of who actually showed up.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-removeevent",
    popover: {
      title: "🗑️ Remove Event",
      description:
        "Need to cancel an event? Remove it from here. This will also notify registered students.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-requests",
    popover: {
      title: "📋 Requests",
      description:
        "Students can request to join your events. Review, approve, or decline registration requests from here.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-notifications",
    popover: {
      title: "🔔 Notifications",
      description:
        "Important alerts — new registrations, system messages, and event updates — all appear here.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-add-event-btn",
    popover: {
      title: "⚡ Quick Add Event",
      description:
        "This shortcut at the top lets you jump straight to creating a new event without opening the side panel.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "#tour-event-filters",
    popover: {
      title: "🔍 Filter & Search",
      description:
        "Filter your events by type, city, or date. Use the search box to quickly find a specific event by name.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#tour-view-toggle",
    popover: {
      title: "📂 Your Events / Completed Events",
      description:
        "Switch between active upcoming events and past completed events using these tabs.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#tour-event-cards",
    popover: {
      title: "📅 Your Event Cards",
      description:
        "Each card shows an event you've created. Click View to see full details and registrations, or Edit to make changes.",
      side: "top",
      align: "start",
    },
  },
  {
    popover: {
      title: "🚀 You're ready to go!",
      description:
        "That covers everything! Start by adding your first event — students are waiting. Good luck and make it amazing! 🎊",
      side: "over",
      align: "center",
    },
  },
];

export default function DashboardTourO({ organizerId }) {
  const driverRef = useRef(null);

  useEffect(() => {
    if (!organizerId) return;

    const key = `${TOUR_KEY}:${organizerId}`;
    if (localStorage.getItem(key)) return;

    // Dynamically import driver.js so it only loads client-side
    import("driver.js").then(({ driver }) => {
      import("driver.js/dist/driver.css").catch(() => {});

      setTimeout(() => {
        driverRef.current = driver({
          animate: true,
          smoothScroll: true,
          allowClose: true,
          overlayOpacity: 0.55,
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: "dashboard-tour-popover",
          nextBtnText: "Next →",
          prevBtnText: "← Back",
          doneBtnText: "Let's go! 🎉",
          onDestroyStarted: () => {
            localStorage.setItem(key, "true");
            driverRef.current.destroy();
          },
          steps: STEPS,
        });

        driverRef.current.drive();
      }, 600);
    });

    return () => {
      driverRef.current?.destroy();
    };
  }, [organizerId]);

  return null;
}
