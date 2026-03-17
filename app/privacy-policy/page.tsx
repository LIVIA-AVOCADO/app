import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Política de Privacidade – LIVIA',
  description: 'Saiba como a LIVIA coleta, usa e protege suas informações pessoais.',
};

export default function PrivacyPolicyPage() {
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
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">
              Termos de Serviço
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
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Política de Privacidade</h1>
          <p className="text-gray-500 text-sm">Última atualização: {lastUpdated}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <p>
              A LIVIA (&quot;nós&quot;, &quot;nosso&quot; ou &quot;Plataforma&quot;) está comprometida com a proteção da sua privacidade.
              Esta Política de Privacidade explica como coletamos, usamos, armazenamos, compartilhamos e
              protegemos suas informações quando você utiliza nossos serviços, em conformidade com a
              Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
            </p>
            <p>
              Ao acessar ou utilizar a Plataforma LIVIA, você concorda com os termos desta Política.
              Se não concordar, por favor, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Quem somos</h2>
            <p>
              LIVIA é uma plataforma de atendimento ao cliente potencializada por inteligência artificial,
              desenvolvida para ajudar empresas a gerenciar conversas, automatizar respostas e melhorar
              a experiência de seus clientes. Somos o controlador dos dados pessoais coletados através
              de nosso serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Dados que coletamos</h2>
            <p>Coletamos as seguintes categorias de informações:</p>
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">2.1 Dados de cadastro</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Senha (armazenada em formato criptografado)</li>
              <li>Nome da empresa ou organização</li>
              <li>Número de telefone (opcional)</li>
            </ul>
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">2.2 Dados de uso</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Logs de acesso (data, hora, endereço IP)</li>
              <li>Interações com a plataforma (páginas visitadas, funcionalidades utilizadas)</li>
              <li>Dados de desempenho e diagnóstico</li>
            </ul>
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">2.3 Dados de atendimento</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Mensagens trocadas entre sua equipe e seus clientes finais</li>
              <li>Informações de contato dos seus clientes (nome, telefone, e-mail)</li>
              <li>Histórico de conversas e tickets</li>
              <li>Tags e anotações adicionadas pelos usuários</li>
            </ul>
            <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">2.4 Dados de autenticação social</h3>
            <p>
              Quando você opta por fazer login com o Google, coletamos seu nome, endereço de e-mail
              e foto de perfil fornecidos pela sua conta Google, conforme autorizado por você.
              Não recebemos sua senha do Google.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Como usamos seus dados</h2>
            <p>Utilizamos suas informações para:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Criar e gerenciar sua conta na plataforma</li>
              <li>Fornecer, operar e melhorar nossos serviços</li>
              <li>Autenticar seu acesso e garantir a segurança da conta</li>
              <li>Enviar comunicações transacionais (confirmações, alertas de segurança)</li>
              <li>Oferecer suporte técnico e atendimento ao cliente</li>
              <li>Analisar o uso da plataforma para melhorias de produto</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Detectar e prevenir fraudes ou atividades maliciosas</li>
            </ul>
            <p className="mt-4">
              Não utilizamos seus dados para fins publicitários de terceiros nem os vendemos a outras empresas.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Base legal para o tratamento</h2>
            <p>Tratamos seus dados com base nas seguintes hipóteses legais previstas na LGPD:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Execução de contrato:</strong> para fornecer os serviços contratados</li>
              <li><strong>Consentimento:</strong> para comunicações de marketing (quando aplicável)</li>
              <li><strong>Interesse legítimo:</strong> para melhorias de produto e segurança</li>
              <li><strong>Cumprimento de obrigação legal:</strong> quando exigido por lei</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Compartilhamento de dados</h2>
            <p>Podemos compartilhar seus dados com:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Provedores de infraestrutura:</strong> Supabase (banco de dados e autenticação),
                serviços de hospedagem em nuvem – todos sob acordos de confidencialidade e proteção de dados.
              </li>
              <li>
                <strong>Google:</strong> para autenticação via OAuth 2.0, conforme sua escolha de login.
              </li>
              <li>
                <strong>Autoridades legais:</strong> quando exigido por ordem judicial ou regulatória.
              </li>
            </ul>
            <p className="mt-4">Não compartilhamos dados com anunciantes ou corretores de dados.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Retenção de dados</h2>
            <p>
              Mantemos seus dados pelo tempo necessário para a prestação dos serviços e cumprimento
              de obrigações legais. Após o encerramento da conta:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Dados da conta são excluídos em até 90 dias</li>
              <li>Dados de conversas podem ser retidos por até 5 anos para fins legais</li>
              <li>Logs de acesso são mantidos por 6 meses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Seus direitos (LGPD)</h2>
            <p>Como titular dos dados, você tem o direito de:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Solicitar a portabilidade dos seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar a exclusão de dados tratados com base no consentimento</li>
            </ul>
            <p className="mt-4">
              Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail indicado
              na seção de contato abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra
              acesso não autorizado, perda, destruição ou alteração. Isso inclui:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Criptografia de dados em trânsito (TLS) e em repouso</li>
              <li>Autenticação de dois fatores disponível para contas</li>
              <li>Controle de acesso baseado em função (RBAC)</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Políticas de acesso mínimo para colaboradores internos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies</h2>
            <p>
              Utilizamos cookies e tecnologias similares para manter sua sessão autenticada, lembrar
              preferências e analisar o uso da plataforma. Você pode configurar seu navegador para
              recusar cookies, mas isso pode afetar a funcionalidade do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Menores de idade</h2>
            <p>
              Nossa plataforma é destinada exclusivamente a maiores de 18 anos. Não coletamos
              intencionalmente dados de menores. Se acreditar que coletamos dados de um menor,
              entre em contato conosco imediatamente para exclusão.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta Política periodicamente. Quando isso ocorrer, atualizaremos a
              data &quot;Última atualização&quot; no topo desta página e, em caso de mudanças significativas,
              notificaremos você por e-mail ou por aviso na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contato</h2>
            <p>
              Para dúvidas, solicitações ou exercício dos seus direitos relacionados a esta Política
              de Privacidade, entre em contato com nosso Encarregado de Proteção de Dados (DPO):
            </p>
            <div className="mt-4 bg-gray-50 rounded-xl p-6">
              <p><strong>LIVIA – Atendimento Inteligente</strong></p>
              <p className="mt-1">E-mail: <a href="mailto:privacidade@online24por7.ai" className="text-blue-600 hover:underline">privacidade@online24por7.ai</a></p>
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
