import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'LIVIA – Atendimento Inteligente com IA',
  description:
    'Plataforma de atendimento ao cliente potencializada por inteligência artificial. Gerencie conversas, automatize respostas e encante seus clientes.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="LIVIA" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-gray-900">LIVIA</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <Link href="#features" className="hover:text-gray-900 transition-colors">Funcionalidades</Link>
            <Link href="#how-it-works" className="hover:text-gray-900 transition-colors">Como funciona</Link>
            <Link href="/privacy-policy" className="hover:text-gray-900 transition-colors">Privacidade</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Termos</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-blue-50 to-white">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Powered by AI
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 max-w-3xl leading-tight mb-6">
          Atendimento inteligente que <span className="text-blue-600">encanta clientes</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
          LIVIA centraliza suas conversas do WhatsApp e outros canais, usa IA para automatizar respostas
          e ajuda sua equipe a resolver mais chamados em menos tempo.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-blue-600 text-white px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
          >
            Começar gratuitamente
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 text-gray-700 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-colors"
          >
            Já tenho uma conta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Tudo que você precisa para atender melhor
            </h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">
              Uma plataforma completa para equipes de suporte e vendas que querem escalar com qualidade.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '💬',
                title: 'Caixa de entrada unificada',
                desc: 'Gerencie todas as conversas de WhatsApp e outros canais em um só lugar, sem perder nenhuma mensagem.',
              },
              {
                icon: '🤖',
                title: 'IA que responde por você',
                desc: 'Respostas automáticas inteligentes para perguntas frequentes, disponíveis 24 horas por dia, 7 dias por semana.',
              },
              {
                icon: '⚡',
                title: 'Respostas rápidas',
                desc: 'Biblioteca de templates personalizados para agilizar o atendimento da sua equipe nas situações mais comuns.',
              },
              {
                icon: '🏷️',
                title: 'Tags e organização',
                desc: 'Categorize conversas com tags, atribua agentes e acompanhe o status de cada atendimento em tempo real.',
              },
              {
                icon: '📊',
                title: 'Métricas em tempo real',
                desc: 'Acompanhe volume de atendimentos, tempo médio de resposta e performance da equipe com dashboards claros.',
              },
              {
                icon: '🔒',
                title: 'Seguro e confiável',
                desc: 'Dados protegidos com criptografia e armazenados em infraestrutura segura, em conformidade com a LGPD.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-2xl p-8 hover:bg-blue-50 transition-colors">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Como funciona</h2>
          <p className="text-gray-600 text-lg mb-16">Comece a usar em minutos, sem instalação.</p>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastre-se gratuitamente e conecte seus canais de atendimento em poucos cliques.' },
              { step: '02', title: 'Configure a IA', desc: 'Treine a IA com as informações do seu negócio para respostas automáticas precisas.' },
              { step: '03', title: 'Atenda e escale', desc: 'Sua equipe foca nos casos complexos enquanto a IA resolve o restante automaticamente.' },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="text-5xl font-bold text-blue-100 mb-4">{s.step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Pronto para transformar seu atendimento?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Junte-se a empresas que já usam LIVIA para atender mais rápido e com mais qualidade.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-blue-600 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors"
          >
            Criar conta grátis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="LIVIA" width={20} height={20} className="rounded" />
            <span>© {new Date().getFullYear()} LIVIA. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-gray-900 transition-colors">Política de Privacidade</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Termos de Serviço</Link>
            <Link href="/login" className="hover:text-gray-900 transition-colors">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
