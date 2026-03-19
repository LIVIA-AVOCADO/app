import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Payload = {
  tenant_id: string;
  conversation_id: string;
  sender_type: string;
  sender_user_id?: string | null;
  sender_agent_id?: string | null;
  external_message_id?: string | null;
  provider_media_id?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_base64: string;
  file_size_bytes?: number | null;
  duration_ms?: number | null;
  visibility?: "public" | "internal";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(",")
    ? base64.split(",").pop() || ""
    : base64;

  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET");

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return json(401, { error: "Unauthorized" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as Payload;

    const {
      tenant_id,
      conversation_id,
      sender_type,
      sender_user_id = null,
      sender_agent_id = null,
      external_message_id = null,
      provider_media_id = null,
      file_name = "audio.ogg",
      mime_type = "audio/ogg",
      file_base64,
      file_size_bytes = null,
      duration_ms = null,
      visibility = "public",
    } = body;

    if (!tenant_id || !conversation_id || !sender_type || !file_base64) {
      return json(400, {
        error:
          "Campos obrigatórios: tenant_id, conversation_id, sender_type, file_base64",
      });
    }

    const messageId = crypto.randomUUID();
    const attachmentId = crypto.randomUUID();

    const safeFileName = sanitizeFileName(file_name || "audio.ogg");
    const extension = safeFileName.includes(".")
      ? safeFileName.split(".").pop()
      : "ogg";

    const finalFileName = safeFileName || `audio.${extension}`;
    const bucket = "message-media";
    const storagePath =
      `tenant/${tenant_id}/conversation/${conversation_id}/message/${messageId}/${finalFileName}`;

    const fileBytes = base64ToUint8Array(file_base64);

    // 1) Upload do arquivo
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBytes, {
        contentType: mime_type,
        upsert: false,
      });

    if (uploadError) {
      return json(500, {
        error: "Falha ao fazer upload no Storage",
        details: uploadError.message,
      });
    }

    // 2) Inserir a mensagem placeholder
    const placeholder = "[Áudio recebido — transcrição pendente]";

    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        id: messageId,
        conversation_id,
        sender_type,
        sender_user_id,
        sender_agent_id,
        content: placeholder,
        message_type: "audio",
        visibility,
        transcription_status: "pending",
        external_message_id,
      });

    if (messageError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      return json(500, {
        error: "Falha ao inserir message",
        details: messageError.message,
      });
    }

    // 3) Inserir attachment
    const { error: attachmentError } = await supabase
      .from("message_attachments")
      .insert({
        id: attachmentId,
        tenant_id,
        conversation_id,
        message_id: messageId,
        attachment_type: "audio",
        storage_bucket: bucket,
        storage_path: storagePath,
        file_name: finalFileName,
        mime_type,
        file_size_bytes,
        duration_ms,
        provider_media_id,
        metadata: {},
      });

    if (attachmentError) {
      await supabase.from("messages").delete().eq("id", messageId);
      await supabase.storage.from(bucket).remove([storagePath]);

      return json(500, {
        error: "Falha ao inserir message_attachments",
        details: attachmentError.message,
      });
    }

    return json(200, {
      success: true,
      message_id: messageId,
      attachment_id: attachmentId,
      storage_bucket: bucket,
      storage_path: storagePath,
      transcription_status: "pending",
    });
  } catch (error) {
    return json(500, {
      error: "Unexpected error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
