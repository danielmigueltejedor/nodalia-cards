import { notificationsMobilePolicy } from "./notifications-mobile-policy";
if (typeof window !== "undefined" && !window.NodaliaNotificationsMobilePolicy) {
  window.NodaliaNotificationsMobilePolicy = notificationsMobilePolicy;
}
