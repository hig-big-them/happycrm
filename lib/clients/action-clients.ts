import { createSafeActionClient } from "next-safe-action"
import { getUser } from '../actions/clients'

export const actionClient = createSafeActionClient();

// Authenticated action client - requires login but no specific role
export const authenticatedActionClient = actionClient.use(async ({ next }) => {
  const user = await getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }
  return next({ ctx: { user } });
});

// Action client middleware'leri artık kendi cookie'lerini aldığı için düzeltiyoruz
export const adminActionClient = actionClient.use(async ({ next }) => {
  const user = await getUser();
  if (!user) {
    throw new Error("User not authenticated for admin action");
  }
  const appRole = user.app_metadata?.role;
  if (appRole !== 'admin' && appRole !== 'superuser') {
    throw new Error("User is not an admin");
  }
  return next({ ctx: { user, appRole } });
});

export const superuserActionClient = actionClient.use(async ({ next }) => {
  const user = await getUser();
  if (!user) {
    throw new Error("User not authenticated for superuser action");
  }
  const appRole = user.app_metadata?.role;
  if (appRole !== 'superuser') {
    throw new Error("User is not a superuser");
  }
  return next({ ctx: { user, appRole } });
});

export const transferOfficerActionClient = actionClient.use(async ({ next }) => {
  const user = await getUser();
  if (!user) {
    throw new Error("User not authenticated for transfer officer action");
  }
  const appRole = user.app_metadata?.role;
  if (appRole !== 'transfer_officer' && appRole !== 'admin' && appRole !== 'superuser') {
    throw new Error("User is not authorized for transfer operations");
  }
  return next({ ctx: { user, appRole } });
});