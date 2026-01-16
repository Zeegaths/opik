import { render } from "@react-email/render";
import BuilderUptimeWaitlistEmail from "../../../emails"; // imports index.tsx by default
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const resend = new Resend(process.env.RESEND_API_KEY);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "1 m"),
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const result = await ratelimit.limit(ip);

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests!!" },
      { status: 429 }
    );
  }

  const { email, firstname } = await request.json();

  const { data, error } = await resend.emails.send({
    from: "Builder Uptime <noreply@builderuptime.com>", // Change to your domain
    to: [email],
    subject: "You're on the List! Welcome to Builder Uptime! 🚀",
    replyTo: "support@builderuptime.com", // Change to your support email
    html: await render(BuilderUptimeWaitlistEmail({ userFirstname: firstname })),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { message: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Email sent successfully" });
}