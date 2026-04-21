import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { SignupForm } from '@/components/auth/signup-form';

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/inbox');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="LIVIA"
              width={200}
              height={53}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Plataforma de Atendimento com IA
          </p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          MVP - WhatsApp Customer Service Platform
        </p>
      </div>
    </div>
  );
}
