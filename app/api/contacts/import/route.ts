import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BATCH_SIZE = 100;

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    result.push(field.trim());
    return result;
  };

  const headers = parseRow(nonEmpty[0]!).map(h => h.toLowerCase().trim());
  const rows = nonEmpty.slice(1).map(parseRow);
  return { headers, rows };
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function col(row: string[], headers: string[], ...keys: string[]): string {
  for (const key of keys) {
    const idx = headers.indexOf(key);
    if (idx !== -1 && row[idx]?.trim()) return row[idx].trim();
  }
  return '';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = userData?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 403 });
  }

  let text: string;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Arquivo CSV não enviado' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 5MB)' }, { status: 400 });
    }
    text = await file.text();
  } catch {
    return NextResponse.json({ error: 'Erro ao ler arquivo' }, { status: 400 });
  }

  const { headers, rows } = parseCSV(text);

  const nameIdx = headers.findIndex(h => ['nome', 'name'].includes(h));
  const phoneIdx = headers.findIndex(h => ['telefone', 'phone', 'celular', 'fone', 'whatsapp'].includes(h));

  if (nameIdx === -1 || phoneIdx === -1) {
    return NextResponse.json({
      error: 'CSV deve conter colunas "nome" (ou "name") e "telefone" (ou "phone")',
    }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

    // Build valid records
    type Record = {
      rowNum: number;
      phone: string;
      name: string;
      email: string | null;
      cpf: string | null;
      city: string | null;
      zip_code: string | null;
      address_street: string | null;
      address_number: string | null;
    };

    const valid: Record[] = [];
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]!;
      const rowNum = batchStart + i + 2;
      const name = row[nameIdx]?.trim();
      const rawPhone = row[phoneIdx]?.trim();
      const phone = normalizePhone(rawPhone || '');

      if (!name) { errors.push({ row: rowNum, message: 'Nome em branco' }); skipped++; continue; }
      if (!phone) { errors.push({ row: rowNum, message: 'Telefone em branco' }); skipped++; continue; }
      if (phone.length < 8) { errors.push({ row: rowNum, message: `Telefone inválido: ${rawPhone}` }); skipped++; continue; }

      valid.push({
        rowNum,
        phone,
        name,
        email: col(row, headers, 'email') || null,
        cpf: col(row, headers, 'cpf') || null,
        city: col(row, headers, 'cidade', 'city') || null,
        zip_code: col(row, headers, 'cep', 'zip_code', 'zip') || null,
        address_street: col(row, headers, 'rua', 'endereco', 'address_street', 'logradouro') || null,
        address_number: col(row, headers, 'numero', 'number', 'address_number') || null,
      });
    }

    if (valid.length === 0) continue;

    // Check which phones already exist for this tenant
    const phones = valid.map(r => r.phone);
    const { data: existing } = await supabase
      .from('contacts')
      .select('phone')
      .eq('tenant_id', tenantId)
      .in('phone', phones);

    const existingPhones = new Set((existing ?? []).map((c: { phone: string }) => c.phone));

    const toInsert = valid
      .filter(r => {
        if (existingPhones.has(r.phone)) {
          skipped++;
          return false;
        }
        return true;
      })
      .map(r => ({
        tenant_id: tenantId,
        name: r.name,
        phone: r.phone,
        email: r.email,
        cpf: r.cpf,
        city: r.city,
        zip_code: r.zip_code,
        address_street: r.address_street,
        address_number: r.address_number,
        status: 'open' as const,
      }));

    if (toInsert.length === 0) continue;

    const { error: insertError, data } = await supabase
      .from('contacts')
      .insert(toInsert)
      .select('id');

    if (insertError) {
      for (const r of valid.filter(v => !existingPhones.has(v.phone))) {
        errors.push({ row: r.rowNum, message: insertError.message });
        skipped++;
      }
    } else {
      imported += data?.length ?? toInsert.length;
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, 50),
    total: rows.length,
  });
}
