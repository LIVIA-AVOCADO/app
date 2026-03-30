/**
 * lib/meta/client.ts
 *
 * Cliente centralizado para chamadas à Meta Graph API (WhatsApp Cloud API).
 * Todas as rotas Meta importam daqui — sem duplicação de URL/versão.
 */

const GRAPH_BASE = 'https://graph.facebook.com/v18.0';

export interface MetaPhoneNumberInfo {
  id:             string;
  phoneNumber:    string;  // display_phone_number — ex: "+55 11 99999-9999"
  verifiedName:   string;  // nome verificado da empresa
}

interface GraphErrorResponse {
  error?: {
    message: string;
    type:    string;
    code:    number;
  };
}

/**
 * Verifica se as credenciais Meta são válidas consultando os dados do número.
 * Lança erro com mensagem legível caso o token seja inválido ou o número não exista.
 *
 * O token é enviado via header Authorization: Bearer para não expô-lo nos logs
 * de servidor (evita vazamento por query params em logs de acesso HTTP).
 */
export async function verifyPhoneNumber(
  phoneNumberId: string,
  accessToken:   string
): Promise<MetaPhoneNumberInfo> {
  const url = `${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}` +
    `?fields=display_phone_number,verified_name`;

  const res = await fetch(url, {
    method:  'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as (MetaPhoneNumberInfo & GraphErrorResponse & {
    display_phone_number?: string;
    verified_name?:        string;
  });

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? 'Token ou Phone Number ID inválido';
    throw new Error(msg);
  }

  return {
    id:           phoneNumberId,
    phoneNumber:  data.display_phone_number ?? '',
    verifiedName: data.verified_name        ?? '',
  };
}
