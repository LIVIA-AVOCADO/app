/**
 * Utilitários para manipulação de dados de contatos
 */

import { formatPhone } from './validators';

/**
 * Obtém o nome de exibição do contato com fallback para telefone
 * Similar ao comportamento do WhatsApp Web
 * 
 * @param name - Nome do contato (pode ser null, undefined ou string)
 * @param phone - Telefone do contato (pode ser null, undefined ou string)
 * @returns Nome válido ou telefone formatado
 */
export function getContactDisplayName(
  name: string | null | undefined,
  phone: string | null | undefined
): string {
  // Verifica se name é válido
  const isValidName = name && 
    name.trim() !== '' && 
    !/^n[ãa]o\s*informado$/i.test(name.trim());
  
  if (isValidName) {
    return name.trim();
  }
  
  // Fallback para telefone formatado
  if (phone) {
    return formatPhone(phone);
  }
  
  // Último fallback
  return 'Contato sem nome';
}

/**
 * Retorna apenas o primeiro nome do contato (para exibição compacta).
 * Se o displayName for telefone ou fallback, retorna como está.
 */
export function getContactFirstName(
  name: string | null | undefined,
  phone: string | null | undefined
): string {
  const displayName = getContactDisplayName(name, phone);

  if (displayName === 'Contato sem nome' || /^\(?\d/.test(displayName)) {
    return displayName;
  }

  return displayName.split(' ')[0] ?? displayName;
}

/**
 * Gera iniciais do contato com fallback para telefone
 * 
 * @param name - Nome do contato (pode ser null, undefined ou string)
 * @param phone - Telefone do contato (pode ser null, undefined ou string)
 * @returns Iniciais (2 caracteres)
 */
export function getContactInitials(
  name: string | null | undefined,
  phone: string | null | undefined
): string {
  const displayName = getContactDisplayName(name, phone);
  
  // Se for "Contato sem nome", retornar "??"
  if (displayName === 'Contato sem nome') {
    return '??';
  }
  
  // Se for telefone formatado (padrão brasileiro), usar últimos 2 dígitos
  if (displayName.match(/^\(\d{2}\)\s/)) {
    const digits = displayName.replace(/\D/g, '');
    if (digits.length >= 2) {
      return digits.slice(-2).toUpperCase();
    }
  }
  
  // Se contém apenas dígitos (telefone não formatado), usar últimos 2 dígitos
  if (/^\d+$/.test(displayName)) {
    return displayName.slice(-2).toUpperCase();
  }
  
  // Caso contrário, usar iniciais do nome
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return initials || '??';
}

