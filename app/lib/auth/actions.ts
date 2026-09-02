"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "../api/config";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookies";

export type LoginState = {
  error: "invalid" | "unavailable" | "missing";
} | null;

type LoginResponse = {
  accessToken?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: "missing" };
  }

  let accessToken: string;
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 400) {
      return { error: "invalid" };
    }
    if (!response.ok) {
      return { error: "unavailable" };
    }

    const body = (await response.json()) as LoginResponse;
    if (!body.accessToken) {
      return { error: "unavailable" };
    }
    accessToken = body.accessToken;
  } catch {
    return { error: "unavailable" };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, accessToken, sessionCookieOptions());
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
