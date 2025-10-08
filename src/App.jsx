// TodoApp.jsx
// Industry-Grade React Todo Application with PWA & iOS Support
// -------------------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";

// ---------------------- Constants ----------------------

const STORAGE_KEY = "todoapp.tasks.pro";
const HISTORY_STORAGE_KEY = "todoapp.history.pro";
const APP_TITLE = "ChronoTask Pro";
const BANGLADESH_TZ = "Asia/Dhaka";
const NOTIFICATION_LEVELS = [
  { hours: 5, label: "5 hours", color: "text-blue-600" },
  { hours: 2, label: "2 hours", color: "text-indigo-600" },
  { hours: 1, label: "1 hour", color: "text-purple-600" },
  { hours: 0.5, label: "30 minutes", color: "text-orange-600" },
  { hours: 10 / 60, label: "10 minutes", color: "text-red-600" },
];

const PWA_CONFIG = {
  appName: "ChronoTask Pro",
  shortName: "ChronoTask",
  themeColor: "#3b82f6",
  backgroundColor: "#ffffff",
};

// ---------------------- Custom Hooks ----------------------

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const useCountdown = (targetDate) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    totalMinutes: 0,
  });

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isOverdue: true,
          totalMinutes: 0,
        };
      }

      const totalMinutes = Math.floor(difference / (1000 * 60));

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        isOverdue: false,
        totalMinutes,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
};

const useLiveTime = () => {
  const [currentTime, setCurrentTime] = useState({
    utc: new Date().toISOString(),
    local: new Date(),
    bangladesh: "",
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime({
        utc: now.toISOString(),
        local: now,
        bangladesh: formatForDisplay(now.toISOString(), BANGLADESH_TZ, true),
      });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  return currentTime;
};

// PWA Hook
const usePWA = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if app is running in standalone mode
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );

    // Check for service worker and beforeinstallprompt support
    setSupportsPWA(
      "serviceWorker" in navigator && "BeforeInstallPromptEvent" in window
    );

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      console.log("PWA was installed");
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered: ", registration);
        })
        .catch((registrationError) => {
          console.log("SW registration failed: ", registrationError);
        });
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    }
  };

  return { isStandalone, supportsPWA, deferredPrompt, installPWA };
};

// Enhanced notification hook for iOS compatibility
const useIOSNotifications = () => {
  const [permission, setPermission] = useState("default");
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Check current permission
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      throw new Error("Notifications not supported");
    }

    // iOS-specific handling
    if (isIOS) {
      // On iOS, we need to request permission through a user gesture
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        // Create a welcome notification
        new Notification("🔔 ChronoTask Pro", {
          body: "Notifications enabled! You will receive reminders for upcoming tasks.",
          icon: "/icons/icon-192.png",
          badge: "/icons/badge-72.png",
          tag: "welcome",
        });
      }
      return result;
    } else {
      // Standard permission request for other platforms
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
  };

  const showNotification = (title, options = {}) => {
    if (permission !== "granted") return null;

    const notificationOptions = {
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: "chronotask-reminder",
      requireInteraction: true,
      ...options,
    };

    // iOS-specific options
    if (isIOS) {
      notificationOptions.silent = false;
      notificationOptions.vibrate = [200, 100, 200];
    }

    return new Notification(title, notificationOptions);
  };

  return { permission, isIOS, requestPermission, showNotification };
};

// Enhanced notification system
const useEnhancedNotifications = (activeTasks) => {
  const { permission, showNotification, isIOS } = useIOSNotifications();
  const notificationCheckRef = useRef(null);
  const notifiedTasksRef = useRef(new Set());

  useEffect(() => {
    if (permission !== "granted") return;

    const checkNotifications = () => {
      const now = new Date();

      activeTasks.forEach((task) => {
        if (task.dueUtc) {
          const dueDate = new Date(task.dueUtc);
          const timeLeft = dueDate - now;
          const minutesLeft = Math.floor(timeLeft / (1000 * 60));

          NOTIFICATION_LEVELS.forEach((level) => {
            const thresholdMinutes = level.hours * 60;
            const notificationKey = `task-${task.id}-${level.hours}`;

            if (
              minutesLeft <= thresholdMinutes &&
              minutesLeft > thresholdMinutes - 1
            ) {
              if (!notifiedTasksRef.current.has(notificationKey)) {
                // Use the enhanced notification system
                showNotification(`⏰ ${level.label} reminder: ${task.title}`, {
                  body: `Due: ${getBangladeshTime(task.dueUtc)}\nClient: ${
                    task.clientName || "N/A"
                  }`,
                  tag: notificationKey,
                  data: {
                    taskId: task.id,
                    type: "reminder",
                    level: level.label,
                  },
                });

                notifiedTasksRef.current.add(notificationKey);
              }
            }
          });

          // Clean up old notifications
          if (minutesLeft > 5 * 60) {
            NOTIFICATION_LEVELS.forEach((level) => {
              const notificationKey = `task-${task.id}-${level.hours}`;
              notifiedTasksRef.current.delete(notificationKey);
            });
          }
        }
      });
    };

    notificationCheckRef.current = setInterval(checkNotifications, 60000);
    checkNotifications();

    return () => {
      if (notificationCheckRef.current) {
        clearInterval(notificationCheckRef.current);
      }
    };
  }, [activeTasks, permission, showNotification]);

  return { permission };
};

// ---------------------- Utilities ----------------------

const nowUtcIso = () => new Date().toISOString();

const formatForDisplay = (iso, timeZone, includeSeconds = false) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const opts = {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timeZone || "UTC",
    };

    if (includeSeconds) {
      opts.second = "2-digit";
    }

    return new Intl.DateTimeFormat(undefined, opts).format(d);
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Invalid Date";
  }
};

const getBangladeshTime = (iso) => {
  return formatForDisplay(iso, BANGLADESH_TZ, true);
};

const getUtcTime = (iso) => {
  return formatForDisplay(iso, "UTC", true);
};

const datetimeLocalToUtcIso = (value, interpretAsUtc = true) => {
  if (!value) return "";

  try {
    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) {
      throw new Error("Invalid datetime-local format");
    }

    const [yearStr, monthStr, dayStr] = datePart.split("-");
    const [hourStr = "0", minuteStr = "0"] = timePart.split(":");

    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if ([year, month, day, hour, minute].some(Number.isNaN)) {
      throw new Error("Invalid numeric values in datetime");
    }

    if (interpretAsUtc) {
      const ms = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
      return new Date(ms).toISOString();
    }

    const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
    return localDate.toISOString();
  } catch (error) {
    throw new Error(`Failed to parse datetime: ${error.message}`);
  }
};

const utcIsoToLocalInputValue = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (error) {
    console.error("Date conversion error:", error);
    return "";
  }
};

const genId = () => {
  return (
    crypto.randomUUID?.() ||
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
};

const addToHistory = (action, task, oldValue = null, newValue = null) => {
  try {
    const existing = JSON.parse(
      localStorage.getItem(HISTORY_STORAGE_KEY) || "[]"
    );
    const historyEntry = {
      id: genId(),
      timestamp: nowUtcIso(),
      action,
      taskId: task.id,
      taskTitle: task.title,
      clientName: task.clientName,
      clientCountry: task.clientCountry,
      dueUtc: task.dueUtc,
      notes: task.notes,
      oldValue,
      newValue,
      completedAt: action === "completed" ? nowUtcIso() : null,
    };

    const updatedHistory = [historyEntry, ...existing.slice(0, 499)];
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to save history:", error);
  }
};

const getQuickTimes = () => {
  const now = new Date();
  return [
    {
      label: "1 hour",
      value: new Date(now.getTime() + 60 * 60 * 1000),
      display: getBangladeshTime(
        new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      ),
      icon: "⏱️",
    },
    {
      label: "2 hours",
      value: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      display: getBangladeshTime(
        new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
      ),
      icon: "🕑",
    },
    {
      label: "5 hours",
      value: new Date(now.getTime() + 5 * 60 * 60 * 1000),
      display: getBangladeshTime(
        new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString()
      ),
      icon: "🕔",
    },
    {
      label: "Tomorrow",
      value: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      display: getBangladeshTime(
        new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      ),
      icon: "🌅",
    },
    {
      label: "Next week",
      value: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      display: getBangladeshTime(
        new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      ),
      icon: "📅",
    },
  ];
};

// ---------------------- Components ----------------------

const LoadingSpinner = ({ size = "md", className = "" }) => (
  <div
    className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 ${className} ${
      size === "sm" ? "w-4 h-4" : size === "md" ? "w-6 h-6" : "w-8 h-8"
    }`}
  />
);

const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { bg: "bg-emerald-500", icon: "✅" },
    error: { bg: "bg-rose-500", icon: "❌" },
    warning: { bg: "bg-amber-500", icon: "⚠️" },
    info: { bg: "bg-blue-500", icon: "💡" },
  }[type];

  return (
    <div
      className={`${config.bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-80 animate-slide-in-right`}
    >
      <span className="text-lg">{config.icon}</span>
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-200"
      >
        ×
      </button>
    </div>
  );
};

const LiveTimeDisplay = () => {
  const currentTime = useLiveTime();

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-2xl border border-slate-700">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
          <h3 className="text-lg font-semibold text-slate-200">
            Live Time Tracker
          </h3>
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-700 bg-opacity-50 rounded-2xl p-5 border border-slate-600 transition-all duration-300 hover:border-slate-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="text-slate-300 text-sm font-medium">UTC Time</div>
          </div>
          <div className="text-2xl lg:text-3xl font-mono font-bold text-blue-300">
            {getUtcTime(currentTime.utc)}
          </div>
        </div>
        <div className="bg-slate-700 bg-opacity-50 rounded-2xl p-5 border border-slate-600 transition-all duration-300 hover:border-slate-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <div className="text-slate-300 text-sm font-medium">
              Bangladesh (Asia/Dhaka)
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-mono font-bold text-emerald-300">
            {currentTime.bangladesh}
          </div>
        </div>
      </div>
    </div>
  );
};

const CountdownTimer = ({ targetDate, taskTitle, compact = false }) => {
  const timeLeft = useCountdown(targetDate);

  if (!targetDate) return null;

  const getTimerConfig = () => {
    if (timeLeft.isOverdue) {
      return {
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-200",
        label: "Overdue",
      };
    }
    if (timeLeft.totalMinutes <= 10) {
      return {
        color: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-200",
        label: "Urgent",
      };
    }
    if (timeLeft.totalMinutes <= 30) {
      return {
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        label: "Soon",
      };
    }
    if (timeLeft.totalMinutes <= 60) {
      return {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        label: "Approaching",
      };
    }
    if (timeLeft.totalMinutes <= 120) {
      return {
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "Upcoming",
      };
    }
    return {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      label: "Planned",
    };
  };

  const timerConfig = getTimerConfig();

  const getTimerText = () => {
    if (timeLeft.isOverdue) {
      const overdueMinutes = Math.abs(timeLeft.totalMinutes);
      if (overdueMinutes < 60) return `${overdueMinutes}m overdue`;
      return `${Math.floor(overdueMinutes / 60)}h ${
        overdueMinutes % 60
      }m overdue`;
    }

    if (timeLeft.days > 0) {
      return `${timeLeft.days}d ${timeLeft.hours}h`;
    }

    if (timeLeft.hours > 0) {
      return `${timeLeft.hours}h ${timeLeft.minutes}m`;
    }

    return `${timeLeft.minutes}m ${timeLeft.seconds}s`;
  };

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${timerConfig.color} ${timerConfig.bg} ${timerConfig.border}`}
      >
        <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div>
        {getTimerText()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${timerConfig.bg} ${timerConfig.border}`}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${timerConfig.color}`}>
                {getTimerText()}
              </span>
              <span className="text-xs text-slate-500">until</span>
            </div>
            <div className="text-sm text-slate-700 font-medium truncate">
              "{taskTitle}"
            </div>
          </div>
        </div>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            timerConfig.color
          } ${timerConfig.bg.replace("50", "100")}`}
        >
          {timerConfig.label}
        </div>
      </div>
    </div>
  );
};

const QuickTimeButtons = ({ onTimeSelect, currentValue }) => {
  const quickTimes = getQuickTimes();
  const [showAll, setShowAll] = useState(false);

  const visibleTimes = showAll ? quickTimes : quickTimes.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
        {visibleTimes.map((time, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onTimeSelect(time.value)}
            className={`p-3 rounded-xl border-2 transition-all duration-300 text-left group hover:scale-105 active:scale-95 ${
              currentValue === utcIsoToLocalInputValue(time.value.toISOString())
                ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{time.icon}</span>
              <span
                className={`font-semibold text-sm ${
                  currentValue ===
                  utcIsoToLocalInputValue(time.value.toISOString())
                    ? "text-blue-700"
                    : "text-slate-700"
                }`}
              >
                {time.label}
              </span>
            </div>
            <div
              className={`text-xs ${
                currentValue ===
                utcIsoToLocalInputValue(time.value.toISOString())
                  ? "text-blue-600"
                  : "text-slate-500"
              }`}
            >
              BD: {time.display}
            </div>
          </button>
        ))}
      </div>

      {!showAll && quickTimes.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-slate-600 hover:text-slate-800 text-sm font-medium rounded-lg border border-dashed border-slate-300 hover:border-slate-400 transition-all duration-200"
        >
          Show more time options
        </button>
      )}
    </div>
  );
};

const HistoryPanel = ({ isOpen, onClose, tasks }) => {
  const [history, setHistory] = useState([]);
  const currentTime = useLiveTime();

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = JSON.parse(
          localStorage.getItem(HISTORY_STORAGE_KEY) || "[]"
        );
        // Only show completed tasks in history
        const completedHistory = stored.filter(
          (item) => item.action === "completed"
        );
        setHistory(completedHistory);
      } catch (error) {
        console.error("Failed to load history:", error);
      }
    }
  }, [isOpen]);

  const clearHistory = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all completed task history? This action cannot be undone."
      )
    ) {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([]));
      setHistory([]);
    }
  };

  const getCompletionStats = () => {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const completedThisWeek = history.filter(
      (item) => new Date(item.completedAt) > lastWeek
    ).length;

    const completedToday = history.filter((item) => {
      const completedDate = new Date(item.completedAt);
      return completedDate.toDateString() === today.toDateString();
    }).length;

    return {
      completedThisWeek,
      completedToday,
      totalCompleted: history.length,
    };
  };

  const stats = getCompletionStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 safe-area-inset">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Completed Tasks History
            </h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
              <span>
                UTC: <strong>{getUtcTime(currentTime.utc)}</strong>
              </span>
              <span>
                Bangladesh: <strong>{currentTime.bangladesh}</strong>
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearHistory}
              className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 font-medium"
            >
              Clear History
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-xl border border-slate-200">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalCompleted}
                </div>
                <div className="text-sm text-slate-600">Total Completed</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl border border-slate-200">
                <div className="text-2xl font-bold text-green-600">
                  {stats.completedThisWeek}
                </div>
                <div className="text-sm text-slate-600">This Week</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl border border-slate-200">
                <div className="text-2xl font-bold text-emerald-600">
                  {stats.completedToday}
                </div>
                <div className="text-sm text-slate-600">Today</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-xl font-semibold mb-2">
                No completed tasks yet
              </h3>
              <p>Completed tasks will appear here automatically</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 p-5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white transition-all duration-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-lg">✅</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg text-sm">
                        Completed
                      </span>
                      <span className="text-sm text-slate-500">
                        {getBangladeshTime(entry.completedAt)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-semibold text-slate-900">
                        {entry.taskTitle}
                      </h4>

                      {(entry.clientName || entry.clientCountry) && (
                        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                          {entry.clientName && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                              👤 {entry.clientName}
                            </span>
                          )}
                          {entry.clientCountry && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
                              🌍 {entry.clientCountry}
                            </span>
                          )}
                        </div>
                      )}

                      {entry.notes && (
                        <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                          {entry.notes}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500">
                        <div>
                          <span className="font-medium">Original Due:</span>{" "}
                          {getBangladeshTime(entry.dueUtc)}
                        </div>
                        <div>
                          <span className="font-medium">Completed:</span>{" "}
                          {getBangladeshTime(entry.completedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-3xl">
          <div className="flex justify-between items-center text-sm text-slate-600">
            <span>Showing {history.length} completed tasks</span>
            <div className="flex gap-4">
              <span>
                UTC: <strong>{getUtcTime(currentTime.utc)}</strong>
              </span>
              <span>
                BD: <strong>{currentTime.bangladesh}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskItem = ({ task, onToggle, onEdit, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNotes, setEditNotes] = useState(task.notes || "");
  const [editClientName, setEditClientName] = useState(task.clientName || "");
  const [editClientCountry, setEditClientCountry] = useState(
    task.clientCountry || ""
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const currentTime = useLiveTime();

  const handleSave = () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    const oldTitle = task.title;
    onUpdate(
      task.id,
      {
        title: trimmedTitle,
        notes: editNotes.trim() || undefined,
        clientName: editClientName.trim() || undefined,
        clientCountry: editClientCountry.trim() || undefined,
      },
      oldTitle,
      trimmedTitle
    );
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditNotes(task.notes || "");
    setEditClientName(task.clientName || "");
    setEditClientCountry(task.clientCountry || "");
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const timeLeft = useCountdown(task.dueUtc);

  return (
    <li className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 hover:border-slate-300">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={() => onToggle(task.id)}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
              task.completed
                ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "border-slate-300 hover:border-emerald-400 bg-white hover:shadow-lg"
            }`}
          >
            {task.completed && (
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-4" onKeyDown={handleKeyPress}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-lg font-semibold border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 pb-2 bg-transparent"
                  autoFocus
                  placeholder="Task title..."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      👤 Client Name
                    </label>
                    <input
                      type="text"
                      value={editClientName}
                      onChange={(e) => setEditClientName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Client name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      🌍 Client Country
                    </label>
                    <input
                      type="text"
                      value={editClientCountry}
                      onChange={(e) => setEditClientCountry(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Client country"
                    />
                  </div>
                </div>

                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes..."
                  className="w-full text-sm text-slate-600 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200"
                  rows="3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-slate-500 text-white rounded-lg font-medium hover:bg-slate-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <h3
                        className={`text-lg font-semibold flex-1 ${
                          task.completed
                            ? "line-through text-slate-400"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.dueUtc && !task.completed && (
                        <CountdownTimer
                          targetDate={task.dueUtc}
                          taskTitle={task.title}
                          compact={true}
                        />
                      )}
                    </div>

                    {(task.clientName || task.clientCountry) && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {task.clientName && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            👤 {task.clientName}
                          </span>
                        )}
                        {task.clientCountry && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                            🌍 {task.clientCountry}
                          </span>
                        )}
                      </div>
                    )}

                    {task.notes && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                        {task.notes}
                      </p>
                    )}

                    {/* Full Countdown Timer */}
                    {task.dueUtc && !task.completed && (
                      <div className="mt-3">
                        <CountdownTimer
                          targetDate={task.dueUtc}
                          taskTitle={task.title}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 ml-4 flex-shrink-0">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 transform hover:scale-110"
                      title="Edit task"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 transform hover:scale-110"
                      title="Delete task"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200 transform hover:scale-110"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-slide-down">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">
                            Time Information
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                              <span className="text-sm text-slate-600">
                                UTC Time
                              </span>
                              <span className="font-mono text-sm font-semibold text-slate-900">
                                {getUtcTime(task.dueUtc)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                              <span className="text-sm text-slate-600">
                                Bangladesh Time
                              </span>
                              <span className="font-mono text-sm font-semibold text-emerald-600">
                                {getBangladeshTime(task.dueUtc)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                              <span className="text-sm text-slate-600">
                                Your Local Time
                              </span>
                              <span className="font-mono text-sm font-semibold text-blue-600">
                                {formatForDisplay(task.dueUtc, undefined, true)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">
                            Task Details
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                              <span className="text-sm text-slate-600">
                                Created
                              </span>
                              <span className="font-mono text-sm text-slate-900">
                                {formatForDisplay(task.createdAtUtc, "UTC")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                              <span className="text-sm text-slate-600">
                                Status
                              </span>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  task.completed
                                    ? "bg-emerald-100 text-emerald-800"
                                    : timeLeft.isOverdue
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {task.completed
                                  ? "Completed"
                                  : timeLeft.isOverdue
                                  ? "Overdue"
                                  : "Active"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">
                            Quick Actions
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() => {
                                const newDue = new Date();
                                newDue.setDate(newDue.getDate() + 1);
                                onUpdate(task.id, {
                                  dueUtc: newDue.toISOString(),
                                });
                              }}
                              className="flex items-center gap-3 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all duration-200 border border-blue-200"
                            >
                              <span>⏰</span>
                              <span>Set due tomorrow</span>
                            </button>
                            <button
                              onClick={() =>
                                onUpdate(task.id, {
                                  notes:
                                    "Updated: " +
                                    new Date().toLocaleString() +
                                    " - " +
                                    (task.notes || ""),
                                })
                              }
                              className="flex items-center gap-3 px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all duration-200 border border-emerald-200"
                            >
                              <span>📝</span>
                              <span>Update notes</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

// PWA Components
const PWAInstallPrompt = ({
  supportsPWA,
  isStandalone,
  deferredPrompt,
  installPWA,
}) => {
  if (!supportsPWA || isStandalone || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-2xl shadow-2xl z-40 animate-bounce safe-area-inset">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📱</div>
          <div>
            <div className="font-semibold">Install ChronoTask Pro</div>
            <div className="text-sm text-blue-100">
              Get the app experience with home screen access
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={installPWA}
            className="px-4 py-2 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all duration-200"
          >
            Install
          </button>
          <button
            onClick={() => {}}
            className="px-4 py-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all duration-200"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

const IOSInstallGuide = ({ isIOS, isStandalone }) => {
  if (!isIOS || isStandalone) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📱</div>
        <div className="flex-1">
          <h4 className="font-semibold text-amber-800 mb-1">
            Install ChronoTask Pro on your iPhone
          </h4>
          <p className="text-amber-700 text-sm mb-2">
            For the best experience, add this app to your home screen:
          </p>
          <ol className="text-amber-700 text-sm list-decimal list-inside space-y-1">
            <li>
              Tap the Share button <span className="font-mono">⎗</span> at the
              bottom
            </li>
            <li>Scroll down and tap "Add to Home Screen"</li>
            <li>Tap "Add" in the top right corner</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

// ---------------------- Main Component ----------------------

export default function TodoApp() {
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEY, []);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCountry, setClientCountry] = useState("");
  const [dueLocalInputValue, setDueLocalInputValue] = useState("");
  const [interpretAsUtc, setInterpretAsUtc] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due");
  const [toasts, setToasts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activeTasks = useMemo(() => {
    return tasks.filter((task) => !task.completed);
  }, [tasks]);

  const titleRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  // PWA Hooks
  const { isStandalone, supportsPWA, deferredPrompt, installPWA } = usePWA();
  const {
    permission: notificationPermission,
    requestPermission,
    isIOS,
  } = useIOSNotifications();
  const { permission: enhancedNotificationPermission } =
    useEnhancedNotifications(activeTasks);
  const currentTime = useLiveTime();

  // Filter tasks to only show active tasks (not completed)

  // Find next upcoming task from active tasks only
  const nextUpcomingTask = useMemo(() => {
    const upcoming = activeTasks
      .filter((task) => task.dueUtc && new Date(task.dueUtc) > new Date())
      .sort((a, b) => new Date(a.dueUtc) - new Date(b.dueUtc))[0];

    return upcoming;
  }, [activeTasks]);

  const addToast = (message, type = "info") => {
    const id = genId();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const filteredTasks = useMemo(() => {
    let arr = activeTasks.slice(); // Only show active tasks

    if (filter === "active") arr = arr.filter((t) => !t.completed);
    if (filter === "completed") arr = arr.filter((t) => t.completed);

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
          (t.clientName || "").toLowerCase().includes(q) ||
          (t.clientCountry || "").toLowerCase().includes(q)
      );
    }

    arr.sort((a, b) => {
      switch (sortBy) {
        case "due":
          if (!a.dueUtc && !b.dueUtc) return 0;
          if (!a.dueUtc) return 1;
          if (!b.dueUtc) return -1;
          return new Date(a.dueUtc).getTime() - new Date(b.dueUtc).getTime();

        case "created":
          return (
            new Date(b.createdAtUtc).getTime() -
            new Date(a.createdAtUtc).getTime()
          );

        case "title":
          return a.title.localeCompare(b.title);

        case "client":
          return (a.clientName || "").localeCompare(b.clientName || "");

        default:
          return 0;
      }
    });

    return arr;
  }, [activeTasks, debouncedQuery, filter, sortBy]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
      active: activeTasks.length,
      overdue: activeTasks.filter(
        (t) => t.dueUtc && new Date(t.dueUtc) < new Date()
      ).length,
      dueSoon: activeTasks.filter(
        (t) =>
          t.dueUtc &&
          new Date(t.dueUtc) > new Date() &&
          new Date(t.dueUtc) <= new Date(Date.now() + 5 * 60 * 60 * 1000)
      ).length,
      withClients: activeTasks.filter((t) => t.clientName || t.clientCountry)
        .length,
    }),
    [tasks, activeTasks]
  );

  const addTask = async (e) => {
    if (e) e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      addToast("Please enter a task title", "warning");
      titleRef.current?.focus();
      return;
    }

    setIsLoading(true);

    try {
      let dueUtc = null;
      if (dueLocalInputValue) {
        dueUtc = datetimeLocalToUtcIso(dueLocalInputValue, interpretAsUtc);
      }

      const newTask = {
        id: genId(),
        title: trimmedTitle,
        notes: notes.trim() || undefined,
        clientName: clientName.trim() || undefined,
        clientCountry: clientCountry.trim() || undefined,
        dueUtc,
        completed: false,
        createdAtUtc: nowUtcIso(),
      };

      setTasks((prev) => [newTask, ...prev]);
      addToHistory("created", newTask);

      setTitle("");
      setNotes("");
      setClientName("");
      setClientCountry("");
      setDueLocalInputValue("");

      addToast("Task added successfully!", "success");
      titleRef.current?.focus();
    } catch (error) {
      addToast(`Error adding task: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const updateTask = (id, updates, oldValue = null, newValue = null) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );

    const task = tasks.find((t) => t.id === id);
    if (task) {
      addToHistory("updated", { ...task, ...updates }, oldValue, newValue);
    }

    addToast("Task updated successfully!", "success");
  };

  const toggleComplete = (id) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === id) {
          const updated = { ...task, completed: !task.completed };
          if (updated.completed) {
            // When marking as completed, add to history and it will disappear from main list
            addToHistory("completed", updated);
            addToast(`Task completed: "${updated.title}"`, "success");
          } else {
            // When un-completing, it will reappear in main list
            addToHistory("uncompleted", updated);
            addToast(`Task re-opened: "${updated.title}"`, "info");
          }
          return updated;
        }
        return task;
      })
    );
  };

  const deleteTask = (id) => {
    const taskToDelete = tasks.find((task) => task.id === id);
    setTasks((prev) => prev.filter((task) => task.id !== id));

    if (taskToDelete) {
      addToHistory("deleted", taskToDelete);
    }

    addToast("Task deleted", "info");
  };

  const clearCompleted = () => {
    const completedTasks = tasks.filter((task) => task.completed);
    setTasks((prev) => prev.filter((task) => !task.completed));

    completedTasks.forEach((task) => {
      addToHistory("deleted", task);
    });

    addToast("Completed tasks cleared from history", "success");
  };

  const exportJson = () => {
    try {
      const data = {
        tasks,
        history: JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]"),
        exportedAt: nowUtcIso(),
        bangladeshTime: getBangladeshTime(nowUtcIso()),
        utcTime: getUtcTime(nowUtcIso()),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chronotask-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast("Backup exported successfully!", "success");
    } catch (error) {
      addToast("Export failed", "error");
    }
  };

  const importJson = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const tasksToImport = data.tasks || data;

        if (!Array.isArray(tasksToImport)) throw new Error("Invalid format");

        const normalized = tasksToImport.map((task) => ({
          id: task.id || genId(),
          title: task.title || "Untitled",
          notes: task.notes,
          clientName: task.clientName,
          clientCountry: task.clientCountry,
          dueUtc: task.dueUtc || null,
          completed: !!task.completed,
          createdAtUtc: task.createdAtUtc || nowUtcIso(),
        }));

        setTasks((prev) => [...normalized, ...prev]);

        if (data.history && Array.isArray(data.history)) {
          const existingHistory = JSON.parse(
            localStorage.getItem(HISTORY_STORAGE_KEY) || "[]"
          );
          const mergedHistory = [...data.history, ...existingHistory].slice(
            0,
            499
          );
          localStorage.setItem(
            HISTORY_STORAGE_KEY,
            JSON.stringify(mergedHistory)
          );
        }

        addToast(
          `${normalized.length} tasks imported successfully!`,
          "success"
        );
      } catch (error) {
        addToast("Invalid backup file", "error");
      }
    };
    reader.readAsText(file);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      addToast("Notifications not supported in this browser", "warning");
      return;
    }

    if (Notification.permission === "granted") {
      addToast("Notifications already enabled", "info");
      return;
    }

    try {
      // Use the enhanced permission request
      const result = await requestPermission();

      if (result === "granted") {
        addToast("Notifications enabled successfully!", "success");

        // Show welcome notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("🔔 ChronoTask Pro", {
            body: "You will receive smart reminders before tasks are due",
            icon: "/icons/icon-192.png",
            badge: "/icons/badge-72.png",
            tag: "welcome",
          });
        }
      } else if (result === "denied") {
        addToast(
          "Notifications blocked. Please enable them in your browser settings to receive reminders.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Notification error:", error);
      addToast("Failed to enable notifications", "error");
    }
  };

  const handleQuickTimeSelect = (date) => {
    setDueLocalInputValue(utcIsoToLocalInputValue(date.toISOString()));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 safe-area-inset">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt
        supportsPWA={supportsPWA}
        isStandalone={isStandalone}
        deferredPrompt={deferredPrompt}
        installPWA={installPWA}
      />

      {/* iOS Install Guide */}
      <IOSInstallGuide isIOS={isIOS} isStandalone={isStandalone} />

      {/* History Panel */}
      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        tasks={tasks}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 bg-clip-text text-transparent mb-3">
              {APP_TITLE}
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Professional task management - Active tasks disappear when
              completed, view history for completed work
            </p>
          </div>

          {/* Live Time Display */}
          <div className="mb-6">
            <LiveTimeDisplay />
          </div>

          {/* Next Upcoming Task */}
          {nextUpcomingTask && (
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-2xl mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <h3 className="text-lg font-semibold text-blue-100">
                      Next Upcoming Task
                    </h3>
                  </div>
                  <p className="text-xl font-bold mb-2">
                    {nextUpcomingTask.title}
                  </p>
                  {(nextUpcomingTask.clientName ||
                    nextUpcomingTask.clientCountry) && (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {nextUpcomingTask.clientName && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-400/30 text-blue-100 rounded-full text-sm">
                          👤 {nextUpcomingTask.clientName}
                        </span>
                      )}
                      {nextUpcomingTask.clientCountry && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-400/30 text-purple-100 rounded-full text-sm">
                          🌍 {nextUpcomingTask.clientCountry}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-blue-100">
                    Due: {getBangladeshTime(nextUpcomingTask.dueUtc)}
                  </p>
                </div>
                <CountdownTimer
                  targetDate={nextUpcomingTask.dueUtc}
                  taskTitle={nextUpcomingTask.title}
                />
              </div>
            </div>
          )}

          {/* Stats Overview */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-slate-200/60 max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span>
                    Active:{" "}
                    <strong className="text-slate-900">{stats.active}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>
                    Completed:{" "}
                    <strong className="text-slate-900">
                      {stats.completed}
                    </strong>
                  </span>
                </div>
                {stats.overdue > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                    <span className="text-rose-600">
                      Overdue: <strong>{stats.overdue}</strong>
                    </span>
                  </div>
                )}
                {stats.dueSoon > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <span className="text-amber-600">
                      Due Soon: <strong>{stats.dueSoon}</strong>
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-all duration-200 text-sm font-medium"
                >
                  <span>📜</span>
                  View History ({stats.completed})
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Sidebar - Form & Controls */}
          <div className="xl:col-span-1 space-y-6">
            {/* Add Task Form */}
            <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Create New Task
                </h2>
              </div>

              <form onSubmit={addTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Task Title *
                  </label>
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                    placeholder="What needs to be done?"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      👤 Client Name
                    </label>
                    <input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                      placeholder="Client name"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      🌍 Client Country
                    </label>
                    <input
                      value={clientCountry}
                      onChange={(e) => setClientCountry(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                      placeholder="Client country"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 resize-none"
                    rows="3"
                    placeholder="Additional details..."
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Due Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={dueLocalInputValue}
                    onChange={(e) => setDueLocalInputValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mb-3 bg-white/50"
                    disabled={isLoading}
                  />

                  <QuickTimeButtons
                    onTimeSelect={handleQuickTimeSelect}
                    currentValue={dueLocalInputValue}
                  />

                  <div className="flex items-center gap-3 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      id="interpretUtc"
                      type="checkbox"
                      checked={interpretAsUtc}
                      onChange={(e) => setInterpretAsUtc(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      disabled={isLoading}
                    />
                    <label
                      htmlFor="interpretUtc"
                      className="text-sm text-slate-700"
                    >
                      Interpret input as UTC (recommended for teams)
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !title.trim()}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" className="border-t-white" />
                  ) : (
                    "➕"
                  )}
                  {isLoading ? "Creating..." : "Create Task"}
                </button>
              </form>
            </section>

            {/* Quick Actions */}
            <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Quick Actions
                </h3>
              </div>

              <div className="space-y-3">
                <button
                  onClick={requestNotifications}
                  disabled={notificationPermission === "granted"}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-200 border ${
                    notificationPermission === "granted"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  <span className="text-lg">
                    {notificationPermission === "granted" ? "🔔" : "🔕"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">
                      {notificationPermission === "granted"
                        ? "Notifications Enabled"
                        : "Enable Notifications"}
                    </div>
                    {isIOS && notificationPermission !== "granted" && (
                      <div className="text-xs opacity-75">
                        Essential for task reminders on iOS
                      </div>
                    )}
                  </div>
                  {notificationPermission === "granted" && (
                    <span className="text-emerald-500">✓</span>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={exportJson}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all duration-200 border border-emerald-200 text-sm font-medium"
                  >
                    <span>📤</span>
                    Export
                  </button>

                  <label className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-all duration-200 border border-purple-200 text-sm font-medium cursor-pointer">
                    <span>📥</span>
                    Import
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => importJson(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={clearCompleted}
                    disabled={stats.completed === 0}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all duration-200 border border-amber-200 text-sm font-medium disabled:opacity-50"
                  >
                    <span>🧹</span>
                    Clear History
                  </button>

                  <button
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-all duration-200 border border-slate-200 text-sm font-medium"
                  >
                    <span>📜</span>
                    View History
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Main Content - Active Tasks Only */}
          <div className="xl:col-span-3">
            <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/60 p-6">
              {/* Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search active tasks, clients, notes..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                    />
                  </div>

                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                  >
                    <option value="all">All Active Tasks</option>
                    <option value="active">Active Only</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                  >
                    <option value="due">Sort by Due Date</option>
                    <option value="created">Sort by Created</option>
                    <option value="title">Sort by Title</option>
                    <option value="client">Sort by Client</option>
                  </select>
                </div>

                <div className="text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                  Showing {filteredTasks.length} active tasks
                </div>
              </div>

              {/* Active Tasks List */}
              <div className="space-y-4">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4 text-slate-300">🎯</div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      {activeTasks.length === 0
                        ? "No active tasks"
                        : "No tasks match your filters"}
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {activeTasks.length === 0
                        ? "Create your first task or check history for completed work"
                        : "Try adjusting your search or filters"}
                    </p>
                    {activeTasks.length === 0 && stats.completed > 0 && (
                      <button
                        onClick={() => setShowHistory(true)}
                        className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-all duration-200"
                      >
                        📜 View {stats.completed} Completed Tasks
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {filteredTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={toggleComplete}
                        onEdit={() => {}}
                        onDelete={deleteTask}
                        onUpdate={updateTask}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-600">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-slate-200/60">
            <div className="flex flex-wrap justify-center items-center gap-6 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>
                  Live UTC:{" "}
                  <strong className="font-mono">
                    {getUtcTime(currentTime.utc)}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>
                  Live Bangladesh:{" "}
                  <strong className="font-mono">
                    {currentTime.bangladesh}
                  </strong>
                </span>
              </div>
            </div>
            <p>
              ChronoTask Pro • Active: {stats.active} • Completed:{" "}
              {stats.completed} • Storage:{" "}
              <code className="text-xs">{STORAGE_KEY}</code>
            </p>
            {isStandalone && (
              <p className="text-emerald-600 font-medium mt-2">
                📱 Running as Installed App
              </p>
            )}
          </div>
        </footer>
      </div>

      {/* Add some custom animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slide-down {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
