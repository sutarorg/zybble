import type { User } from "@/types";

// Frontend-only walkthrough credentials. Never use this as production auth.
const walkthroughUser: User = {
  id: "usr_jordan",
  name: "Jordan Ellis",
  email: "jordan@zybble.example",
  initials: "JE",
  role: "learner",
};
const accounts = new Map<string, { user: User; password: string }>([
  [walkthroughUser.email, { user: walkthroughUser, password: "LearnToTeach!2026" }],
]);

export function authenticate(email: string, password: string): User | null {
  const account = accounts.get(email.trim().toLowerCase());
  return account?.password === password ? { ...account.user } : null;
}

export function registerAccount(user: User, password: string): boolean {
  const email = user.email.trim().toLowerCase();
  if (accounts.has(email)) return false;
  accounts.set(email, { user: { ...user, email, role: "learner" }, password });
  return true;
}
