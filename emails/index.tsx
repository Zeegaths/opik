import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Preview,
    Text,
} from "@react-email/components";
import * as React from "react";

interface EmailProps {
    userFirstname: string;
}

export const BuilderUptimeWaitlistEmail = ({ userFirstname }: EmailProps) => (
    <Html>
        <Head />
        <Preview>Welcome to Builder Uptime Beta, {userFirstname}! 🚀</Preview>
        <Body style={main}>
            <Container style={container}>
                <Img
                    src={`https://yourdomain.com/logo.png`}
                    width="120"
                    height="120"
                    alt="Builder Uptime Logo"
                    style={logo}
                />
                <Text style={greeting}>Hey {userFirstname} 👋,</Text>
                <Text style={paragraph}>
                    First off, thank you for joining the Builder Uptime beta waitlist! We're thrilled to have you here. 🎉
                </Text>
                <Text style={paragraph}>
                    We're building something we believe will transform how you work—a platform designed to help builders perform at their peak without burning out. Whether it's tracking tasks that actually matter, crushing blockers faster, or maintaining sustainable energy levels, we're here to make your productivity measurable and achievable.
                </Text>
                <Text style={paragraph}>
                    Imagine this: no more vague "how productive was I today?" questions. Instead, you'll have concrete data on tasks shipped, blockers resolved, and energy patterns—all powered by AI that actually understands builder workflows. That's the future we're creating at Builder Uptime, and we're excited to have you on this journey with us.
                </Text>
                <Text style={highlightBox}>
                    ✨ <strong>Early Bird Bonus:</strong> As one of the first 100 builders to join, you'll get lifetime free access + exclusive features when we launch!
                </Text>
                <Text style={paragraph}>
                    We'll keep you updated every step of the way as we get closer to beta launch. In the meantime, if you have any questions, feedback, or just want to chat about productivity, please reply directly to{" "}
                    <a href="mailto:support@builderuptime.com" style={link}>
                        this email
                    </a>{" "}
                    — we'd love to hear from you!
                </Text>
                <Text style={paragraph}>
                    You can also follow us for the latest updates and sneak peeks:
                </Text>
                <Text style={socialLinks}>
                    🐦 Twitter:{" "}
                    <a href="https://twitter.com/BuilderUptime" style={link}>
                        @BuilderUptime
                    </a>
                    <br />
                    🟣 Farcaster:{" "}
                    <a href="https://warpcast.com/builderuptime" style={link}>
                        @builderuptime
                    </a>
                    <br />
                    💻 GitHub:{" "}
                    <a href="https://github.com/builderuptime" style={link}>
                        github.com/builderuptime
                    </a>
                </Text>
                <Text style={signOff}>
                    Thanks again for believing in us. We're building this for builders, by builders, and we can't wait to show you what's coming next.
                </Text>
                <Text style={signOff}>
                    Keep building,
                    <br />
                    <strong>Team Builder Uptime</strong>
                </Text>
                <Hr style={hr} />
                <Text style={footer}>
                    Built for MetaMask x Monad Hackathon • AI Agent Track
                    <br />
                    <br />
                    You received this email because you signed up for the Builder Uptime beta waitlist.
                    If you believe this is a mistake, feel free to ignore this email.
                </Text>
            </Container>
        </Body>
    </Html>
);

BuilderUptimeWaitlistEmail.PreviewProps = {
    userFirstname: "Builder",
} as EmailProps;

export default BuilderUptimeWaitlistEmail;

// Styles matching Builder Uptime's dark theme with cyan/orange accents
const main = {
    background: "linear-gradient(135deg, #0e7490 0%, #ea580c 100%)", // cyan-700 to orange-600
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    padding: "40px 10px",
    color: "#e5e7eb",
    borderRadius: "12px",
};

const container = {
    margin: "0 auto",
    padding: "42px 30px 48px",
    backgroundColor: "#111827", // gray-900
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(34, 211, 238, 0.2)", // cyan shadow
    maxWidth: "600px",
};

const logo = {
    margin: "0 auto",
    paddingBottom: "20px",
    borderRadius: "12px",
};

const greeting = {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: "bold",
    color: "#22d3ee", // cyan-400
};

const paragraph = {
    fontSize: "16px",
    lineHeight: "26px",
    marginBottom: "20px",
    color: "#d1d5db", // gray-300
};

const highlightBox = {
    fontSize: "16px",
    lineHeight: "26px",
    marginBottom: "20px",
    padding: "16px",
    backgroundColor: "#134e4a", // teal-900
    border: "2px solid #22d3ee", // cyan-400
    borderRadius: "8px",
    color: "#ffffff",
};

const link = {
    color: "#22d3ee", // cyan-400
    textDecoration: "underline",
    fontWeight: "500",
};

const socialLinks = {
    fontSize: "15px",
    lineHeight: "24px",
    marginBottom: "20px",
    color: "#d1d5db",
};

const signOff = {
    fontSize: "16px",
    lineHeight: "26px",
    marginTop: "20px",
    color: "#d1d5db",
};

const hr = {
    borderColor: "#374151", // gray-700
    margin: "30px 0",
};

const footer = {
    color: "#6b7280", // gray-500
    fontSize: "12px",
    lineHeight: "18px",
    textAlign: "center" as const,
};