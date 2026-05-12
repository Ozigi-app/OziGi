import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SendMailClient } from "zeptomail";
import { buildFoundersThoughtsWelcomeEmail } from "@/lib/email-templates";

const ZEPTOMAIL_BASE_URL = "https://api.zeptomail.com/v1.1/email";
const mailClient = new SendMailClient({
  url: ZEPTOMAIL_BASE_URL,
  token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_API_KEY}`,
});

const FROM_ADDRESS = process.env.NEWSLETTER_FROM_ADDRESS || "hello@ozigi.app";
const FROM_NAME = process.env.NEWSLETTER_FROM_NAME || "Ozigi";

const ALLOWED_ORIGINS = [
  "https://ozigi.app",
  "https://blog.ozigi.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let email: string;
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400, headers });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: insertError } = await supabase
    .from("waitlist")
    .insert({ email });

  if (insertError) {
    if (insertError.code === "23505") {
      // Already subscribed — success, no welcome email
      return NextResponse.json({ success: true }, { headers });
    }
    console.error("[newsletter/subscribe] Insert error:", insertError);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500, headers });
  }

  // New subscriber — send welcome email
  try {
    await mailClient.sendMail({
      from: { address: FROM_ADDRESS, name: FROM_NAME },
      to: [{ email_address: { address: email, name: "" } }],
      subject: "Welcome to Founder's Thoughts",
      htmlbody: buildFoundersThoughtsWelcomeEmail(),
    });
  } catch (err) {
    // Don't fail the subscription if email send fails
    console.error("[newsletter/subscribe] Welcome email failed:", err);
  }

  return NextResponse.json({ success: true }, { headers });
}
