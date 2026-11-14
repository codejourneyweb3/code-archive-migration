const KEY = "autoschool.theme";
export function applyStoredTheme() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", localStorage.getItem(KEY) === "dark");
}
export function toggleTheme(): "dark" | "light" {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem(KEY, next);
  document.documentElement.classList.toggle("dark", next === "dark");
  return next;
}
