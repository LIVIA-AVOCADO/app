'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Loader2, Save, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  validateCPF,
  validateEmail,
  validatePhone,
  formatCPF,
  formatPhone,
} from '@/lib/utils/validators';
import type { Contact } from '@/types/database-helpers';
import { useApiCall } from '@/lib/hooks';

interface CustomerDataPanelProps {
  contactId: string;
  tenantId: string;
  /** Se o painel está fixado como coluna lateral */
  isPinned?: boolean;
  /** Callback para fixar/desafixar o painel */
  onPinToggle?: () => void;
}

export function CustomerDataPanel({
  contactId,
  tenantId,
  isPinned = false,
  onPinToggle,
}: CustomerDataPanelProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados dos campos
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Validações
  const [emailError, setEmailError] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // API calls hooks
  const loadContactApi = useApiCall<{ data: Contact }>(
    `/api/contacts/${contactId}?tenantId=${tenantId}`,
    'GET',
    {
      errorMessage: 'Erro ao carregar dados do contato',
      suppressSuccessToast: true,
      onSuccess: (response) => {
        const contactData = response.data;
        setContact(contactData);
        setName(contactData.name || '');
        setEmail(contactData.email || '');
        setCpf(contactData.cpf || '');
        setPhoneSecondary(contactData.phone_secondary || '');
        setAddressStreet(contactData.address_street || '');
        setAddressNumber(contactData.address_number || '');
        setAddressComplement(contactData.address_complement || '');
        setCity(contactData.city || '');
        setZipCode(contactData.zip_code || '');
      },
    }
  );

  const saveContactApi = useApiCall<{ data: Contact }>(
    `/api/contacts/${contactId}`,
    'PATCH',
    {
      successMessage: 'Alterações salvas com sucesso',
      errorMessage: 'Erro ao salvar dados',
      onSuccess: (response) => {
        setContact(response.data);
        setHasUnsavedChanges(false);
      },
    }
  );

  // Carregar dados do contato
  useEffect(() => {
    loadContactApi.execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // Detectar alterações não salvas e validar em tempo real
  useEffect(() => {
    if (!contact || loadContactApi.isLoading) return;

    // Validar campos em tempo real
    if (email && !validateEmail(email)) {
      setEmailError('Email inválido');
    } else {
      setEmailError('');
    }

    if (cpf && !validateCPF(cpf)) {
      setCpfError('CPF inválido');
    } else {
      setCpfError('');
    }

    if (phoneSecondary && !validatePhone(phoneSecondary)) {
      setPhoneError('Telefone inválido');
    } else {
      setPhoneError('');
    }

    // Verificar se algo mudou
    const hasChanges =
      name !== (contact.name || '') ||
      email !== (contact.email || '') ||
      cpf !== (contact.cpf || '') ||
      phoneSecondary !== (contact.phone_secondary || '') ||
      addressStreet !== (contact.address_street || '') ||
      addressNumber !== (contact.address_number || '') ||
      addressComplement !== (contact.address_complement || '') ||
      city !== (contact.city || '') ||
      zipCode !== (contact.zip_code || '');

    setHasUnsavedChanges(hasChanges);
  }, [
    contact,
    loadContactApi.isLoading,
    name,
    email,
    cpf,
    phoneSecondary,
    addressStreet,
    addressNumber,
    addressComplement,
    city,
    zipCode,
  ]);

  const saveContact = async () => {
    // Validar antes de salvar
    if (emailError || cpfError || phoneError) {
      toast.error('Corrija os erros de validação antes de salvar');
      return;
    }

    await saveContactApi.execute({
      name: name,
      email: email || null,
      cpf: cpf || null,
      phone_secondary: phoneSecondary || null,
      address_street: addressStreet || null,
      address_number: addressNumber || null,
      address_complement: addressComplement || null,
      city: city || null,
      zip_code: zipCode || null,
      tenantId,
    });
  };

  const handleCopyData = () => {
    if (!contact) return;

    const data = [
      `Nome: ${contact.name}`,
      contact.phone ? `Telefone: ${formatPhone(contact.phone)}` : null,
      contact.phone_secondary
        ? `Telefone 2: ${formatPhone(contact.phone_secondary)}`
        : null,
      contact.email ? `Email: ${contact.email}` : null,
      contact.cpf ? `CPF: ${formatCPF(contact.cpf)}` : null,
      contact.address_street
        ? `Endereço: ${contact.address_street}${contact.address_number ? `, ${contact.address_number}` : ''}`
        : null,
      contact.address_complement
        ? `Complemento: ${contact.address_complement}`
        : null,
      contact.city ? `Cidade: ${contact.city}` : null,
      contact.zip_code ? `CEP: ${contact.zip_code}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(data);
    setCopied(true);
    toast.success('Dados copiados para área de transferência');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadContactApi.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">
          Erro ao carregar dados do contato
        </p>
      </div>
    );
  }

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 space-y-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Dados do Cliente</h3>
          {onPinToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onPinToggle}
              title={isPinned ? 'Desafixar painel' : 'Fixar painel sempre visível'}
            >
              {isPinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={saveContact}
            disabled={!hasUnsavedChanges || saveContactApi.isLoading || !!emailError || !!cpfError || !!phoneError}
            className="flex-1"
          >
            {saveContactApi.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyData}
            disabled={copied}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            aria-invalid={!!emailError}
          />
          {emailError && (
            <p className="text-xs text-destructive mt-1">{emailError}</p>
          )}
        </div>

        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            aria-invalid={!!cpfError}
          />
          {cpfError && (
            <p className="text-xs text-destructive mt-1">{cpfError}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Telefone Principal</Label>
          <Input
            id="phone"
            value={formatPhone(contact.phone)}
            disabled
            className="bg-muted"
          />
        </div>

        <div>
          <Label htmlFor="phone_secondary">Telefone Secundário</Label>
          <Input
            id="phone_secondary"
            value={phoneSecondary}
            onChange={(e) => setPhoneSecondary(e.target.value)}
            placeholder="(00) 00000-0000"
            aria-invalid={!!phoneError}
          />
          {phoneError && (
            <p className="text-xs text-destructive mt-1">{phoneError}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address_street">Endereço</Label>
          <Input
            id="address_street"
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
            placeholder="Rua, avenida..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="address_number">Número</Label>
            <Input
              id="address_number"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              placeholder="123"
            />
          </div>
          <div>
            <Label htmlFor="address_complement">Complemento</Label>
            <Input
              id="address_complement"
              value={addressComplement}
              onChange={(e) => setAddressComplement(e.target.value)}
              placeholder="Apto, bloco..."
            />
          </div>
        </div>

        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="São Paulo"
          />
        </div>

        <div>
          <Label htmlFor="zip_code">CEP</Label>
          <Input
            id="zip_code"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="00000-000"
          />
        </div>
      </div>
    </div>
  );
}
