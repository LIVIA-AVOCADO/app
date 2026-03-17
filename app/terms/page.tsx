import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Termos de Serviço – LIVIA',
  description: 'Leia os Termos de Serviço da LIVIA antes de utilizar nossa plataforma.',
};

export default function TermsPage() {
  const lastUpdated = '17 de março de 2026';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.png" alt="LIVIA" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-gray-900">LIVIA</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/privacy-policy" className="text-gray-600 hover:text-gray-900 transition-colors">
              Política de Privacidade
            </Link>
            <Link
              href="/login"
              className="font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Termos de Serviço</h1>
          <p className="text-gray-500 text-sm">Última atualização: {lastUpdated}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <p>
              Estes Termos de Serviço (&quot;Termos&quot;) regulam o uso da plataforma LIVIA (&quot;Plataforma&quot;,
              &quot;Serviço&quot;, &quot;nós&quot; ou &quot;nosso&quot;). Ao criar uma conta ou utilizar qualquer funcionalidade
              da LIVIA, você (&quot;Usuário&quot;) concorda com estes Termos integralmente.
            </p>
            <p>
              Leia este documento com atenção. Se você não concordar com algum ponto, não utilize
              nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Descrição do serviço</h2>
            <p>
              LIVIA é uma plataforma SaaS (Software como Serviço) de atendimento ao cliente potencializada
              por inteligência artificial. O Serviço permite que empresas centralizem conversas de múltiplos
              canais, automatizem respostas por meio de IA e gerenciem equipes de suporte.
            </p>
            <p className="mt-3">
              A LIVIA se reserva o direito de modificar, suspender ou descontinuar qualquer parte do
              Serviço a qualquer momento, com aviso prévio razoável.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Elegibilidade</h2>
            <p>Para utilizar a LIVIA, você deve:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Ter pelo menos 18 anos de idade</li>
              <li>Ter capacidade legal para celebrar contratos vinculantes</li>
              <li>Representar uma empresa ou agir em nome próprio de forma lícita</li>
              <li>Não ter sido anteriormente suspenso ou removido da Plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Conta e credenciais</h2>
            <p>
              Você é responsável por manter a confidencialidade das suas credenciais de acesso e por
              todas as atividades realizadas em sua conta. Notifique-nos imediatamente em caso de
              uso não autorizado.
            </p>
            <p className="mt-3">
              Ao utilizar o login com o Google, você autoriza a LIVIA a receber informações básicas
              do seu perfil Google (nome, e-mail e foto) para fins de autenticação, nos termos da
              Política de Privacidade do Google e da nossa{' '}
              <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
            <p className="mt-3">
              É proibido criar contas falsas, compartilhar credenciais ou utilizar a Plataforma
              em nome de terceiros sem autorização.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Uso aceitável</h2>
            <p>Você concorda em utilizar a LIVIA apenas para fins legítimos e lícitos. É expressamente proibido:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Violar leis ou regulamentações aplicáveis</li>
              <li>Enviar spam, mensagens não solicitadas ou conteúdo enganoso</li>
              <li>Distribuir malware, vírus ou código malicioso</li>
              <li>Tentar acessar sistemas ou dados de outros usuários sem autorização</li>
              <li>Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte da Plataforma</li>
              <li>Revender, sublicenciar ou transferir o acesso ao Serviço sem autorização prévia por escrito</li>
              <li>Usar a Plataforma para assédio, discriminação ou qualquer forma de abuso</li>
              <li>Sobrecarregar a infraestrutura com requisições automatizadas excessivas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Conteúdo do usuário</h2>
            <p>
              Você retém a propriedade de todo o conteúdo que inserir na Plataforma (&quot;Conteúdo do Usuário&quot;),
              incluindo mensagens, dados de contatos e configurações.
            </p>
            <p className="mt-3">
              Ao utilizar o Serviço, você nos concede uma licença limitada, não exclusiva e revogável
              para armazenar, processar e exibir seu Conteúdo exclusivamente para fins de prestação do Serviço.
            </p>
            <p className="mt-3">
              Você declara que possui todos os direitos necessários sobre o Conteúdo inserido e que
              ele não viola direitos de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Planos e pagamentos</h2>
            <p>
              A LIVIA pode oferecer planos gratuitos e pagos. Os valores, cobranças e condições de
              cada plano são descritos na página de preços. Ao contratar um plano pago:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>As cobranças são realizadas conforme o ciclo contratado (mensal ou anual)</li>
              <li>Os preços podem ser reajustados com aviso prévio de 30 dias</li>
              <li>O cancelamento é efetivo ao final do período faturado</li>
              <li>Não há reembolso proporcional por cancelamento antecipado, salvo disposição legal em contrário</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Propriedade intelectual</h2>
            <p>
              A Plataforma LIVIA, incluindo seu design, código-fonte, logotipos, marcas registradas
              e documentação, é de propriedade exclusiva da LIVIA e está protegida por leis de
              propriedade intelectual.
            </p>
            <p className="mt-3">
              Nada nestes Termos transfere qualquer propriedade intelectual da LIVIA para você.
              É concedida apenas uma licença de uso limitada, não exclusiva e revogável para acessar
              e utilizar o Serviço conforme estes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disponibilidade e SLA</h2>
            <p>
              Buscamos manter a Plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta.
              Poderemos realizar manutenções programadas com aviso prévio. Não nos responsabilizamos
              por interrupções causadas por fatores fora do nosso controle (caso fortuito, força maior,
              falhas de terceiros, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitação de responsabilidade</h2>
            <p>
              Na máxima extensão permitida pela lei, a LIVIA não será responsável por danos indiretos,
              incidentais, especiais, consequenciais ou punitivos, incluindo perda de lucros, dados
              ou boa-vontade, decorrentes do uso ou incapacidade de usar o Serviço.
            </p>
            <p className="mt-3">
              Nossa responsabilidade total, em qualquer circunstância, fica limitada ao valor pago
              pelo Usuário nos 3 meses anteriores ao evento gerador do dano.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Privacidade e proteção de dados</h2>
            <p>
              O tratamento de dados pessoais é regido pela nossa{' '}
              <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                Política de Privacidade
              </Link>
              , que faz parte integrante destes Termos. Ao utilizar a LIVIA, você consente com
              o tratamento dos seus dados conforme descrito naquele documento e em conformidade
              com a LGPD (Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Rescisão</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento através das configurações da Plataforma.
            </p>
            <p className="mt-3">
              A LIVIA pode suspender ou encerrar seu acesso imediatamente, com ou sem aviso prévio,
              em caso de violação destes Termos, atividade fraudulenta, uso prejudicial à Plataforma
              ou a outros usuários, ou por determinação legal.
            </p>
            <p className="mt-3">
              Com o encerramento, seu direito de usar o Serviço cessa imediatamente. As cláusulas
              que, por sua natureza, deveriam sobreviver à rescisão (propriedade intelectual,
              limitação de responsabilidade, lei aplicável) permanecerão em vigor.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Modificações dos termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. A versão mais recente sempre estará
              disponível nesta página com a data de atualização. Para mudanças materiais, notificaremos
              você por e-mail ou por aviso na Plataforma com pelo menos 15 dias de antecedência.
            </p>
            <p className="mt-3">
              O uso continuado da Plataforma após as mudanças constitui aceitação dos novos Termos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Lei aplicável e foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Quaisquer
              disputas serão submetidas ao foro da Comarca de São Paulo, Estado de São Paulo,
              com exclusão de qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contato</h2>
            <p>
              Para dúvidas ou questões relacionadas a estes Termos de Serviço, entre em contato:
            </p>
            <div className="mt-4 bg-gray-50 rounded-xl p-6">
              <p><strong>LIVIA – Atendimento Inteligente</strong></p>
              <p className="mt-1">E-mail: <a href="mailto:contato@online24por7.ai" className="text-blue-600 hover:underline">contato@online24por7.ai</a></p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="LIVIA" width={20} height={20} className="rounded" />
            <span>© {new Date().getFullYear()} LIVIA. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-900 transition-colors">Início</Link>
            <Link href="/privacy-policy" className="hover:text-gray-900 transition-colors">Política de Privacidade</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Termos de Serviço</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
