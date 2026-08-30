import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./cookies";

/** Server Components only — do not import from Client Components. */
export async function sessionAuth(): Promise<{ accessToken?: string }> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value?.trim();
    return token ? { accessToken: token } : {};
  } catch {
    return {};
  }
}
