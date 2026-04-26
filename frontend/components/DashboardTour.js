"use client";
import { useEffect, useRef } from "react";

/**
 * DashboardTour — Student Dashboard first-time onboarding tour.
 *
 * SETUP: Run this once in your project root:
 *   npm install driver.js
 *
 * Place this file at: src/components/DashboardTour.js
 */

const TOUR_KEY = "hasSeenStudentTour";

const STEPS = [
  {
    element: "#tour-sidebar",
    popover: {
      title: "👋 Welcome to Your Dashboard!",
      description:
        "This is your personal command centre. Let's take a quick 30-second tour so you know exactly where everything is.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-profile",
    popover: {
      title: "🧑 Your Profile",
      description:
        "This shows your name and avatar. Click the ✏️ pencil icon to edit your profile, upload a photo, and update your details.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-dashboard",
    popover: {
      title: "🏠 Dashboard",
      description:
        "You are here! Come back to this page anytime to browse and register for events.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-qr",
    popover: {
      title: "📱 QR Code",
      description:
        "Your personal QR code for event check-ins. Show this to organizers when you arrive at an event.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-achievements",
    popover: {
      title: "🏆 Achievements",
      description:
        "Track your badges and milestones. Every event you attend earns you points — collect them all!",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-addevent",
    popover: {
      title: "➕ Add Event",
      description:
        "Want to host something yourself? Create and publish your own event here.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-removeevent",
    popover: {
      title: "🗑️ Remove Event",
      description:
        "Manage events you've created. You can remove any event you own from this page.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-requests",
    popover: {
      title: "📋 Requests",
      description:
        "View and manage your event registration requests and their approval status.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-nav-notifications",
    popover: {
      title: "🔔 Notifications",
      description:
        "Stay up to date — event updates, approvals, and announcements all land here.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#tour-event-filters",
    popover: {
      title: "🔍 Filter Events",
      description:
        "Narrow down events by type, city, date, or search by keyword. The 'Recommended' filter shows events tailored to your interests.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#tour-event-cards",
    popover: {
      title: "🎉 Event Cards",
      description:
        "Browse available events here. Hit Register to sign up instantly, or View Details to learn more before committing.",
      side: "top",
      align: "start",
    },
  },
  {
    popover: {
      title: "🚀 You're all set!",
      description:
        "That's everything! Explore events, earn achievements, and make the most of your time. Good luck and have fun! 🎊",
      side: "over",
      align: "center",
    },
  },
];

export default function DashboardTour({ userId }) {
  const driverRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const key = `${TOUR_KEY}:${userId}`;
    if (localStorage.getItem(key)) return;

    // Dynamically import driver.js so it only loads client-side
    import("driver.js").then(({ driver }) => {
      // Also import the CSS once
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
  }, [userId]);

  return null;
}
