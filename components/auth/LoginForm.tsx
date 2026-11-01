"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/mascot/Mascot";
import { Icon } from "@/components/icons/Icon";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_linked: "এই Google অ্যাকাউন্টটি কোনো এনরোল নম্বরের সাথে যুক্ত নেই। প্রথমে এনরোল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন, তারপর Profile থেকে Google যুক্ত করুন।",
  google_start_failed: "Google সাইন-ইন শুরু করা যায়নি। আবার চেষ্টা করুন।",
  google_exchange_failed: "Google সাইন-ইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
  google_no_code: "Google সাইন-ইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const googleError = GOOGLE_ERRORS[useSearchParams().get("error") ?? ""];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const remember = formData.get("remember") === "on";
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollNumber: String(formData.get("enrollNumber") ?? ""),
          password: String(formData.get("password") ?? ""),
          remember,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।" }));
      if (!res.ok || !data.ok || !data.session) {
        setError(data.error ?? "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।");
        return;
      }
      const cookieValue =
        "base64-" +
        btoa(JSON.stringify(data.session))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      const cookieOptions = `path=/; SameSite=Lax; Secure${remember ? `; max-age=${60 * 60 * 24 * 30}` : ""}`;
      document.cookie = `sb-wxazzkcwevsqqifglysc-auth-token=${cookieValue}; ${cookieOptions}`;
      router.push("/home");
      router.refresh();
    } catch {
      setError("লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center px-6 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 h-20 w-20">
          <Mascot variant="color" mood="happy" />
        </div>
        <h1 className="font-bn text-xl font-bold text-text">স্বাগতম, OnboardingBuddy-তে</h1>
        <p className="mt-1 text-sm font-medium text-muted">
          আপনার এনরোল নম্বর ও পাসওয়ার্ড দিয়ে শুরু করুন
        </p>
      </div>

      {googleError && (
        <div className="mb-4 rounded-input bg-err-bg px-4 py-3 text-[13px] font-medium text-err-tx">
          {googleError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="enrollNumber" className="mb-1.5 block font-en text-[13px] font-semibold text-text">
            Enroll Number
          </label>
          <input
            id="enrollNumber"
            name="enrollNumber"
            type="text"
            required
            autoComplete="username"
            placeholder="যেমনঃ 560779"
            className="w-full rounded-input border border-line bg-card px-4 py-3.5 font-en text-[15px] text-text outline-none placeholder:text-muted focus:border-green"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block font-en text-[13px] font-semibold text-text">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="আপনার পাসওয়ার্ড"
            className="w-full rounded-input border border-line bg-card px-4 py-3.5 font-en text-[15px] text-text outline-none placeholder:text-muted focus:border-green"
          />
          <p className="mt-1.5 text-[12px] font-medium text-muted">
            প্রথমবার লগইন করলে এই পাসওয়ার্ডটিই ভবিষ্যতের জন্য সেট হয়ে যাবে।
          </p>
          <p className="mt-1 text-[12px] font-medium text-muted">
            পাসওয়ার্ড অবশ্যই কমপক্ষে ৮ অক্ষরের হতে হবে।
          </p>
        </div>

        <label className="flex items-center gap-2.5 font-en text-[13px] font-medium text-text">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="h-[18px] w-[18px] shrink-0 rounded-[5px] border border-line accent-green"
          />
          Keep me signed in
        </label>

        {error && (
          <div className="rounded-input bg-err-bg px-4 py-3 text-[13px] font-medium text-err-tx">{error}</div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-button bg-green px-4 py-4 font-en text-base font-bold text-white shadow-[0_2px_8px_rgba(44,162,77,.28)] transition-transform active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? "অপেক্ষা করুন…" : "Continue"}
          {!pending && <Icon name="arrowRight" size={18} />}
        </button>

        <Link
          href="/forgot-password"
          className="text-center font-en text-[13px] font-semibold text-green-dark"
        >
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="font-en text-[12px] font-medium text-muted">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          fetch("/api/auth/google", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
              if (!data.ok || !data.url) {
                setError("Google সাইন-ইন শুরু করা যায়নি। আবার চেষ্টা করুন।");
                return;
              }
              sessionStorage.setItem("ob_google_pkce_verifier", data.verifier);
              window.location.href = data.url;
            })
            .catch(() => setError("Google সাইন-ইন শুরু করা যায়নি। আবার চেষ্টা করুন।"));
        }}
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2.5 rounded-button border border-line bg-card px-4 py-3.5 font-en text-sm font-bold text-text transition-transform active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
          </svg>
          Continue with Google
        </button>
      </form>

      <p className="mt-8 text-center font-en text-xs font-medium text-muted">
        An Initiative of Akij Resource Human Capital Team
      </p>
    </div>
  );
}
