import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <form
        action={signUp}
        className="w-full max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Create account</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Sign up
        </button>
        <p className="text-sm text-slate-600">
          Already have an account? <a className="text-sky-600" href="/login">Log in</a>
        </p>
      </form>
    </main>
  );
}
